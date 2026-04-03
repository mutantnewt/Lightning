#!/usr/bin/env node

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

function parseArgs(argv) {
  const args = {
    environment: "staging",
    stackName: null,
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

    console.log(
      JSON.stringify(
        {
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
        },
        null,
        2,
      ),
    );
  } finally {
    archive.cleanup();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
