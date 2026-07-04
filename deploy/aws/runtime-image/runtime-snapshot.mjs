import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const command = process.argv[2] || "";
const dataDir = process.env.DATA_DIR || "/data";
const snapshotDir = process.env.SNAPSHOT_DIR || "/snapshots";
const runtimeEnvironmentId = process.env.RUNTIME_ENVIRONMENT_ID || "";
const runtimeKind = process.env.RUNTIME_KIND || "";
const runtimeName = process.env.RUNTIME_NAME || "";
const runtimeVersion = process.env.RUNTIME_VERSION || "";
const worldAddress = process.env.WORLD_ADDRESS || "";
const retainCount = Number(process.env.SNAPSHOT_RETAIN || "3");
const mdbxCopyCommand = process.env.MDBX_COPY_BIN || "mdbx_copy";
const sqliteCommand = process.env.SQLITE_BIN || "sqlite3";
const tarCommand = process.env.TAR_BIN || "tar";

async function main() {
  switch (command) {
    case "snapshot-once":
      await createSnapshot();
      return;
    case "snapshot-loop":
      await runSnapshotLoop();
      return;
    case "restore":
      await restoreNewestMatchingSnapshot();
      return;
    default:
      throw new Error(`Unsupported snapshot command: ${command}`);
  }
}

async function runSnapshotLoop() {
  const intervalSeconds = Number(process.env.SNAPSHOT_INTERVAL_SECONDS || "300");
  const intervalMs = Math.max(1, intervalSeconds) * 1000;

  for (;;) {
    await delay(intervalMs);
    await createSnapshot();
  }
}

async function createSnapshot() {
  await fs.mkdir(snapshotDir, { recursive: true });

  const timestamp = resolveSnapshotTimestamp();
  const snapshotWrite = buildSnapshotWrite(timestamp);

  await resetSnapshotWrite(snapshotWrite);

  try {
    await writeSnapshotArtifact(snapshotWrite, timestamp);
    await commitSnapshotWrite(snapshotWrite, timestamp);
    await pruneOldSnapshots();
  } catch (error) {
    await discardSnapshotWrite(snapshotWrite);
    throw error;
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
  if (resolveSnapshotKind(snapshot.metadata) !== runtimeKind) {
    logStaleSnapshot(snapshot, "runtime_kind_mismatch");
    return false;
  }

  if (worldAddress && snapshot.metadata.worldAddress !== worldAddress) {
    logStaleSnapshot(snapshot, "world_address_mismatch");
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
  const limit = Number.isInteger(retainCount) && retainCount > 0 ? retainCount : 3;
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
        timestamp: options.timestamp,
        createdAt: options.timestamp,
        kind: runtimeKind,
        runtimeKind,
        runtimeVersion,
        worldAddress,
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

function resolveSnapshotCreatedAt(metadata) {
  return metadata.timestamp || metadata.createdAt || "";
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
  hash.update(await fs.readFile(filePath));
  return hash.digest("hex");
}

async function checksumDirectory(directory) {
  const hash = crypto.createHash("sha256");
  const files = await listFiles(directory);

  for (const file of files) {
    const relativePath = path.relative(directory, file);
    hash.update(relativePath);
    hash.update("\0");
    hash.update(await fs.readFile(file));
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
