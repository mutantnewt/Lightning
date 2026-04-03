#!/usr/bin/env node

import {
  frontendReleaseArchiveRoot,
  getFrontendStackNameForEnvironment,
  getReleaseArchiveStorageFromOutputs,
  getStackOutputs,
  listArchivedReleases,
  listRemoteArchivedReleases,
  readArchivedReleaseMetadata,
  uploadArchivedReleaseToS3,
} from "./amplify-frontend-release-lib.mjs";

function parseArgs(argv) {
  const options = {
    environment: "all",
    region: "eu-west-2",
    releaseId: null,
    force: false,
    dryRun: false,
    archiveRoot: frontendReleaseArchiveRoot,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--environment") {
      options.environment = argv[index + 1] ?? options.environment;
      index += 1;
      continue;
    }

    if (token === "--region") {
      options.region = argv[index + 1] ?? options.region;
      index += 1;
      continue;
    }

    if (token === "--release-id") {
      options.releaseId = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (token === "--archive-root") {
      options.archiveRoot = argv[index + 1] ?? options.archiveRoot;
      index += 1;
      continue;
    }

    if (token === "--force") {
      options.force = true;
      continue;
    }

    if (token === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  if (!["all", "staging", "production"].includes(options.environment)) {
    throw new Error(
      `Unsupported environment "${options.environment}". Use all, staging, or production.`,
    );
  }

  return options;
}

function buildRemoteIndex(remoteArchives) {
  return new Set(
    remoteArchives.map((archive) => `${archive.environmentName}:${archive.releaseId}`),
  );
}

function sortByBuiltAtDesc(left, right) {
  return (right.builtAt ?? "").localeCompare(left.builtAt ?? "");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const localArchives = listArchivedReleases({
    environmentName: options.environment,
    archiveRoot: options.archiveRoot,
  })
    .filter((archive) =>
      options.releaseId ? archive.releaseId === options.releaseId : true,
    )
    .sort(sortByBuiltAtDesc);
  const remoteArchives = listRemoteArchivedReleases({
    environmentName: options.environment,
    region: options.region,
  });
  const remoteIndex = buildRemoteIndex(remoteArchives);
  const uploaded = [];
  const skipped = [];

  for (const archive of localArchives) {
    const key = `${archive.environmentName}:${archive.releaseId}`;
    const alreadyRemote = remoteIndex.has(key);

    if (alreadyRemote && !options.force) {
      skipped.push({
        environmentName: archive.environmentName,
        releaseId: archive.releaseId,
        reason: "already-remote",
      });
      continue;
    }

    const stackName = getFrontendStackNameForEnvironment(archive.environmentName);
    const outputs = getStackOutputs(stackName, options.region);
    const storage = getReleaseArchiveStorageFromOutputs(outputs, stackName);

    if (options.dryRun) {
      uploaded.push({
        environmentName: archive.environmentName,
        releaseId: archive.releaseId,
        bucketName: storage.bucketName,
        objectPrefix: storage.objectPrefix,
        dryRun: true,
      });
      continue;
    }

    const localMetadata = readArchivedReleaseMetadata({
      environmentName: archive.environmentName,
      releaseId: archive.releaseId,
      archiveRoot: options.archiveRoot,
    });
    const archiveWithRemote = uploadArchivedReleaseToS3({
      archivedRelease: localMetadata,
      bucketName: storage.bucketName,
      objectPrefix: storage.objectPrefix,
      region: options.region,
    });

    uploaded.push({
      environmentName: archive.environmentName,
      releaseId: archive.releaseId,
      bucketName: archiveWithRemote.remoteArchive?.bucketName ?? storage.bucketName,
      zipObjectKey: archiveWithRemote.remoteArchive?.zipObjectKey ?? null,
      metadataObjectKey:
        archiveWithRemote.remoteArchive?.metadataObjectKey ?? null,
      uploadedAt: archiveWithRemote.remoteArchive?.uploadedAt ?? null,
      dryRun: false,
    });
  }

  console.log(
    JSON.stringify(
      {
        observedAt: new Date().toISOString(),
        environmentName: options.environment,
        region: options.region,
        archiveRoot: options.archiveRoot,
        force: options.force,
        dryRun: options.dryRun,
        releaseId: options.releaseId,
        localArchiveCount: localArchives.length,
        remoteArchiveCount: remoteArchives.length,
        uploadedCount: uploaded.length,
        skippedCount: skipped.length,
        uploaded,
        skipped,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("Hosted frontend release archive sync failed:", error);
  process.exitCode = 1;
});
