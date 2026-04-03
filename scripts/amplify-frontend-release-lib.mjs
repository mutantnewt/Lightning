#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";

export const repoRoot = "/Users/steve/Documents/GitHub/Lightning";
export const frontendDir = path.join(repoRoot, "literary-light");
export const frontendDistDir = path.join(frontendDir, "dist");
export const frontendReleaseArchiveRoot =
  process.env.LIGHTNING_FRONTEND_RELEASE_ARCHIVE_ROOT ??
  path.join(repoRoot, ".local", "frontend-releases");
export const awsCli = "/opt/homebrew/bin/aws";
export const npmCli = "/usr/local/bin/npm";
export const releaseManifestFileName = "lightning-release.json";
export const releaseArchiveMetadataFileName = "release-archive.json";
export const releaseArchiveZipFileName = "frontend-dist.zip";
export const releaseArchiveS3Prefix = "releases";

export function getFrontendStackNameForEnvironment(environmentName) {
  return environmentName === "production"
    ? "LightningProductionFrontendStack"
    : "LightningStagingFrontendStack";
}

export function run(command, commandArgs, options = {}) {
  return execFileSync(command, commandArgs, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
    env: {
      ...process.env,
      ...(options.env ?? {}),
      PATH: `/usr/local/bin:/opt/homebrew/bin:${process.env.PATH ?? ""}`,
    },
  });
}

export function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function getStackOutputs(stackName, region) {
  const raw = run(awsCli, [
    "cloudformation",
    "describe-stacks",
    "--stack-name",
    stackName,
    "--region",
    region,
  ]);
  const parsed = JSON.parse(raw);

  return Object.fromEntries(
    (parsed.Stacks?.[0]?.Outputs ?? []).map((output) => [
      output.OutputKey,
      output.OutputValue,
    ]),
  );
}

export function getReleaseArchiveStorageFromOutputs(outputs, stackName) {
  return {
    bucketName: requireOutput(outputs, "FrontendReleaseArchiveBucketName", stackName),
    objectPrefix: outputs.FrontendReleaseArchivePrefix ?? releaseArchiveS3Prefix,
  };
}

export function buildReleaseArchiveObjectKey(
  releaseId,
  fileName,
  objectPrefix = releaseArchiveS3Prefix,
) {
  return `${objectPrefix}/${releaseId}/${fileName}`;
}

export function requireOutput(outputs, key, stackName) {
  const value = outputs[key];

  if (!value) {
    throw new Error(
      `Stack ${stackName} does not expose required output ${key}. Deploy the frontend hosting stack again before publishing a manual Amplify artifact.`,
    );
  }

  return value;
}

export function resolveFrontendBuildEnv(frontendOutputs, args) {
  return {
    NODE_ENV: "production",
    VITE_APP_ENV: requireOutput(
      frontendOutputs,
      "FrontendEnvironmentName",
      args.stackName,
    ),
    VITE_AWS_REGION: args.region,
    VITE_COGNITO_USER_POOL_ID: requireOutput(
      frontendOutputs,
      "FrontendCognitoUserPoolId",
      args.stackName,
    ),
    VITE_COGNITO_USER_POOL_CLIENT_ID: requireOutput(
      frontendOutputs,
      "FrontendCognitoUserPoolClientId",
      args.stackName,
    ),
    VITE_CATALOG_MODERATOR_GROUP_NAME: requireOutput(
      frontendOutputs,
      "FrontendCatalogModeratorGroupName",
      args.stackName,
    ),
    VITE_API_PUBLIC_BASE_URL: requireOutput(
      frontendOutputs,
      "FrontendApiBaseUrl",
      args.stackName,
    ),
    VITE_API_AUTH_BASE_URL: requireOutput(
      frontendOutputs,
      "FrontendApiBaseUrl",
      args.stackName,
    ),
    VITE_API_PRIVILEGED_BASE_URL: requireOutput(
      frontendOutputs,
      "FrontendApiBaseUrl",
      args.stackName,
    ),
    VITE_SITE_URL: requireOutput(frontendOutputs, "FrontendSiteUrl", args.stackName),
  };
}

