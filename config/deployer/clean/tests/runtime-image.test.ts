import { spawnSync } from "node:child_process";
import { spawn, type ChildProcess } from "node:child_process";
import * as fs from "node:fs/promises";
import http from "node:http";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, test } from "bun:test";

function renderToriiConfig(env: NodeJS.ProcessEnv): string {
  const result = spawnSync("node", ["deploy/aws/runtime-image/render-torii-config.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      ...env,
    },
  });

  expect(result.status).toBe(0);
  return result.stdout;
}

describe("AWS runtime image scripts", () => {
  test("renders escaped torii TOML scalars and optional world block", () => {
    const output = renderToriiConfig({
      RPC_URL: 'https://rpc.example.test/"quoted"',
      WORLD_ADDRESS: '0xabc"def',
      DATA_DIR: '/data/"quoted"',
      TORII_WORLD_BLOCK: "12345",
    });

    expect(output).toContain('rpc = "https://rpc.example.test/\\"quoted\\""');
    expect(output).toContain('world_address = "0xabc\\"def"');
    expect(output).toContain('db_dir = "/data/\\"quoted\\"/torii"');
    expect(output).toContain("world_block = 12345");
  });

  test("omits world block when it is not configured", () => {
    expect(renderToriiConfig({ TORII_WORLD_BLOCK: "" })).not.toContain("world_block");
  });

  test("entrypoint threads Katana chain options and safely split extra args", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "runtime-entrypoint-"));
    const result = spawnSync("bash", ["deploy/aws/runtime-image/entrypoint.sh"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        LANG: "C",
        LC_ALL: "C",
        RUNTIME_ENTRYPOINT_DRY_RUN: "1",
        RUNTIME_KIND: "katana",
        DATA_DIR: path.join(workspace, "data"),
        INTERNAL_PORT: "5051",
        KATANA_CHAIN_ID: "SN_ETERNUM_DEV",
        KATANA_BLOCK_TIME: "2500",
        KATANA_EXTRA_ARGS: "--dev --accounts 3",
      },
    });

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout.trim().split("\n")).toEqual([
      "katana",
      "--host",
      "127.0.0.1",
      "--port",
      "5051",
      "--db-dir",
      path.join(workspace, "data", "katana"),
      "--chain-id",
      "SN_ETERNUM_DEV",
      "--block-time",
      "2500",
      "--dev",
      "--accounts",
      "3",
    ]);
  });

  test("entrypoint cleanup mode removes snapshot store contents", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "runtime-cleanup-"));
    const snapshotDir = path.join(workspace, "snapshots");
    await fs.mkdir(path.join(snapshotDir, "snapshot-old", "data"), { recursive: true });
    await fs.writeFile(path.join(snapshotDir, "snapshot-old", "data", "world.db"), "stale");
    await fs.mkdir(path.join(snapshotDir, ".tmp-interrupted"), { recursive: true });

    const result = spawnSync("bash", ["deploy/aws/runtime-image/entrypoint.sh"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        LANG: "C",
        LC_ALL: "C",
        RUNTIME_CLEANUP_PATH: snapshotDir,
      },
    });

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(`runtime-cleanup-path-cleaned: ${snapshotDir}`);
    await expect(fs.readdir(snapshotDir)).resolves.toEqual([]);
  });

  test("runtime image installs zstd for compressed snapshots", async () => {
    const dockerfile = await fs.readFile("deploy/aws/runtime-image/Dockerfile", "utf8");

    expect(dockerfile).toContain("zstd");
  });

  test("checkpoint sidecar can terminate the workload through its recorded PID", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "runtime-checkpoint-agent-"));
    const pidFile = path.join(workspace, "runtime.pid");
    const runtime = spawn("sleep", ["60"]);
    const exited = new Promise<NodeJS.Signals | null>((resolve) => {
      runtime.once("exit", (_code, signal) => resolve(signal));
    });
    await fs.writeFile(pidFile, `${runtime.pid}\n`);

    const result = spawnSync("bash", ["deploy/aws/runtime-image/checkpoint-agent.sh", "kill-runtime"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, RUNTIME_PID_FILE: pidFile },
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`runtime-killed:${runtime.pid}`);
    await expect(exited).resolves.toBe("SIGKILL");
  });

  test("runtime image builds pinned mdbx_copy instead of apt-installing mdbx tools", async () => {
    const dockerfile = await fs.readFile("deploy/aws/runtime-image/Dockerfile", "utf8");

    expect(dockerfile).toContain("ARG LIBMDBX_COMMIT=");
    expect(dockerfile).toContain('test "$(git -C /tmp/libmdbx rev-parse FETCH_HEAD)" = "${LIBMDBX_COMMIT}"');
    expect(dockerfile).toContain("AS mdbx-builder");
    expect(dockerfile).toContain("COPY --from=mdbx-builder /usr/local/bin/mdbx_copy /usr/local/bin/mdbx_copy");
    expect(dockerfile).not.toContain("mdbx-tools");
  });

  test("runtime image verifies the pinned Katana release archive", async () => {
    const dockerfile = await fs.readFile("deploy/aws/runtime-image/Dockerfile", "utf8");

    expect(dockerfile).toContain("ARG KATANA_VERSION=v1.7.1");
    expect(dockerfile).toContain("ARG KATANA_ARCHIVE_SHA256=");
    expect(dockerfile).toContain("sha256sum --check --strict");
    expect(dockerfile).toContain("FROM cgr.dev/chainguard/wolfi-base:latest@sha256:");
    expect(dockerfile).toContain("nodejs-22=");
    expect(dockerfile).toContain("ENV TAR_BIN=bsdtar");
    expect(dockerfile).toContain("COPY --from=mdbx-builder /usr/local/bin/katana /usr/local/bin/katana");
    expect(dockerfile).not.toContain("ghcr.io/dojoengine/dojo");
  });

  test("entrypoint snapshots only after the runtime process stops on shutdown", async () => {
    const source = await fs.readFile("deploy/aws/runtime-image/entrypoint.sh", "utf8");
    const shutdown = source.slice(source.indexOf("shutdown() {"), source.indexOf("trap shutdown"));

    const killRuntime = shutdown.indexOf('kill "${runtime_pid}"');
    const waitRuntime = shutdown.indexOf('wait "${runtime_pid}"');
    const finalSnapshot = shutdown.indexOf("runtime-snapshot.mjs snapshot-once");

    expect(killRuntime).toBeGreaterThan(-1);
    expect(waitRuntime).toBeGreaterThan(killRuntime);
    expect(finalSnapshot).toBeGreaterThan(waitRuntime);
  });

  test("snapshot supervisor validates its cadence and heartbeats checkpoint leases out of process", async () => {
    const source = await fs.readFile("deploy/aws/runtime-image/runtime-snapshot.mjs", "utf8");
    const lease = source.slice(
      source.indexOf("async function withSnapshotLease"),
      source.indexOf("async function acquireSnapshotLease"),
    );

    expect(source).toContain("positiveInteger(process.env.SNAPSHOT_INTERVAL_SECONDS, 300)");
    expect(lease).toContain('spawn(process.execPath, [process.argv[1], "lease-heartbeat"');
    expect(lease.indexOf("heartbeat = await startSnapshotLeaseHeartbeat(leasePath)")).toBeGreaterThan(
      lease.indexOf("try {"),
    );
    expect(lease.indexOf("await stopSnapshotLeaseHeartbeat(heartbeat)")).toBeLessThan(
      lease.indexOf("await fs.rm(leasePath"),
    );
  });

  test("path proxy health probes the upstream runtime", async () => {
    const upstream = await startUpstreamRuntime();
    const proxy = await startPathProxy(upstream);

    try {
      await waitForProxy(proxy.publicPort);
      await expect(fetchHealth(proxy.publicPort)).resolves.toEqual({ status: 200, ok: true });

      await upstream.stop();
      await expect(fetchHealth(proxy.publicPort)).resolves.toEqual({ status: 503, ok: false });
    } finally {
      proxy.process.kill();
      await upstream.stop();
    }
  });

  test("path proxy enforces public edge request and mutation limits", async () => {
    const upstream = await startUpstreamRuntime();
    const proxy = await startPathProxy(upstream, {
      PROXY_CORS_ORIGINS: "https://game.example",
      PROXY_MAX_BODY_BYTES: "64",
      PROXY_MAX_URL_BYTES: "64",
      PROXY_UPSTREAM_TIMEOUT_MS: "50",
    });

    try {
      await waitForProxy(proxy.publicPort);
      const baseUrl = `http://127.0.0.1:${proxy.publicPort}`;

      expect((await fetch(baseUrl, { headers: { Origin: "https://evil.example" } })).status).toBe(403);
      const allowed = await fetch(baseUrl, { headers: { Origin: "https://game.example" } });
      expect(allowed.status).toBe(200);
      expect(allowed.headers.get("access-control-allow-origin")).toBe("https://game.example");

      expect(
        (
          await fetch(baseUrl, {
            method: "POST",
            headers: { "content-type": "text/plain" },
            body: "x".repeat(65),
          })
        ).status,
      ).toBe(413);
      expect(
        (
          await fetch(baseUrl, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: "{invalid",
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await fetch(baseUrl, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ query: "mutation { updateWorld }" }),
          })
        ).status,
      ).toBe(403);
      expect((await fetch(`${baseUrl}/${"x".repeat(65)}`)).status).toBe(414);
      expect((await fetch(`${baseUrl}/slow`)).status).toBe(502);
    } finally {
      proxy.process.kill();
      await upstream.stop();
    }
  });

  test("runtime snapshots are atomic, retained, and carry metadata", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "runtime-snapshot-"));
    const dataDir = path.join(workspace, "data");
    const snapshotDir = path.join(workspace, "snapshots");

    await fs.mkdir(path.join(dataDir, "torii"), { recursive: true });
    await fs.writeFile(path.join(dataDir, "torii", "world.db"), "snapshot-one");
    runSnapshotCommand("snapshot-once", {
      DATA_DIR: dataDir,
      SNAPSHOT_DIR: snapshotDir,
      RUNTIME_KIND: "torii",
      RUNTIME_VERSION: "v1.8.16",
      WORLD_ADDRESS: "0xabc",
      SNAPSHOT_RETAIN: "2",
      SNAPSHOT_NOW: "2026-07-04T00:00:00.000Z",
    });

    await fs.writeFile(path.join(dataDir, "torii", "world.db"), "snapshot-two");
    runSnapshotCommand("snapshot-once", {
      DATA_DIR: dataDir,
      SNAPSHOT_DIR: snapshotDir,
      RUNTIME_KIND: "torii",
      RUNTIME_VERSION: "v1.8.16",
      WORLD_ADDRESS: "0xabc",
      SNAPSHOT_RETAIN: "2",
      SNAPSHOT_NOW: "2026-07-04T00:01:00.000Z",
    });

    await fs.writeFile(path.join(dataDir, "torii", "world.db"), "snapshot-three");
    runSnapshotCommand("snapshot-once", {
      DATA_DIR: dataDir,
      SNAPSHOT_DIR: snapshotDir,
      RUNTIME_KIND: "torii",
      RUNTIME_VERSION: "v1.8.16",
      WORLD_ADDRESS: "0xabc",
      SNAPSHOT_RETAIN: "2",
      SNAPSHOT_NOW: "2026-07-04T00:02:00.000Z",
    });

    const entries = await fs.readdir(snapshotDir);
    const snapshots = entries.filter((entry) => entry.startsWith("torii-") && entry.endsWith(".tar.zst")).sort();
    expect(snapshots).toHaveLength(2);
    expect(entries.some((entry) => entry.startsWith(".tmp-"))).toBe(false);
    expect(entries.some((entry) => entry.startsWith("snapshot-"))).toBe(false);

    const metadata = JSON.parse(
      await fs.readFile(path.join(snapshotDir, snapshots.at(-1)!.replace(/\.tar\.zst$/, ".json")), "utf8"),
    ) as Record<string, string>;
    expect(metadata.createdAt).toBe("2026-07-04T00:02:00.000Z");
    expect(metadata.kind).toBe("torii");
    expect(metadata.runtimeKind).toBe("torii");
    expect(metadata.runtimeVersion).toBe("v1.8.16");
    expect(metadata.worldAddress).toBe("0xabc");
    expect(metadata.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(metadata.checksum).toBe(metadata.sha256);

    const latest = JSON.parse(await fs.readFile(path.join(snapshotDir, "latest.json"), "utf8")) as Record<
      string,
      string
    >;
    expect(latest.snapshot).toBe(snapshots.at(-1));
    expect(latest.timestamp).toBe("2026-07-04T00:02:00.000Z");
  });

  test("interrupted snapshot writes preserve the previous valid snapshot", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "runtime-interrupted-snapshot-"));
    const dataDir = path.join(workspace, "data");
    const snapshotDir = path.join(workspace, "snapshots");
    const binDir = path.join(workspace, "bin");

    await fs.mkdir(path.join(dataDir, "torii"), { recursive: true });
    await fs.mkdir(binDir, { recursive: true });
    await fs.writeFile(path.join(dataDir, "torii", "world.db"), "valid-before-interruption");
    runSnapshotCommand("snapshot-once", {
      DATA_DIR: dataDir,
      SNAPSHOT_DIR: snapshotDir,
      RUNTIME_KIND: "torii",
      RUNTIME_VERSION: "v1.8.16",
      WORLD_ADDRESS: "0xabc",
      SNAPSHOT_NOW: "2026-07-04T00:00:00.000Z",
    });

    const committedPointer = await fs.readFile(path.join(snapshotDir, "latest.json"), "utf8");
    const committedArtifacts = await listSnapshotArtifacts(snapshotDir);

    await fs.writeFile(path.join(dataDir, "torii", "world.db"), "partial-after-interruption");
    await fs.writeFile(
      path.join(binDir, "failing-tar"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'destination=""',
        'while [[ "$#" -gt 0 ]]; do',
        '  if [[ "$1" == "-cf" ]]; then',
        "    shift",
        '    destination="$1"',
        "    break",
        "  fi",
        "  shift",
        "done",
        'printf "partial artifact" > "${destination}"',
        "exit 42",
      ].join("\n"),
    );
    await fs.chmod(path.join(binDir, "failing-tar"), 0o755);

    const interrupted = runSnapshotCommandExpectingFailure("snapshot-once", {
      DATA_DIR: dataDir,
      SNAPSHOT_DIR: snapshotDir,
      RUNTIME_KIND: "torii",
      RUNTIME_VERSION: "v1.8.16",
      WORLD_ADDRESS: "0xabc",
      SNAPSHOT_NOW: "2026-07-04T00:01:00.000Z",
      TAR_BIN: path.join(binDir, "failing-tar"),
    });

    expect(interrupted.stderr).toContain("failing-tar failed");
    await expect(fs.readFile(path.join(snapshotDir, "latest.json"), "utf8")).resolves.toBe(committedPointer);
    await expect(listSnapshotArtifacts(snapshotDir)).resolves.toEqual(committedArtifacts);
    expect((await fs.readdir(snapshotDir)).some((entry) => entry.startsWith(".tmp-"))).toBe(false);

    await fs.rm(dataDir, { recursive: true, force: true });
    runSnapshotCommand("restore", {
      DATA_DIR: dataDir,
      SNAPSHOT_DIR: snapshotDir,
      RUNTIME_KIND: "torii",
      RUNTIME_VERSION: "v1.8.16",
      WORLD_ADDRESS: "0xabc",
    });
    await expect(fs.readFile(path.join(dataDir, "torii", "world.db"), "utf8")).resolves.toBe(
      "valid-before-interruption",
    );
  });

  test("torii snapshots use SQLite online backup for database files", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "runtime-sqlite-snapshot-"));
    const dataDir = path.join(workspace, "data");
    const snapshotDir = path.join(workspace, "snapshots");
    const binDir = path.join(workspace, "bin");
    const sqliteLog = path.join(workspace, "sqlite.log");

    await fs.mkdir(path.join(dataDir, "torii"), { recursive: true });
    await fs.mkdir(binDir, { recursive: true });
    await fs.writeFile(path.join(dataDir, "torii", "world.db"), "SQLite format 3\u0000live-sqlite-db");
    await fs.writeFile(path.join(dataDir, "torii", "world.db-wal"), "live-wal");
    await fs.writeFile(
      path.join(binDir, "sqlite3"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'printf "%s\\n" "$@" >> "${SQLITE_BACKUP_LOG}"',
        'destination="${2:13:${#2}-14}"',
        'cp "$1" "$destination"',
      ].join("\n"),
    );
    await fs.chmod(path.join(binDir, "sqlite3"), 0o755);

    runSnapshotCommand("snapshot-once", {
      DATA_DIR: dataDir,
      SNAPSHOT_DIR: snapshotDir,
      RUNTIME_KIND: "torii",
      RUNTIME_VERSION: "v1.8.16",
      WORLD_ADDRESS: "0xabc",
      SNAPSHOT_NOW: "2026-07-04T00:00:00.000Z",
      SQLITE_BACKUP_LOG: sqliteLog,
      PATH: `${binDir}:${process.env.PATH}`,
    });

    const snapshots = await listSnapshotArtifacts(snapshotDir);
    const extractedSnapshot = await extractSnapshotArtifact(snapshotDir, snapshots[0]!);
    expect(await fs.readFile(sqliteLog, "utf8")).toContain("VACUUM INTO");
    expect(await fs.readFile(path.join(extractedSnapshot, "torii", "world.db"), "utf8")).toBe(
      "SQLite format 3\u0000live-sqlite-db",
    );
    await expect(fileExists(path.join(extractedSnapshot, "torii", "world.db-wal"))).resolves.toBe(false);
  });

  test("katana snapshots fall back to pause-copy-resume without mdbx_copy", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "runtime-katana-snapshot-"));
    const dataDir = path.join(workspace, "data");
    const snapshotDir = path.join(workspace, "snapshots");
    const binDir = path.join(workspace, "bin");

    await fs.mkdir(path.join(dataDir, "katana"), { recursive: true });
    await fs.mkdir(binDir, { recursive: true });
    await fs.writeFile(path.join(dataDir, "katana", "mdbx.dat"), "katana-state");

    const sleeper = spawn("sleep", ["30"], { stdio: "ignore" });
    try {
      runSnapshotCommand("snapshot-once", {
        DATA_DIR: dataDir,
        SNAPSHOT_DIR: snapshotDir,
        RUNTIME_KIND: "katana",
        RUNTIME_VERSION: "v1.8.16",
        RUNTIME_PID: `${sleeper.pid}`,
        MDBX_COPY_BIN: path.join(binDir, "missing-mdbx-copy"),
        SNAPSHOT_NOW: "2026-07-04T00:00:00.000Z",
      });
    } finally {
      sleeper.kill();
    }

    const snapshots = await listSnapshotArtifacts(snapshotDir);
    const extractedSnapshot = await extractSnapshotArtifact(snapshotDir, snapshots[0]!);
    expect(await fs.readFile(path.join(extractedSnapshot, "katana", "mdbx.dat"), "utf8")).toBe("katana-state");
  });

  test("runtime restore uses the newest valid matching snapshot only", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "runtime-restore-"));
    const dataDir = path.join(workspace, "data");
    const snapshotDir = path.join(workspace, "snapshots");

    await fs.mkdir(path.join(dataDir, "torii"), { recursive: true });
    await fs.writeFile(path.join(dataDir, "torii", "world.db"), "matching-snapshot");
    runSnapshotCommand("snapshot-once", {
      DATA_DIR: dataDir,
      SNAPSHOT_DIR: snapshotDir,
      RUNTIME_KIND: "torii",
      RUNTIME_VERSION: "v1.8.16",
      WORLD_ADDRESS: "0xabc",
      SNAPSHOT_NOW: "2026-07-04T00:00:00.000Z",
    });

    await fs.mkdir(path.join(snapshotDir, ".tmp-newer", "data", "torii"), { recursive: true });
    await fs.writeFile(path.join(snapshotDir, ".tmp-newer", "data", "torii", "world.db"), "incomplete");

    await fs.rm(dataDir, { recursive: true, force: true });
    const mismatch = spawnSync("node", ["deploy/aws/runtime-image/runtime-snapshot.mjs", "restore"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        DATA_DIR: dataDir,
        SNAPSHOT_DIR: snapshotDir,
        RUNTIME_KIND: "torii",
        RUNTIME_VERSION: "v1.8.16",
        WORLD_ADDRESS: "0xdef",
      },
    });
    expect(mismatch.stderr).toBe("");
    expect(mismatch.status).toBe(0);
    expect(mismatch.stdout).toContain("stale-snapshot-ignored: 2026-07-04T00:00:00.000Z world_address_mismatch");
    await expect(fileExists(path.join(dataDir, "torii", "world.db"))).resolves.toBe(false);

    runSnapshotCommand("restore", {
      DATA_DIR: dataDir,
      SNAPSHOT_DIR: snapshotDir,
      RUNTIME_KIND: "torii",
      RUNTIME_VERSION: "v1.8.16",
      WORLD_ADDRESS: "0xabc",
    });
    await expect(fs.readFile(path.join(dataDir, "torii", "world.db"), "utf8")).resolves.toBe("matching-snapshot");
  });

  test("runtime restore runs when the runtime-kind data directory is empty", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "runtime-kind-empty-restore-"));
    const dataDir = path.join(workspace, "data");
    const snapshotDir = path.join(workspace, "snapshots");

    await fs.mkdir(path.join(dataDir, "torii"), { recursive: true });
    await fs.writeFile(path.join(dataDir, "torii", "world.db"), "kind-empty-snapshot");
    runSnapshotCommand("snapshot-once", {
      DATA_DIR: dataDir,
      SNAPSHOT_DIR: snapshotDir,
      RUNTIME_KIND: "torii",
      RUNTIME_VERSION: "v1.8.16",
      WORLD_ADDRESS: "0xabc",
      SNAPSHOT_NOW: "2026-07-04T00:00:00.000Z",
    });

    await fs.rm(path.join(dataDir, "torii"), { recursive: true, force: true });
    await fs.writeFile(path.join(dataDir, "unrelated"), "keep");

    runSnapshotCommand("restore", {
      DATA_DIR: dataDir,
      SNAPSHOT_DIR: snapshotDir,
      RUNTIME_KIND: "torii",
      RUNTIME_VERSION: "v1.8.16",
      WORLD_ADDRESS: "0xabc",
    });

    await expect(fs.readFile(path.join(dataDir, "torii", "world.db"), "utf8")).resolves.toBe("kind-empty-snapshot");
    await expect(fs.readFile(path.join(dataDir, "unrelated"), "utf8")).resolves.toBe("keep");
  });

  test("runtime restore prefers the latest pointer over unpointed newer snapshots", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "runtime-latest-pointer-"));
    const dataDir = path.join(workspace, "data");
    const snapshotDir = path.join(workspace, "snapshots");

    await fs.mkdir(path.join(dataDir, "torii"), { recursive: true });
    await fs.writeFile(path.join(dataDir, "torii", "world.db"), "committed-snapshot");
    runSnapshotCommand("snapshot-once", {
      DATA_DIR: dataDir,
      SNAPSHOT_DIR: snapshotDir,
      RUNTIME_KIND: "torii",
      RUNTIME_VERSION: "v1.8.16",
      WORLD_ADDRESS: "0xabc",
      SNAPSHOT_NOW: "2026-07-04T00:00:00.000Z",
    });

    const committedPointer = await fs.readFile(path.join(snapshotDir, "latest.json"), "utf8");
    await fs.writeFile(path.join(dataDir, "torii", "world.db"), "unpointed-newer-snapshot");
    runSnapshotCommand("snapshot-once", {
      DATA_DIR: dataDir,
      SNAPSHOT_DIR: snapshotDir,
      RUNTIME_KIND: "torii",
      RUNTIME_VERSION: "v1.8.16",
      WORLD_ADDRESS: "0xabc",
      SNAPSHOT_NOW: "2026-07-04T00:01:00.000Z",
    });
    await fs.writeFile(path.join(snapshotDir, "latest.json"), committedPointer);

    await fs.rm(dataDir, { recursive: true, force: true });
    runSnapshotCommand("restore", {
      DATA_DIR: dataDir,
      SNAPSHOT_DIR: snapshotDir,
      RUNTIME_KIND: "torii",
      RUNTIME_VERSION: "v1.8.16",
      WORLD_ADDRESS: "0xabc",
    });

    await expect(fs.readFile(path.join(dataDir, "torii", "world.db"), "utf8")).resolves.toBe("committed-snapshot");
  });

  test("runtime restore skips snapshots from an incompatible runtime version", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "runtime-version-restore-"));
    const dataDir = path.join(workspace, "data");
    const snapshotDir = path.join(workspace, "snapshots");

    await fs.mkdir(path.join(dataDir, "torii"), { recursive: true });
    await fs.writeFile(path.join(dataDir, "torii", "world.db"), "old-version-snapshot");
    runSnapshotCommand("snapshot-once", {
      DATA_DIR: dataDir,
      SNAPSHOT_DIR: snapshotDir,
      RUNTIME_KIND: "torii",
      RUNTIME_VERSION: "v1.8.16",
      WORLD_ADDRESS: "0xabc",
      SNAPSHOT_NOW: "2026-07-04T00:00:00.000Z",
    });
    await fs.rm(dataDir, { recursive: true, force: true });

    const result = spawnSync("node", ["deploy/aws/runtime-image/runtime-snapshot.mjs", "restore"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        DATA_DIR: dataDir,
        SNAPSHOT_DIR: snapshotDir,
        RUNTIME_KIND: "torii",
        RUNTIME_VERSION: "v1.9.0",
        WORLD_ADDRESS: "0xabc",
      },
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("runtime_version_mismatch");
    await expect(fileExists(path.join(dataDir, "torii", "world.db"))).resolves.toBe(false);
  });

  test("runtime restore logs and skips corrupt snapshots", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "runtime-corrupt-restore-"));
    const dataDir = path.join(workspace, "data");
    const snapshotDir = path.join(workspace, "snapshots");

    await fs.mkdir(path.join(dataDir, "torii"), { recursive: true });
    await fs.writeFile(path.join(dataDir, "torii", "world.db"), "valid-snapshot");
    runSnapshotCommand("snapshot-once", {
      DATA_DIR: dataDir,
      SNAPSHOT_DIR: snapshotDir,
      RUNTIME_KIND: "torii",
      RUNTIME_VERSION: "v1.8.16",
      WORLD_ADDRESS: "0xabc",
      SNAPSHOT_NOW: "2026-07-04T00:00:00.000Z",
    });

    const snapshots = await listSnapshotArtifacts(snapshotDir);
    await fs.writeFile(path.join(snapshotDir, snapshots[0]!), "corrupt-snapshot");
    await fs.rm(dataDir, { recursive: true, force: true });

    const result = spawnSync("node", ["deploy/aws/runtime-image/runtime-snapshot.mjs", "restore"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        DATA_DIR: dataDir,
        SNAPSHOT_DIR: snapshotDir,
        RUNTIME_KIND: "torii",
        RUNTIME_VERSION: "v1.8.16",
        WORLD_ADDRESS: "0xabc",
      },
    });

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("invalid-snapshot-ignored: 2026-07-04T00:00:00.000Z checksum_mismatch");
    await expect(fileExists(path.join(dataDir, "torii", "world.db"))).resolves.toBe(false);
  });

  test("runtime restore accepts PRD sha256 snapshot metadata", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "runtime-sha256-restore-"));
    const dataDir = path.join(workspace, "data");
    const snapshotDir = path.join(workspace, "snapshots");

    await fs.mkdir(path.join(dataDir, "torii"), { recursive: true });
    await fs.writeFile(path.join(dataDir, "torii", "world.db"), "prd-snapshot");
    runSnapshotCommand("snapshot-once", {
      DATA_DIR: dataDir,
      SNAPSHOT_DIR: snapshotDir,
      RUNTIME_KIND: "torii",
      RUNTIME_VERSION: "v1.8.16",
      WORLD_ADDRESS: "0xabc",
      SNAPSHOT_NOW: "2026-07-04T00:00:00.000Z",
    });

    const snapshots = await listSnapshotArtifacts(snapshotDir);
    const metadataPath = path.join(snapshotDir, snapshotMetadataName(snapshots[0]!));
    const metadata = JSON.parse(await fs.readFile(metadataPath, "utf8")) as Record<string, string>;
    delete metadata.checksum;
    await fs.writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
    await fs.rm(dataDir, { recursive: true, force: true });

    runSnapshotCommand("restore", {
      DATA_DIR: dataDir,
      SNAPSHOT_DIR: snapshotDir,
      RUNTIME_KIND: "torii",
      RUNTIME_VERSION: "v1.8.16",
      WORLD_ADDRESS: "0xabc",
    });

    await expect(fs.readFile(path.join(dataDir, "torii", "world.db"), "utf8")).resolves.toBe("prd-snapshot");
  });

  test("runtime restore accepts PRD kind snapshot metadata", async () => {
    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "runtime-kind-restore-"));
    const dataDir = path.join(workspace, "data");
    const snapshotDir = path.join(workspace, "snapshots");

    await fs.mkdir(path.join(dataDir, "torii"), { recursive: true });
    await fs.writeFile(path.join(dataDir, "torii", "world.db"), "prd-kind-snapshot");
    runSnapshotCommand("snapshot-once", {
      DATA_DIR: dataDir,
      SNAPSHOT_DIR: snapshotDir,
      RUNTIME_KIND: "torii",
      RUNTIME_VERSION: "v1.8.16",
      WORLD_ADDRESS: "0xabc",
      SNAPSHOT_NOW: "2026-07-04T00:00:00.000Z",
    });

    const snapshots = await listSnapshotArtifacts(snapshotDir);
    const metadataPath = path.join(snapshotDir, snapshotMetadataName(snapshots[0]!));
    const metadata = JSON.parse(await fs.readFile(metadataPath, "utf8")) as Record<string, string>;
    delete metadata.runtimeKind;
    await fs.writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
    await fs.rm(dataDir, { recursive: true, force: true });

    runSnapshotCommand("restore", {
      DATA_DIR: dataDir,
      SNAPSHOT_DIR: snapshotDir,
      RUNTIME_KIND: "torii",
      RUNTIME_VERSION: "v1.8.16",
      WORLD_ADDRESS: "0xabc",
    });

    await expect(fs.readFile(path.join(dataDir, "torii", "world.db"), "utf8")).resolves.toBe("prd-kind-snapshot");
  });
});

