import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const command = process.argv[2] || "";
const dataDir = process.env.DATA_DIR || "/data";
const snapshotDir = process.env.SNAPSHOT_DIR || "/snapshots";
const runtimeEnvironmentId = process.env.RUNTIME_ENVIRONMENT_ID || "";
const runtimeKind = process.env.RUNTIME_KIND || "";
const runtimeName = process.env.RUNTIME_NAME || "";
const runtimeInstanceId = process.env.RUNTIME_INSTANCE_ID || "";
const runtimeVersion = process.env.RUNTIME_VERSION || "";
const runtimeImageDigest = process.env.RUNTIME_IMAGE_DIGEST || "";
const worldAddress = process.env.WORLD_ADDRESS || "";
const retainCount = Number(process.env.SNAPSHOT_RETAIN || "12");
const maxConsecutiveFailures = positiveInteger(process.env.SNAPSHOT_MAX_CONSECUTIVE_FAILURES, 3);
const retrySeconds = positiveInteger(process.env.SNAPSHOT_RETRY_SECONDS, 15);
const snapshotFormatVersion = 2;
const mdbxCopyCommand = process.env.MDBX_COPY_BIN || "mdbx_copy";
const sqliteCommand = process.env.SQLITE_BIN || "sqlite3";
const tarCommand = process.env.TAR_BIN || "tar";

async function main() {
  switch (command) {
    case "snapshot-once":
      await createRecordedSnapshot("checkpoint");
      return;
    case "checkpoint":
      await createCorrelatedCheckpoint(process.argv[3]);
      return;
    case "snapshot-loop":
      await runSnapshotLoop();
      return;
    case "restore":
      await restoreNewestMatchingSnapshot();
      return;
    case "lease-heartbeat":
      await runSnapshotLeaseHeartbeat(process.argv[3], process.argv[4]);
      return;
    default:
      throw new Error(`Unsupported snapshot command: ${command}`);
  }
}

async function createCorrelatedCheckpoint(correlationId) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(correlationId || "")) {
    throw new Error("checkpoint requires a UUID v4 correlation ID");
  }

  const snapshot = await createRecordedSnapshot("deployer-checkpoint");
  const marker = {
    schemaVersion: 1,
    correlationId,
    runtimeInstanceId,
    createdAt: snapshot.timestamp,
    artifact: path.basename(snapshot.artifactPath),
    checksum: snapshot.checksum,
  };
  const markerDirectory = path.join(snapshotDir, "checkpoint-markers");
  const markerPath = path.join(markerDirectory, `${correlationId}.json`);
  await fs.mkdir(markerDirectory, { recursive: true });
  await fs.writeFile(markerPath, `${JSON.stringify(marker, null, 2)}\n`, { flag: "wx" });
  console.log(`checkpoint-complete:${correlationId} checksum=${snapshot.checksum}`);
}

async function runSnapshotLoop() {
  const intervalMs = positiveInteger(process.env.SNAPSHOT_INTERVAL_SECONDS, 300) * 1000;
  let consecutiveFailures = 0;

  for (;;) {
    await delay(consecutiveFailures === 0 ? intervalMs : retrySeconds * 1000);

    try {
      await createRecordedSnapshot("scheduled", consecutiveFailures);
      consecutiveFailures = 0;
    } catch (error) {
      consecutiveFailures += 1;
      if (consecutiveFailures >= maxConsecutiveFailures) {
        throw new Error(
          `snapshot supervisor stopped after ${consecutiveFailures} consecutive failures: ${errorMessage(error)}`,
        );
      }
    }
  }
}