export function ensureFrontendBuild(buildEnv) {
  run(npmCli, ["run", "build"], {
    cwd: frontendDir,
    stdio: "inherit",
    env: buildEnv,
  });
}

export function runGit(commandArgs) {
  return run("git", commandArgs, {
    cwd: repoRoot,
  }).trim();
}

export function getGitMetadata() {
  const sourceVersion = runGit(["rev-parse", "HEAD"]);
  const sourceVersionShort = runGit(["rev-parse", "--short", "HEAD"]);
  const sourceBranch = runGit(["rev-parse", "--abbrev-ref", "HEAD"]);
  const dirtyEntries = runGit(["status", "--short"]);
  const dirtyFiles = dirtyEntries
    ? dirtyEntries
        .split(/\r?\n/u)
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];

  return {
    sourceVersion,
    sourceVersionShort,
    sourceBranch,
    sourceDirty: dirtyFiles.length > 0,
    dirtyFileCount: dirtyFiles.length,
  };
}

export function toCompactTimestamp(isoTimestamp) {
  return isoTimestamp.replace(/[-:]/gu, "").replace(/\.\d{3}Z$/u, "Z");
}

export function createReleaseMetadata({
  args,
  stackOutputs,
  buildEnv,
  appId,
  branchName,
  defaultDomain,
  jobId,
}) {
  const builtAt = new Date().toISOString();
  const gitMetadata = getGitMetadata();
  const releaseId = [
    args.environment,
    toCompactTimestamp(builtAt),
    gitMetadata.sourceVersionShort,
  ].join("-");

  return {
    schemaVersion: 1,
    project: "lightning-classics",
    component: "frontend",
    releaseId,
    deployedVia: "manual-amplify",
    environmentName: args.environment,
    builtAt,
    build: gitMetadata,
    hosting: {
      stackName: args.stackName,
      amplifyAppId: appId,
      amplifyBranchName: branchName,
      amplifyDefaultDomain: defaultDomain,
      amplifyWebUrl: defaultDomain ? `https://${branchName}.${defaultDomain}` : null,
      amplifyJobId: jobId,
      siteUrl: buildEnv.VITE_SITE_URL,
    },
    runtime: {
      awsRegion: buildEnv.VITE_AWS_REGION,
      apiPublicBaseUrl: buildEnv.VITE_API_PUBLIC_BASE_URL,
      apiAuthBaseUrl: buildEnv.VITE_API_AUTH_BASE_URL,
      apiPrivilegedBaseUrl: buildEnv.VITE_API_PRIVILEGED_BASE_URL,
      cognitoUserPoolId: buildEnv.VITE_COGNITO_USER_POOL_ID,
      cognitoUserPoolClientId: buildEnv.VITE_COGNITO_USER_POOL_CLIENT_ID,
      catalogModeratorGroupName: buildEnv.VITE_CATALOG_MODERATOR_GROUP_NAME,
      siteUrl: buildEnv.VITE_SITE_URL,
      noCookies: true,
      authStorage: "sessionStorage",
    },
    sourceOfTruth: {
      frontendStackOutputs: {
        FrontendEnvironmentName: stackOutputs.FrontendEnvironmentName ?? null,
        FrontendApiBaseUrl: stackOutputs.FrontendApiBaseUrl ?? null,
        FrontendSiteUrl: stackOutputs.FrontendSiteUrl ?? null,
        FrontendCognitoUserPoolId:
          stackOutputs.FrontendCognitoUserPoolId ?? null,
        FrontendCognitoUserPoolClientId:
          stackOutputs.FrontendCognitoUserPoolClientId ?? null,
        FrontendCatalogModeratorGroupName:
          stackOutputs.FrontendCatalogModeratorGroupName ?? null,
      },
    },
  };
}

