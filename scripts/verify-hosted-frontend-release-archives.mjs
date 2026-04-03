#!/usr/bin/env node

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  calculateFileSha256,
  downloadFileFromS3,
  listArchivedReleases,
  listRemoteArchivedReleases,
  releaseArchiveZipFileName,
} from "./amplify-frontend-release-lib.mjs";

function parseArgs(argv) {
  const args = {
    environment: "all",
    region: process.env.AWS_DEFAULT_REGION || process.env.AWS_REGION || "eu-west-2",
    releaseId: null,
    skipZipDownload: false,
    requireRemote: false,
    requireValid: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    switch (current) {
      case "--environment":
        args.environment = next;
        index += 1;
        break;
      case "--region":
        args.region = next;
        index += 1;
        break;
      case "--release-id":
        args.releaseId = next;
        index += 1;
        break;
      case "--skip-zip-download":
        args.skipZipDownload = true;
        break;
      case "--require-remote":
        args.requireRemote = true;
        break;
      case "--require-valid":
        args.requireValid = true;
        break;
      default:
        throw new Error(`Unsupported argument: ${current}`);
    }
  }

  if (!["all", "staging", "production"].includes(args.environment)) {
    throw new Error("--environment must be one of: all, staging, production.");
  }

  return args;
}

function buildKey(release) {
  return `${release.environmentName}:${release.releaseId}`;
}

function filterByReleaseId(releases, releaseId) {
  return releaseId
    ? releases.filter((release) => release.releaseId === releaseId)
    : releases;
}

function buildComparableSignature(release) {
  return {
    releaseId: release.releaseId ?? null,
    environmentName: release.environmentName ?? null,
    sourceVersion: release.build?.sourceVersion ?? null,
    amplifyJobId: release.hosting?.amplifyJobId ?? null,
    archiveZipSha256: release.archive?.archiveZipSha256 ?? null,
    archiveZipSizeBytes: release.archive?.archiveZipSizeBytes ?? null,
    remoteBucketName: release.remoteArchive?.bucketName ?? null,
    remoteZipObjectKey: release.remoteArchive?.zipObjectKey ?? null,
    remoteMetadataObjectKey: release.remoteArchive?.metadataObjectKey ?? null,
  };
}

function signaturesMatch(left, right) {
  return JSON.stringify(buildComparableSignature(left)) === JSON.stringify(buildComparableSignature(right));
}

function resolveExpectedSha(localRelease, remoteRelease) {
  return (
    localRelease?.archive?.archiveZipSha256 ??
    remoteRelease?.archive?.archiveZipSha256 ??
    null
  );
}

function resolveRemoteStorage(localRelease, remoteRelease) {
  return {
    bucketName:
      remoteRelease?.remoteArchive?.bucketName ??
      localRelease?.remoteArchive?.bucketName ??
      null,
    zipObjectKey:
      remoteRelease?.remoteArchive?.zipObjectKey ??
      localRelease?.remoteArchive?.zipObjectKey ??
      null,
    metadataObjectKey:
      remoteRelease?.remoteArchive?.metadataObjectKey ??
      localRelease?.remoteArchive?.metadataObjectKey ??
      null,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const localReleases = filterByReleaseId(
    listArchivedReleases({
      environmentName: args.environment,
    }),
    args.releaseId,
  );
  const remoteReleases = filterByReleaseId(
    listRemoteArchivedReleases({
      environmentName: args.environment,
      region: args.region,
    }),
    args.releaseId,
  );

  const localMap = new Map(localReleases.map((release) => [buildKey(release), release]));
  const remoteMap = new Map(remoteReleases.map((release) => [buildKey(release), release]));
  const keys = [...new Set([...localMap.keys(), ...remoteMap.keys()])].sort();
  const tempDir = mkdtempSync(path.join(tmpdir(), "lightning-release-verify-"));

  try {
    const results = keys.map((key) => {
      const localRelease = localMap.get(key) ?? null;
      const remoteRelease = remoteMap.get(key) ?? null;
      const storage = resolveRemoteStorage(localRelease, remoteRelease);
      const remotePresent = Boolean(remoteRelease);
      const localPresent = Boolean(localRelease);
      const metadataConsistent =
        localRelease && remoteRelease ? signaturesMatch(localRelease, remoteRelease) : remotePresent;
      let remoteZipSha256 = null;
      let zipIntegrityValid = remotePresent;

      if (!args.skipZipDownload && remotePresent && storage.bucketName && storage.zipObjectKey) {
        const downloadPath = path.join(
          tempDir,
          `${key.replace(/[:/]/gu, "_")}-${releaseArchiveZipFileName}`,
        );
        downloadFileFromS3({
          bucketName: storage.bucketName,
          key: storage.zipObjectKey,
          filePath: downloadPath,
          region: args.region,
        });
        remoteZipSha256 = calculateFileSha256(downloadPath);
        const expectedSha = resolveExpectedSha(localRelease, remoteRelease);
        zipIntegrityValid = Boolean(expectedSha) && remoteZipSha256 === expectedSha;
      }

      const expectedSha = resolveExpectedSha(localRelease, remoteRelease);

      return {
        releaseId: localRelease?.releaseId ?? remoteRelease?.releaseId ?? null,
        environmentName:
          localRelease?.environmentName ?? remoteRelease?.environmentName ?? null,
        builtAt: localRelease?.builtAt ?? remoteRelease?.builtAt ?? null,
        storagePresence: {
          local: localPresent,
          remote: remotePresent,
        },
        metadataConsistent,
        zipIntegrityChecked: !args.skipZipDownload && remotePresent,
        zipIntegrityValid,
        expectedZipSha256: expectedSha,
        remoteZipSha256,
        remoteBucketName: storage.bucketName,
        remoteZipObjectKey: storage.zipObjectKey,
        remoteMetadataObjectKey: storage.metadataObjectKey,
      };
    });

    const remotePresenceComplete = results.every(
      (result) => !args.requireRemote || result.storagePresence.remote,
    );
    const metadataConsistencyComplete = results.every(
      (result) => result.metadataConsistent,
    );
    const zipIntegrityComplete = results.every(
      (result) =>
        result.storagePresence.remote
          ? args.skipZipDownload || result.zipIntegrityValid
          : !args.requireRemote,
    );
    const allClear =
      remotePresenceComplete && metadataConsistencyComplete && zipIntegrityComplete;

    const summary = {
      observedAt: new Date().toISOString(),
      environmentName: args.environment,
      region: args.region,
      releaseId: args.releaseId,
      skipZipDownload: args.skipZipDownload,
      requireRemote: args.requireRemote,
      requireValid: args.requireValid,
      count: results.length,
      remotePresenceComplete,
      metadataConsistencyComplete,
      zipIntegrityComplete,
      allClear,
      results,
    };

    console.log(JSON.stringify(summary, null, 2));

    if ((args.requireRemote && !remotePresenceComplete) || (args.requireValid && !allClear)) {
      process.exitCode = 1;
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(
    "Hosted frontend archive verification failed:",
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});