function runSnapshotCommand(command: string, env: NodeJS.ProcessEnv): void {
  const result = spawnSync("node", ["deploy/aws/runtime-image/runtime-snapshot.mjs", command], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      ...env,
    },
  });

  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
}

function runSnapshotCommandExpectingFailure(command: string, env: NodeJS.ProcessEnv): ReturnType<typeof spawnSync> {
  const result = spawnSync("node", ["deploy/aws/runtime-image/runtime-snapshot.mjs", command], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      ...env,
    },
  });

  expect(result.status).not.toBe(0);
  return result;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listSnapshotArtifacts(snapshotDir: string): Promise<string[]> {
  return (await fs.readdir(snapshotDir)).filter((entry) => entry.endsWith(".tar.zst")).sort();
}

function snapshotMetadataName(snapshotArtifact: string): string {
  return snapshotArtifact.replace(/\.tar\.zst$/, ".json");
}

async function extractSnapshotArtifact(snapshotDir: string, snapshotArtifact: string): Promise<string> {
  const destination = await fs.mkdtemp(path.join(os.tmpdir(), "runtime-snapshot-extract-"));
  const result = spawnSync("tar", ["--zstd", "-xf", path.join(snapshotDir, snapshotArtifact), "-C", destination], {
    encoding: "utf8",
  });

  expect(result.status).toBe(0);
  return destination;
}

