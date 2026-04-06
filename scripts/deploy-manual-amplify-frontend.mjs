#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import {
  archiveReleasePackage,
  createReleaseMetadata,
  createDeployment,
  createZipArchive,
  ensureFrontendBuild,
  frontendDistDir,
  getFrontendStackNameForEnvironment,
  getReleaseArchiveStorageFromOutputs,
  getStackOutputs,
  releaseManifestFileName,
  resolveFrontendBuildEnv,
  startDeployment,
  uploadArchivedReleaseToS3,
  uploadZip,
  waitForJob,
  writeReleaseManifest,
} from "./amplify-frontend-release-lib.mjs";

const defaultDeployLockPath = path.resolve(
  process.cwd(),
  ".local",
  "locks",
  "manual-amplify-frontend-deploy.lock",
);

async function acquireDeployLock(environment) {
  const lockPath =
    process.env.LIGHTNING_MANUAL_DEPLOY_LOCK_PATH || defaultDeployLockPath;

  await fs.mkdir(path.dirname(lockPath), { recursive: true });

  let handle;

  try {
    handle = await fs.open(lockPath, "wx");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "EEXIST") {
      let details = "";

      try {
        details = await fs.readFile(lockPath, "utf8");
      } catch {
        // Ignore lock read failures and surface the main contention error.
      }

      throw new Error(
        [
          "Another manual Amplify frontend deployment is already running.",
          "Retry after it finishes so staging and production do not race on the shared build output.",
          details ? `Lock details: ${details.trim()}` : "",
        ]
          .filter(Boolean)
          .join(" "),
      );
    }

    throw error;
  }

  await handle.writeFile(
    JSON.stringify(
      {
        environment,
        pid: process.pid,
        startedAt: new Date().toISOString(),
        cwd: process.cwd(),
      },
      null,
      2,
    ),
    "utf8",
  );

  return async () => {
    await handle.close();
    await fs.rm(lockPath, { force: true });
  };
}

function parseArgs(argv) {
  const args = {
    environment: "staging",
    stackName: null,
    jsonOutputPath: null,
    region: process.env.AWS_DEFAULT_REGION || process.env.AWS_REGION || "eu-west-2",
    waitTimeoutMs: 20 * 60 * 1000,
    pollIntervalMs: 10 * 1000,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    switch (current) {
      case "--environment":
        args.environment = next;
        index += 1;
        break;
      case "--stack-name":
        args.stackName = next;
        index += 1;
        break;
      case "--json-output":
        args.jsonOutputPath = next;
        index += 1;
        break;
      case "--region":
        args.region = next;
        index += 1;
        break;
      case "--wait-timeout-ms":
        args.waitTimeoutMs = Number(next);
        index += 1;
        break;
      case "--poll-interval-ms":
        args.pollIntervalMs = Number(next);
        index += 1;
        break;
      default:
        throw new Error(`Unsupported argument: ${current}`);
    }
  }

  if (!args.stackName) {
    args.stackName = getFrontendStackNameForEnvironment(args.environment);
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const releaseLock = await acquireDeployLock(args.environment);

  try {
    const stackOutputs = getStackOutputs(args.stackName, args.region);
    const buildEnv = resolveFrontendBuildEnv(stackOutputs, args);
    const appId = stackOutputs.AmplifyAppId;
    const branchName = stackOutputs.AmplifyBranchName;
    const defaultDomain = stackOutputs.AmplifyDefaultDomain;

    if (!appId || !branchName) {
      throw new Error(
        `Stack ${args.stackName} does not expose AmplifyAppId and AmplifyBranchName. Deploy the frontend hosting stack first.`,
      );
    }

    ensureFrontendBuild(buildEnv);
    const deployment = createDeployment(appId, branchName, args.region);

    if (!deployment.jobId || !deployment.zipUploadUrl) {
      throw new Error("Amplify create-deployment did not return jobId and zipUploadUrl.");
    }

    const releaseMetadata = createReleaseMetadata({
      args,
      stackOutputs,
      buildEnv,
      appId,
      branchName,
      defaultDomain,
      jobId: deployment.jobId,
    });
    const releaseManifestPath = writeReleaseManifest(releaseMetadata);
    const archive = createZipArchive(frontendDistDir);

    try {
      await uploadZip(deployment.zipUploadUrl, archive.archivePath);
      startDeployment(appId, branchName, deployment.jobId, args.region);
      const deploymentResult = await waitForJob(
        appId,
        branchName,
        deployment.jobId,
        args.region,
        args.waitTimeoutMs,
        args.pollIntervalMs,
      );
 
      if (deploymentResult.status !== "SUCCEED") {
        throw new Error(
          `Amplify deployment finished with status ${deploymentResult.status}. Job summary: ${JSON.stringify(
            deploymentResult.summary,
          )}`,
        );
      }

      const archivedRelease = archiveReleasePackage({
        releaseMetadata,
        archivePath: archive.archivePath,
      });
      const releaseArchiveStorage = getReleaseArchiveStorageFromOutputs(
        stackOutputs,
        args.stackName,
      );
      const archivedReleaseWithRemote = uploadArchivedReleaseToS3({
        archivedRelease,
        bucketName: releaseArchiveStorage.bucketName,
        objectPrefix: releaseArchiveStorage.objectPrefix,
        region: args.region,
      });
      const result = {
        environment: args.environment,
        stackName: args.stackName,
        buildEnv,
        releaseMetadata,
        releaseManifestPath,
        releaseManifestUrl: defaultDomain
          ? `https://${branchName}.${defaultDomain}/${releaseManifestFileName}`
          : null,
        archivedRelease: archivedReleaseWithRemote,
        appId,
        branchName,
        defaultDomain,
        webUrl: defaultDomain ? `https://${branchName}.${defaultDomain}` : null,
        jobId: deployment.jobId,
        status: deploymentResult.status,
      };

      if (args.jsonOutputPath) {
        const resolvedOutputPath = path.resolve(process.cwd(), args.jsonOutputPath);
        await fs.mkdir(path.dirname(resolvedOutputPath), { recursive: true });
        await fs.writeFile(
          resolvedOutputPath,
          JSON.stringify(result, null, 2),
          "utf8",
        );
      }

      console.log(
        JSON.stringify(result, null, 2),
      );
    } finally {
      archive.cleanup();
    }
  } finally {
    await releaseLock();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