async function createRecordedSnapshot(trigger, previousFailureCount = 0) {
  try {
    const snapshot = await createSnapshot();
    const status = {
      state: "healthy",
      trigger,
      lastSuccessAt: snapshot.timestamp,
      artifact: path.basename(snapshot.artifactPath),
      checksum: snapshot.checksum,
      consecutiveFailures: 0,
    };
    await writeSnapshotStatus(status);
    logSnapshotEvent("snapshot_succeeded", status);
    return snapshot;
  } catch (error) {
    const previousStatus = await readSnapshotStatus();
    const status = {
      state: "failed",
      trigger,
      lastFailureAt: new Date().toISOString(),
      consecutiveFailures: previousFailureCount + 1,
      freshnessSeconds: resolveSnapshotFreshnessSeconds(previousStatus.lastSuccessAt),
      error: errorMessage(error),
    };
    await writeSnapshotStatus(status);
    logSnapshotEvent("snapshot_failed", status);
    throw error;
  }
}

async function createSnapshot() {
  await fs.mkdir(snapshotDir, { recursive: true });
  return withSnapshotLease(async () => {
    const timestamp = resolveSnapshotTimestamp();
    const snapshotWrite = buildSnapshotWrite(timestamp);

    await resetSnapshotWrite(snapshotWrite);

    try {
      const checksum = await writeSnapshotArtifact(snapshotWrite, timestamp);
      await commitSnapshotWrite(snapshotWrite, timestamp);
      await pruneOldSnapshots();
      return { timestamp, checksum, artifactPath: snapshotWrite.finalArtifactPath };
    } catch (error) {
      await discardSnapshotWrite(snapshotWrite);
      throw error;
    }
  });
}

async function withSnapshotLease(operation) {
  const leasePath = path.join(snapshotDir, ".checkpoint-lock");
  await acquireSnapshotLease(leasePath);
  let heartbeat;
  try {
    heartbeat = await startSnapshotLeaseHeartbeat(leasePath);
    return await operation();
  } finally {
    try {
      if (heartbeat) {
        await stopSnapshotLeaseHeartbeat(heartbeat);
      }
    } finally {
      await fs.rm(leasePath, { recursive: true, force: true });
    }
  }
}

async function startSnapshotLeaseHeartbeat(leasePath) {
  const staleSeconds = positiveInteger(process.env.SNAPSHOT_LOCK_STALE_SECONDS, 900);
  const configuredSeconds = positiveInteger(process.env.SNAPSHOT_LOCK_HEARTBEAT_SECONDS, 30);
  const heartbeatSeconds = Math.min(configuredSeconds, Math.max(1, Math.floor(staleSeconds / 3)));
  const heartbeat = spawn(process.execPath, [process.argv[1], "lease-heartbeat", leasePath, String(heartbeatSeconds)], {
    stdio: "ignore",
  });
  await waitForChildSpawn(heartbeat);
  return heartbeat;
}

async function stopSnapshotLeaseHeartbeat(heartbeat) {
  if (heartbeat.exitCode !== null || heartbeat.signalCode !== null) {
    return;
  }

  const exited = new Promise((resolve) => heartbeat.once("exit", resolve));
  heartbeat.kill("SIGKILL");
  await exited;
}

function waitForChildSpawn(child) {
  return new Promise((resolve, reject) => {
    child.once("spawn", resolve);
    child.once("error", reject);
  });
}

async function runSnapshotLeaseHeartbeat(leasePath, intervalValue) {
  if (!path.isAbsolute(leasePath || "")) {
    throw new Error("snapshot lease heartbeat requires an absolute lease path");
  }

  const intervalMs = positiveInteger(intervalValue, 30) * 1000;
  for (;;) {
    await delay(intervalMs);
    try {
      const now = new Date();
      await fs.utimes(leasePath, now, now);
    } catch (error) {
      if (error?.code === "ENOENT") {
        return;
      }
      throw error;
    }
  }
}