async function startUpstreamRuntime(): Promise<{ port: number; stop: () => Promise<void> }> {
  const server = http.createServer((request, response) => {
    if (request.method === "GET" && request.url === "/sql?query=SELECT%201%20AS%20ok") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify([{ ok: 1 }]));
      return;
    }

    if (request.method === "GET" && request.url === "/") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true }));
      return;
    }

    if (request.method === "GET" && request.url === "/slow") {
      setTimeout(() => {
        response.writeHead(200);
        response.end("slow");
      }, 250);
      return;
    }

    response.writeHead(404);
    response.end();
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to bind upstream test server");
  }

  return {
    port: address.port,
    stop: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

async function startPathProxy(
  upstream: { port: number },
  env: NodeJS.ProcessEnv = {},
): Promise<{ publicPort: number; process: ChildProcess }> {
  const publicPort = await reserveFreePort();
  return {
    publicPort,
    process: spawn("node", ["deploy/aws/runtime-image/path-proxy.mjs"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        RUNTIME_KIND: "torii",
        PUBLIC_PORT: `${publicPort}`,
        INTERNAL_PORT: `${upstream.port}`,
        PROXY_HEALTH_CACHE_MS: "0",
        ...env,
      },
      stdio: "ignore",
    }),
  };
}

async function reserveFreePort(): Promise<number> {
  const server = http.createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to reserve proxy test port");
  }

  const port = address.port;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

async function waitForProxy(publicPort: number): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await fetch(`http://127.0.0.1:${publicPort}/health`);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  throw new Error("Timed out waiting for path proxy");
}

async function fetchHealth(publicPort: number): Promise<{ status: number; ok: boolean }> {
  const response = await fetch(`http://127.0.0.1:${publicPort}/health`);
  return { status: response.status, ok: response.ok };
}