export function writeReleaseManifest(releaseMetadata) {
  mkdirSync(frontendDistDir, { recursive: true });
  const releaseManifestPath = path.join(frontendDistDir, releaseManifestFileName);

  writeFileSync(
    releaseManifestPath,
    `${JSON.stringify(releaseMetadata, null, 2)}\n`,
    "utf8",
  );

  return releaseManifestPath;
}

export function createZipArchive(sourceDir) {
  const tempDir = mkdtempSync(path.join(tmpdir(), "lightning-amplify-"));
  const archivePath = path.join(tempDir, releaseArchiveZipFileName);

  run("ditto", ["-c", "-k", "--sequesterRsrc", ".", archivePath], {
    cwd: sourceDir,
  });

  return {
    archivePath,
    cleanup() {
      rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

export function calculateFileSha256(filePath) {
  const contents = readFileSync(filePath);
  return createHash("sha256").update(contents).digest("hex");
}

export function writeArchivedReleaseMetadata(archivedRelease) {
  writeFileSync(
    archivedRelease.archive.archiveMetadataPath,
    `${JSON.stringify(archivedRelease, null, 2)}\n`,
    "utf8",
  );

  return archivedRelease;
}

export function archiveReleasePackage({
  releaseMetadata,
  archivePath,
  archiveRoot = frontendReleaseArchiveRoot,
}) {
  const archiveDir = path.join(
    archiveRoot,
    releaseMetadata.environmentName,
    releaseMetadata.releaseId,
  );
  mkdirSync(archiveDir, { recursive: true });

  const archivedZipPath = path.join(archiveDir, releaseArchiveZipFileName);
  copyFileSync(archivePath, archivedZipPath);

  const archiveMetadata = {
    ...releaseMetadata,
    archive: {
      archiveDir,
      archiveZipPath: archivedZipPath,
      archiveMetadataPath: path.join(archiveDir, releaseArchiveMetadataFileName),
      archiveZipSizeBytes: statSync(archivedZipPath).size,
      archiveZipSha256: calculateFileSha256(archivedZipPath),
      archivedAt: new Date().toISOString(),
    },
  };

  return writeArchivedReleaseMetadata(archiveMetadata);
}

export async function uploadZip(uploadUrl, archivePath) {
  const body = readFileSync(archivePath);
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "content-length": String(statSync(archivePath).size),
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Amplify zip upload failed: ${response.status} ${text}`);
  }
}

export function uploadFileToS3({
  bucketName,
  key,
  filePath,
  region,
  contentType,
}) {
  const commandArgs = [
    "s3api",
    "put-object",
    "--bucket",
    bucketName,
    "--key",
    key,
    "--body",
    filePath,
    "--region",
    region,
  ];

  if (contentType) {
    commandArgs.push("--content-type", contentType);
  }

  return JSON.parse(run(awsCli, commandArgs));
}

export function downloadFileFromS3({
  bucketName,
  key,
  filePath,
  region,
}) {
  return JSON.parse(
    run(awsCli, [
      "s3api",
      "get-object",
      "--bucket",
      bucketName,
      "--key",
      key,
      filePath,
      "--region",
      region,
    ]),
  );
}

export function listObjectsInS3Prefix({
  bucketName,
  prefix,
  region,
}) {
  return JSON.parse(
    run(awsCli, [
      "s3api",
      "list-objects-v2",
      "--bucket",
      bucketName,
      "--prefix",
      prefix,
      "--region",
      region,
    ]),
  );
}

export function createDeployment(appId, branchName, region) {
  return JSON.parse(
    run(awsCli, [
      "amplify",
      "create-deployment",
      "--app-id",
      appId,
      "--branch-name",
      branchName,
      "--region",
      region,
    ]),
  );
}

export function startDeployment(appId, branchName, jobId, region) {
  return JSON.parse(
    run(awsCli, [
      "amplify",
      "start-deployment",
      "--app-id",
      appId,
      "--branch-name",
      branchName,
      "--job-id",
      jobId,
      "--region",
      region,
    ]),
  );
}

export function getJob(appId, branchName, jobId, region) {
  return JSON.parse(
    run(awsCli, [
      "amplify",
      "get-job",
      "--app-id",
      appId,
      "--branch-name",
      branchName,
      "--job-id",
      jobId,
      "--region",
      region,
    ]),
  );
}

export async function waitForJob(
  appId,
  branchName,
  jobId,
  region,
  timeoutMs,
  pollIntervalMs,
) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const jobResponse = getJob(appId, branchName, jobId, region);
    const summary = jobResponse.job?.summary ?? {};
    const status = summary.status ?? "UNKNOWN";

    if (["SUCCEED", "FAILED", "CANCELLED"].includes(status)) {
      return {
        status,
        summary,
      };
    }

    await sleep(pollIntervalMs);
  }

  throw new Error(`Timed out waiting for Amplify job ${jobId}`);
}

export async function deployArchiveToAmplify({
  appId,
  branchName,
  region,
  archivePath,
  waitTimeoutMs,
  pollIntervalMs,
}) {
  const deployment = createDeployment(appId, branchName, region);
  const jobId = deployment.jobId;
  const uploadUrl = deployment.zipUploadUrl;

  if (!jobId || !uploadUrl) {
    throw new Error("Amplify create-deployment did not return jobId and zipUploadUrl.");
  }

  await uploadZip(uploadUrl, archivePath);
  startDeployment(appId, branchName, jobId, region);

  const result = await waitForJob(
    appId,
    branchName,
    jobId,
    region,
    waitTimeoutMs,
    pollIntervalMs,
  );

  if (result.status !== "SUCCEED") {
    throw new Error(
      `Amplify deployment finished with status ${result.status}. Job summary: ${JSON.stringify(
        result.summary,
      )}`,
    );
  }

  return {
    jobId,
    result,
  };
}

export function uploadArchivedReleaseToS3({
  archivedRelease,
  bucketName,
  objectPrefix = releaseArchiveS3Prefix,
  region,
}) {
  const zipObjectKey = buildReleaseArchiveObjectKey(
    archivedRelease.releaseId,
    releaseArchiveZipFileName,
    objectPrefix,
  );
  uploadFileToS3({
    bucketName,
    key: zipObjectKey,
    filePath: archivedRelease.archive.archiveZipPath,
    region,
    contentType: "application/zip",
  });

  const remoteArchive = {
    bucketName,
    objectPrefix,
    zipObjectKey,
    metadataObjectKey: buildReleaseArchiveObjectKey(
      archivedRelease.releaseId,
      releaseArchiveMetadataFileName,
      objectPrefix,
    ),
    uploadedAt: new Date().toISOString(),
  };

  const archiveWithRemote = writeArchivedReleaseMetadata({
    ...archivedRelease,
    remoteArchive,
  });

  uploadFileToS3({
    bucketName,
    key: remoteArchive.metadataObjectKey,
    filePath: archiveWithRemote.archive.archiveMetadataPath,
    region,
    contentType: "application/json",
  });

  return archiveWithRemote;
}

export function getReleaseArchiveDir(environmentName, releaseId, archiveRoot = frontendReleaseArchiveRoot) {
  return path.join(archiveRoot, environmentName, releaseId);
}

export function readArchivedReleaseMetadata({
  environmentName,
  releaseId,
  archiveRoot = frontendReleaseArchiveRoot,
}) {
  const archiveDir = getReleaseArchiveDir(environmentName, releaseId, archiveRoot);
  const metadataPath = path.join(archiveDir, releaseArchiveMetadataFileName);

  if (!existsSync(metadataPath)) {
    throw new Error(
      `Archived release metadata not found for ${environmentName}/${releaseId} at ${metadataPath}.`,
    );
  }

  return JSON.parse(readFileSync(metadataPath, "utf8"));
}

export function syncRemoteArchivedReleaseToLocal({
  environmentName,
  releaseId,
  bucketName,
  objectPrefix = releaseArchiveS3Prefix,
  region,
  archiveRoot = frontendReleaseArchiveRoot,
}) {
  const archiveDir = getReleaseArchiveDir(environmentName, releaseId, archiveRoot);
  mkdirSync(archiveDir, { recursive: true });

  const metadataPath = path.join(archiveDir, releaseArchiveMetadataFileName);
  const archiveZipPath = path.join(archiveDir, releaseArchiveZipFileName);
  const metadataObjectKey = buildReleaseArchiveObjectKey(
    releaseId,
    releaseArchiveMetadataFileName,
    objectPrefix,
  );
  const zipObjectKey = buildReleaseArchiveObjectKey(
    releaseId,
    releaseArchiveZipFileName,
    objectPrefix,
  );

  downloadFileFromS3({
    bucketName,
    key: metadataObjectKey,
    filePath: metadataPath,
    region,
  });
  downloadFileFromS3({
    bucketName,
    key: zipObjectKey,
    filePath: archiveZipPath,
    region,
  });

  return JSON.parse(readFileSync(metadataPath, "utf8"));
}

export function resolveArchivedReleaseMetadata({
  environmentName,
  releaseId,
  region,
  stackName,
  archiveRoot = frontendReleaseArchiveRoot,
}) {
  try {
    return readArchivedReleaseMetadata({
      environmentName,
      releaseId,
      archiveRoot,
    });
  } catch (error) {
    const stackOutputs = getStackOutputs(stackName, region);
    const storage = getReleaseArchiveStorageFromOutputs(stackOutputs, stackName);

    return syncRemoteArchivedReleaseToLocal({
      environmentName,
      releaseId,
      bucketName: storage.bucketName,
      objectPrefix: storage.objectPrefix,
      region,
      archiveRoot,
    });
  }
}

export function listArchivedReleases({
  environmentName = "all",
  archiveRoot = frontendReleaseArchiveRoot,
}) {
  const environmentNames =
    environmentName === "all" ? ["staging", "production"] : [environmentName];
  const results = [];

  for (const currentEnvironment of environmentNames) {
    const environmentDir = path.join(archiveRoot, currentEnvironment);

    if (!existsSync(environmentDir)) {
      continue;
    }

    for (const releaseId of readdirSync(environmentDir).sort().reverse()) {
      const metadataPath = path.join(
        environmentDir,
        releaseId,
        releaseArchiveMetadataFileName,
      );

      if (!existsSync(metadataPath)) {
        continue;
      }

      const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
      results.push(metadata);
    }
  }

  return results;
}

export function listRemoteArchivedReleases({
  environmentName = "all",
  region,
}) {
  const environmentNames =
    environmentName === "all" ? ["staging", "production"] : [environmentName];
  const results = [];

  for (const currentEnvironment of environmentNames) {
    const stackName = getFrontendStackNameForEnvironment(currentEnvironment);
    const stackOutputs = getStackOutputs(stackName, region);
    const storage = getReleaseArchiveStorageFromOutputs(stackOutputs, stackName);
    const listing = listObjectsInS3Prefix({
      bucketName: storage.bucketName,
      prefix: `${storage.objectPrefix}/`,
      region,
    });
    const metadataKeys = (listing.Contents ?? [])
      .map((entry) => entry.Key)
      .filter(
        (key) =>
          typeof key === "string" &&
          key.endsWith(`/${releaseArchiveMetadataFileName}`),
      );
    const tempDir = mkdtempSync(path.join(tmpdir(), "lightning-release-remote-"));

    try {
      for (const key of metadataKeys) {
        const localPath = path.join(
          tempDir,
          `${currentEnvironment}-${path.basename(key)}`,
        );
        downloadFileFromS3({
          bucketName: storage.bucketName,
          key,
          filePath: localPath,
          region,
        });
        results.push(JSON.parse(readFileSync(localPath, "utf8")));
      }
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }

  return results;
}