async function acquireSnapshotLease(leasePath) {
  const timeoutMs = positiveInteger(process.env.SNAPSHOT_LOCK_TIMEOUT_SECONDS, 120) * 1000;
  const staleMs = positiveInteger(process.env.SNAPSHOT_LOCK_STALE_SECONDS, 900) * 1000;
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    try {
      await fs.mkdir(leasePath);
      await fs.writeFile(
        path.join(leasePath, "owner.json"),
        `${JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() })}\n`,
      );
      return;
    } catch (error) {
      if (error?.code !== "EEXIST") {
        throw error;
      }

      await removeStaleSnapshotLease(leasePath, staleMs);
      if (Date.now() >= deadline) {
        throw new Error(`timed out waiting for the snapshot checkpoint lease after ${timeoutMs / 1000} seconds`);
      }
      await delay(250);
    }
  }
}

async function removeStaleSnapshotLease(leasePath, staleMs) {
  try {
    const stat = await fs.stat(leasePath);
    if (Date.now() - stat.mtimeMs > staleMs) {
      await fs.rm(leasePath, { recursive: true, force: true });
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
}

function buildSnapshotWrite(timestamp) {
  const artifactName = buildSnapshotArtifactName(timestamp);
  const finalArtifactPath = path.join(snapshotDir, artifactName);
  const tempPath = path.join(snapshotDir, `.tmp-${artifactName}-${process.pid}`);

  return {
    finalArtifactPath,
    finalMetadataPath: resolveSnapshotMetadataPath(finalArtifactPath),
    tempPath,
    tempDataPath: path.join(tempPath, "data"),
    tempArtifactPath: path.join(tempPath, artifactName),
    tempMetadataPath: path.join(tempPath, resolveSnapshotMetadataName(artifactName)),
  };
}

async function resetSnapshotWrite(snapshotWrite) {
  await discardSnapshotWrite(snapshotWrite);
  await fs.mkdir(snapshotWrite.tempDataPath, { recursive: true });
}

async function writeSnapshotArtifact(snapshotWrite, timestamp) {
  await snapshotRuntimeData(snapshotWrite.tempDataPath);
  await archiveSnapshotData(snapshotWrite.tempDataPath, snapshotWrite.tempArtifactPath);
  const checksum = await checksumFile(snapshotWrite.tempArtifactPath);
  await writeSnapshotMetadata(snapshotWrite.tempMetadataPath, { timestamp, checksum });
  return checksum;
}

async function commitSnapshotWrite(snapshotWrite, timestamp) {
  await fs.rename(snapshotWrite.tempArtifactPath, snapshotWrite.finalArtifactPath);
  await fs.rename(snapshotWrite.tempMetadataPath, snapshotWrite.finalMetadataPath);
  await discardSnapshotWrite(snapshotWrite);
  await writeLatestSnapshotPointer(snapshotWrite.finalArtifactPath, timestamp);
}

async function discardSnapshotWrite(snapshotWrite) {
  await fs.rm(snapshotWrite.tempPath, { recursive: true, force: true });
}

async function snapshotRuntimeData(destinationDataDir) {
  if (runtimeKind === "torii") {
    await snapshotToriiData(destinationDataDir);
    return;
  }

  if (runtimeKind === "katana") {
    await snapshotKatanaData(destinationDataDir);
    return;
  }

  await copyDirectoryContents(dataDir, destinationDataDir);
}

async function snapshotToriiData(destinationDataDir) {
  const databases = await listSqliteDatabases(path.join(dataDir, "torii"));
  const excludedFiles = buildSqliteSnapshotExclusionSet(databases);

  await copyDirectoryContents(dataDir, destinationDataDir, {
    shouldCopyFile: (sourcePath) => !excludedFiles.has(sourcePath),
  });

  for (const databasePath of databases) {
    await backupSqliteDatabase(databasePath, path.join(destinationDataDir, path.relative(dataDir, databasePath)));
  }
}

async function snapshotKatanaData(destinationDataDir) {
  const sourcePath = path.join(dataDir, "katana");
  const destinationPath = path.join(destinationDataDir, "katana");

  if (!(await pathExists(sourcePath))) {
    return;
  }

  if (commandExists(mdbxCopyCommand)) {
    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    runRequiredCommand(mdbxCopyCommand, ["-c", sourcePath, destinationPath]);
    return;
  }

  await copyKatanaDataWithPausedRuntime(sourcePath, destinationPath);
}

async function copyKatanaDataWithPausedRuntime(sourcePath, destinationPath) {
  const runtimePid = Number(process.env.RUNTIME_PID || "0");
  if (!Number.isInteger(runtimePid) || runtimePid <= 0) {
    await copyDirectoryContents(sourcePath, destinationPath);
    return;
  }

  process.kill(runtimePid, "SIGSTOP");
  try {
    await copyDirectoryContents(sourcePath, destinationPath);
  } finally {
    process.kill(runtimePid, "SIGCONT");
  }
}

async function backupSqliteDatabase(sourcePath, destinationPath) {
  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  runRequiredCommand(sqliteCommand, [sourcePath, `VACUUM INTO '${toSqliteStringLiteralValue(destinationPath)}'`]);
}

async function archiveSnapshotData(sourceDataDir, destinationArtifactPath) {
  await fs.mkdir(path.dirname(destinationArtifactPath), { recursive: true });
  runRequiredCommand(tarCommand, ["--zstd", "-cf", destinationArtifactPath, "-C", sourceDataDir, "."]);
}

async function extractSnapshotData(snapshot, restorePath) {
  if (snapshot.artifactPath) {
    runRequiredCommand(tarCommand, ["--zstd", "-xf", snapshot.artifactPath, "-C", restorePath]);
    return;
  }

  await copyDirectoryContents(path.join(snapshot.path, "data"), restorePath);
}

async function listSqliteDatabases(directory) {
  const candidates = (await listFiles(directory)).filter((file) => file.endsWith(".db"));
  const checks = await Promise.all(
    candidates.map(async (file) => ((await hasSqliteHeader(file)) ? file : undefined)),
  );

  return checks.filter((file) => file !== undefined);
}

function buildSqliteSnapshotExclusionSet(databases) {
  return new Set(databases.flatMap((database) => [database, `${database}-wal`, `${database}-shm`]));
}

async function hasSqliteHeader(filePath) {
  const handle = await fs.open(filePath, "r");
  try {
    const header = Buffer.alloc(16);
    const result = await handle.read(header, 0, header.length, 0);
    return result.bytesRead === header.length && header.toString("utf8") === "SQLite format 3\0";
  } finally {
    await handle.close();
  }
}

function toSqliteStringLiteralValue(value) {
  return value.replace(/'/g, "''");
}

function commandExists(commandName) {
  return spawnSync("sh", ["-c", 'command -v "$1"', "sh", commandName], { stdio: "ignore" }).status === 0;
}

function runRequiredCommand(commandName, args) {
  const result = spawnSync(commandName, args, { encoding: "utf8" });
  if ((result.status ?? 1) !== 0) {
    const output = [result.stderr, result.stdout].filter(Boolean).join("\n").trim();
    throw new Error(`${commandName} failed${output ? `: ${output}` : ""}`);
  }
}

async function restoreNewestMatchingSnapshot() {
  if (!(await isRuntimeDataDirectoryEmpty())) {
    console.log("snapshot-restore-skipped: runtime data directory is not empty");
    return;
  }

  const snapshot = await findNewestMatchingSnapshot();
  if (!snapshot) {
    console.log("snapshot-restore-skipped: no matching snapshot found");
    return;
  }

  await restoreSnapshot(snapshot);
  logRestoredSnapshot(snapshot);
}

function logRestoredSnapshot(snapshot) {
  console.log(
    [
      `snapshot-restored: ${resolveSnapshotCreatedAt(snapshot.metadata)}`,
      `environment=${runtimeEnvironmentId}`,
      `runtime=${runtimeName}`,
      `kind=${runtimeKind}`,
    ].join(" "),
  );
}

async function findNewestMatchingSnapshot() {
  const pointedSnapshot = await readLatestSnapshotPointerTarget();
  if (pointedSnapshot && (await snapshotMatchesRuntime(pointedSnapshot))) {
    return pointedSnapshot;
  }

  return findNewestMatchingSnapshotByDirectoryScan(pointedSnapshot?.storagePath);
}

async function findNewestMatchingSnapshotByDirectoryScan(excludedSnapshotPath) {
  const snapshots = await listCompleteSnapshots();
  for (const snapshot of snapshots.toReversed()) {
    if (snapshot.storagePath === excludedSnapshotPath) {
      continue;
    }

    if (await snapshotMatchesRuntime(snapshot)) {
      return snapshot;
    }
  }

  return undefined;
}

async function readLatestSnapshotPointerTarget() {
  try {
    const pointer = JSON.parse(await fs.readFile(path.join(snapshotDir, "latest.json"), "utf8"));
    if (!isSafeSnapshotName(pointer.snapshot)) {
      return undefined;
    }

    return readSnapshot(path.join(snapshotDir, pointer.snapshot));
  } catch {
    return undefined;
  }
}

function isSafeSnapshotName(snapshotName) {
  return (
    typeof snapshotName === "string" &&
    (snapshotName.endsWith(".tar.zst") || snapshotName.startsWith("snapshot-")) &&
    path.basename(snapshotName) === snapshotName
  );
}

async function snapshotMatchesRuntime(snapshot) {
  if (!isSupportedSnapshotFormat(snapshot.metadata)) {
    logStaleSnapshot(snapshot, "snapshot_format_mismatch");
    return false;
  }

  if (resolveSnapshotKind(snapshot.metadata) !== runtimeKind) {
    logStaleSnapshot(snapshot, "runtime_kind_mismatch");
    return false;
  }

  if (worldAddress && snapshot.metadata.worldAddress !== worldAddress) {
    logStaleSnapshot(snapshot, "world_address_mismatch");
    return false;
  }

  const snapshotRuntimeVersion = resolveSnapshotRuntimeVersion(snapshot.metadata);
  if (runtimeVersion && snapshotRuntimeVersion && snapshotRuntimeVersion !== runtimeVersion) {
    logStaleSnapshot(snapshot, "runtime_version_mismatch");
    return false;
  }

  const snapshotIdentity = resolveSnapshotRuntimeIdentity(snapshot.metadata);
  if (runtimeEnvironmentId && snapshotIdentity.environmentId && snapshotIdentity.environmentId !== runtimeEnvironmentId) {
    logStaleSnapshot(snapshot, "environment_id_mismatch");
    return false;
  }

  if (runtimeName && snapshotIdentity.runtimeName && snapshotIdentity.runtimeName !== runtimeName) {
    logStaleSnapshot(snapshot, "runtime_name_mismatch");
    return false;
  }

  if (runtimeInstanceId && snapshotIdentity.runtimeInstanceId !== runtimeInstanceId) {
    logStaleSnapshot(snapshot, "runtime_instance_id_mismatch");
    return false;
  }

  const checksumMatches = (await checksumSnapshot(snapshot)) === resolveSnapshotChecksum(snapshot.metadata);
  if (!checksumMatches) {
    logInvalidSnapshot(snapshot, "checksum_mismatch");
  }

  return checksumMatches;
}

function logInvalidSnapshot(snapshot, reason) {
  console.log(`invalid-snapshot-ignored: ${resolveSnapshotCreatedAt(snapshot.metadata)} ${reason}`);
}

function logStaleSnapshot(snapshot, reason) {
  console.log(`stale-snapshot-ignored: ${resolveSnapshotCreatedAt(snapshot.metadata)} ${reason}`);
}

async function restoreSnapshot(snapshot) {
  const restoreTargetPath = resolveRuntimeDataPath();
  const restorePath = `${restoreTargetPath}.restore-${process.pid}`;
  await fs.rm(restorePath, { recursive: true, force: true });
  await fs.mkdir(restorePath, { recursive: true });
  try {
    await extractSnapshotData(snapshot, restorePath);
    await fs.mkdir(path.dirname(restoreTargetPath), { recursive: true });
    await fs.rm(restoreTargetPath, { recursive: true, force: true });
    await fs.rename(resolveExtractedRuntimeDataPath(restorePath), restoreTargetPath);
  } finally {
    await fs.rm(restorePath, { recursive: true, force: true });
  }
}

async function pruneOldSnapshots() {
  const snapshots = await listCompleteSnapshots();
  const limit = Number.isInteger(retainCount) && retainCount > 0 ? retainCount : 12;
  const snapshotsToRemove = snapshots.slice(0, Math.max(0, snapshots.length - limit));

  await Promise.all(snapshotsToRemove.map((snapshot) => removeSnapshot(snapshot)));
}

async function listCompleteSnapshots() {
  if (!(await pathExists(snapshotDir))) {
    return [];
  }

  const entries = await fs.readdir(snapshotDir, { withFileTypes: true });
  const snapshots = await Promise.all(
    entries.filter(isSnapshotEntry).map((entry) => readSnapshot(path.join(snapshotDir, entry.name))),
  );

  return snapshots
    .filter((snapshot) => snapshot !== undefined)
    .sort((left, right) => compareSnapshotCreatedAt(left.metadata, right.metadata));
}

function compareSnapshotCreatedAt(left, right) {
  return resolveSnapshotCreatedAt(left).localeCompare(resolveSnapshotCreatedAt(right));
}

function isSnapshotEntry(entry) {
  return (
    (entry.isFile() && entry.name.endsWith(".tar.zst")) ||
    (entry.isDirectory() && entry.name.startsWith("snapshot-"))
  );
}

async function readSnapshot(snapshotPath) {
  try {
    if (snapshotPath.endsWith(".tar.zst")) {
      return readSnapshotArtifact(snapshotPath);
    }

    const metadata = JSON.parse(await fs.readFile(path.join(snapshotPath, "metadata.json"), "utf8"));
    await fs.access(path.join(snapshotPath, "data"));
    return { storagePath: snapshotPath, path: snapshotPath, metadata };
  } catch {
    return undefined;
  }
}

async function readSnapshotArtifact(artifactPath) {
  const metadata = JSON.parse(await fs.readFile(resolveSnapshotMetadataPath(artifactPath), "utf8"));
  await fs.access(artifactPath);
  return { storagePath: artifactPath, artifactPath, metadata };
}

async function writeSnapshotMetadata(metadataPath, options) {
  await fs.writeFile(
    metadataPath,
    `${JSON.stringify(
      {
        snapshotFormatVersion,
        timestamp: options.timestamp,
        createdAt: options.timestamp,
        kind: runtimeKind,
        runtimeKind,
        environmentId: runtimeEnvironmentId,
        runtimeName,
        runtimeInstanceId,
        runtimeVersion,
        imageDigest: runtimeImageDigest,
        worldAddress,
        runtimeIdentity: {
          environmentId: runtimeEnvironmentId,
          runtimeKind,
          runtimeName,
          runtimeInstanceId,
        },
        compatibility: {
          runtimeVersion,
          imageDigest: runtimeImageDigest,
          worldAddress,
        },
        checksum: options.checksum,
        sha256: options.checksum,
      },
      null,
      2,
    )}\n`,
  );
}

function resolveSnapshotChecksum(metadata) {
  return metadata.checksum || metadata.sha256 || "";
}

function resolveSnapshotKind(metadata) {
  return metadata.runtimeKind || metadata.kind || "";
}

function resolveSnapshotRuntimeVersion(metadata) {
  return metadata.compatibility?.runtimeVersion || metadata.runtimeVersion || "";
}

function resolveSnapshotCreatedAt(metadata) {
  return metadata.timestamp || metadata.createdAt || "";
}

function isSupportedSnapshotFormat(metadata) {
  return metadata.snapshotFormatVersion === undefined || metadata.snapshotFormatVersion === snapshotFormatVersion;
}

function resolveSnapshotRuntimeIdentity(metadata) {
  const identity = metadata.runtimeIdentity || {};
  return {
    environmentId: identity.environmentId || metadata.environmentId || "",
    runtimeKind: identity.runtimeKind || resolveSnapshotKind(metadata),
    runtimeName: identity.runtimeName || metadata.runtimeName || "",
    runtimeInstanceId: identity.runtimeInstanceId || metadata.runtimeInstanceId || "",
  };
}

async function writeLatestSnapshotPointer(snapshotArtifactPath, timestamp) {
  const pointerPath = path.join(snapshotDir, "latest.json");
  const tempPointerPath = `${pointerPath}.tmp-${process.pid}`;
  await fs.writeFile(
    tempPointerPath,
    `${JSON.stringify(
      {
        snapshot: path.basename(snapshotArtifactPath),
        timestamp,
      },
      null,
      2,
    )}\n`,
  );
  await fs.rename(tempPointerPath, pointerPath);
}

async function checksumSnapshot(snapshot) {
  if (snapshot.artifactPath) {
    return checksumFile(snapshot.artifactPath);
  }

  return checksumDirectory(path.join(snapshot.path, "data"));
}

async function checksumFile(filePath) {
  const hash = crypto.createHash("sha256");
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

async function checksumDirectory(directory) {
  const hash = crypto.createHash("sha256");
  const files = await listFiles(directory);

  for (const file of files) {
    const relativePath = path.relative(directory, file);
    hash.update(relativePath);
    hash.update("\0");
    for await (const chunk of createReadStream(file)) {
      hash.update(chunk);
    }
    hash.update("\0");
  }

  return hash.digest("hex");
}

async function listFiles(directory) {
  if (!(await pathExists(directory))) {
    return [];
  }

  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return listFiles(entryPath);
      }

      return entry.isFile() ? [entryPath] : [];
    }),
  );

  return files.flat().sort();
}

async function copyDirectoryContents(source, destination, options = {}) {
  await fs.mkdir(destination, { recursive: true });
  if (!(await pathExists(source))) {
    return;
  }

  const entries = await fs.readdir(source, { withFileTypes: true });
  await Promise.all(
    entries.map((entry) => {
      const sourcePath = path.join(source, entry.name);
      const destinationPath = path.join(destination, entry.name);
      if (entry.isDirectory()) {
        return copyDirectoryContents(sourcePath, destinationPath, options);
      }

      if (options.shouldCopyFile && !options.shouldCopyFile(sourcePath)) {
        return Promise.resolve();
      }

      return fs.copyFile(sourcePath, destinationPath);
    }),
  );
}

async function isDirectoryEmpty(directory) {
  if (!(await pathExists(directory))) {
    return true;
  }

  return (await fs.readdir(directory)).length === 0;
}

async function isRuntimeDataDirectoryEmpty() {
  return isDirectoryEmpty(resolveRuntimeDataPath());
}

function resolveRuntimeDataPath() {
  return runtimeKind ? path.join(dataDir, runtimeKind) : dataDir;
}

function resolveExtractedRuntimeDataPath(restorePath) {
  if (!runtimeKind) {
    return restorePath;
  }

  return path.join(restorePath, runtimeKind);
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function resolveSnapshotTimestamp() {
  return process.env.SNAPSHOT_NOW || new Date().toISOString();
}

function sanitizeSnapshotTimestamp(timestamp) {
  return timestamp.replace(/[^0-9A-Za-z-]+/g, "-").replace(/-+$/g, "");
}

function buildSnapshotArtifactName(timestamp) {
  const unixTimestamp = Math.floor(Date.parse(timestamp) / 1000);
  const timestampSegment = Number.isFinite(unixTimestamp) ? String(unixTimestamp) : sanitizeSnapshotTimestamp(timestamp);
  return `${sanitizeSnapshotNameSegment(runtimeKind || "runtime")}-${timestampSegment}.tar.zst`;
}

function sanitizeSnapshotNameSegment(value) {
  return value.replace(/[^0-9A-Za-z-]+/g, "-").replace(/^-+|-+$/g, "") || "runtime";
}

function resolveSnapshotMetadataPath(artifactPath) {
  return path.join(path.dirname(artifactPath), resolveSnapshotMetadataName(path.basename(artifactPath)));
}

function resolveSnapshotMetadataName(artifactName) {
  return artifactName.replace(/\.tar\.zst$/, ".json");
}

async function removeSnapshot(snapshot) {
  if (snapshot.artifactPath) {
    await Promise.all([
      fs.rm(snapshot.artifactPath, { force: true }),
      fs.rm(resolveSnapshotMetadataPath(snapshot.artifactPath), { force: true }),
    ]);
    return;
  }

  await fs.rm(snapshot.path, { recursive: true, force: true });
}

async function writeSnapshotStatus(status) {
  const statusPath = path.join(snapshotDir, "runtime-snapshot-status.json");
  const tempStatusPath = `${statusPath}.tmp-${process.pid}`;
  const current = await readSnapshotStatus();
  const nextStatus = {
    schemaVersion: 1,
    environmentId: runtimeEnvironmentId,
    runtimeKind,
    runtimeName,
    runtimeInstanceId,
    intervalSeconds: positiveInteger(process.env.SNAPSHOT_INTERVAL_SECONDS, 300),
    ...current,
    ...status,
    updatedAt: new Date().toISOString(),
  };
  await fs.writeFile(tempStatusPath, `${JSON.stringify(nextStatus, null, 2)}\n`);
  await fs.rename(tempStatusPath, statusPath);
}

async function readSnapshotStatus() {
  try {
    return JSON.parse(await fs.readFile(path.join(snapshotDir, "runtime-snapshot-status.json"), "utf8"));
  } catch {
    return {};
  }
}

function logSnapshotEvent(event, status) {
  const success = event === "snapshot_succeeded" ? 1 : 0;
  const failure = event === "snapshot_failed" ? 1 : 0;
  console.log(
    JSON.stringify({
      _aws: {
        Timestamp: Date.now(),
        CloudWatchMetrics: [
          {
            Namespace: "Eternum/AwsRuntime",
            Dimensions: [["EnvironmentId", "RuntimeKind", "RuntimeName", "RuntimeInstanceId"]],
            Metrics: [
              { Name: "SnapshotSuccess", Unit: "Count" },
              { Name: "SnapshotFailure", Unit: "Count" },
              { Name: "SnapshotFreshnessSeconds", Unit: "Seconds" },
            ],
          },
        ],
      },
      EnvironmentId: runtimeEnvironmentId,
      RuntimeKind: runtimeKind,
      RuntimeName: runtimeName,
      RuntimeInstanceId: runtimeInstanceId || "legacy",
      SnapshotSuccess: success,
      SnapshotFailure: failure,
      SnapshotFreshnessSeconds: status.freshnessSeconds || 0,
      event,
      environmentId: runtimeEnvironmentId,
      runtimeKind,
      runtimeName,
      runtimeInstanceId,
      ...status,
    }),
  );
}

function resolveSnapshotFreshnessSeconds(lastSuccessAt) {
  const lastSuccessAtMs = Date.parse(lastSuccessAt || "");
  return Number.isFinite(lastSuccessAtMs) ? Math.max(0, Math.floor((Date.now() - lastSuccessAtMs) / 1000)) : 0;
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
