import { spawn } from "node:child_process";
import { closeSync, openSync, readFileSync, rmSync, writeSync } from "node:fs";
import https from "node:https";
import net from "node:net";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Cancelled } from "./run-owner.mjs";

const GAME_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
// The build and preview tool. PLAYTEST_VITE_BIN stands another in, as the runner's tests do with a build that never ends.
const VITE_BIN = process.env.PLAYTEST_VITE_BIN ?? join(GAME_DIR, "node_modules/vite/bin/vite.js");
const BUILDS_DIR = resolve(GAME_DIR, "../../.context/playtest-builds");
const READY_TIMEOUT_MS = 60_000;
const READY_POLL_MS = 500;
const STOP_GRACE_MS = 5_000;

/** Each invocation builds into its own directory, so two runs from one checkout never serve each other's assets. */
export const buildDirectoryFor = (runDir) => join(BUILDS_DIR, basename(runDir));

/**
 * Builds the client as players get it and serves it on `port`, owned by `owner`: the build directory and the preview
 * are released (the preview awaited to exit) when the owner unwinds, and a preview that dies early cancels the run.
 * A port already in use fails before anything starts; the server holding it is never driven or stopped.
 */
export async function startClient({ owner, port, runDir }) {
  await assertPortFree(port);
  const logPath = join(runDir, "client.log");
  const distDir = buildDirectoryFor(runDir);
  owner.adopt("client build", () => rmSync(distDir, { recursive: true, force: true }));
  await runOwned(owner, "client build", [VITE_BIN, "build", "--outDir", distDir, "--emptyOutDir"], logPath, {
    NODE_OPTIONS: "--max-old-space-size=8192",
  });
  owner.throwIfCancelled();

  const preview = spawnLogged(
    [VITE_BIN, "preview", "--outDir", distDir, "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
    logPath,
  );
  owner.adopt(`preview pid ${preview.child.pid}`, () => stopProcess(preview));
  preview.child.once("exit", (code, signal) => {
    if (!preview.stopping) owner.cancel(`the preview server exited (${signal ?? code})`);
  });
  const baseUrl = `https://127.0.0.1:${port}`;
  await waitUntilServed({ baseUrl, owner, port, preview, logPath });
  return { baseUrl, distDir, previewPid: preview.child.pid };
}

/** A port is ours to use only if nothing listens on it now: binding it proves that. */
export function assertPortFree(port) {
  return new Promise((resolvePort, reject) => {
    const probe = net.createServer();
    probe.once("error", (error) =>
      reject(
        error.code === "EADDRINUSE"
          ? new Error(`port ${port} is already in use: pass another --port, or --base-url to use that server`)
          : error,
      ),
    );
    probe.listen(port, "127.0.0.1", () => probe.close(() => resolvePort()));
  });
}

/** Ready means our preview announced this port and still runs, and the port answers: never someone else's server. */
async function waitUntilServed({ baseUrl, owner, port, preview, logPath }) {
  const startedAt = Date.now();
  while (!(preview.announced(port) && preview.child.exitCode === null && (await answers(baseUrl)))) {
    owner.throwIfCancelled();
    if (preview.child.exitCode !== null) throw new Error(`The preview server exited:\n${tail(logPath)}`);
    if (Date.now() - startedAt > READY_TIMEOUT_MS) throw new Error(`The preview server did not answer on ${baseUrl}`);
    await owner.sleep(READY_POLL_MS);
  }
}

/** Runs a process the owner holds; a cancel stops it at once instead of waiting for it to finish. */
function runOwned(owner, name, args, logPath, env) {
  const run = spawnLogged(args, logPath, env);
  const release = owner.adopt(`${name} pid ${run.child.pid}`, () => stopProcess(run));
  const withdraw = owner.onCancel(() => void release());
  return new Promise((resolveRun, reject) => {
    run.child.once("exit", (code, signal) => {
      withdraw();
      void release();
      if (owner.cancelledBy) reject(new Cancelled(owner.cancelledBy));
      else if (code === 0) resolveRun();
      else reject(new Error(`${name} failed (${signal ?? code}):\n${tail(logPath)}`));
    });
  });
}

function spawnLogged(args, logPath, env = {}) {
  const log = openSync(logPath, "a");
  const child = spawn(process.execPath, args, {
    cwd: GAME_DIR,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  const keep = (chunk) => {
    output += chunk;
    writeSync(log, chunk);
  };
  child.stdout.on("data", keep);
  child.stderr.on("data", keep);
  child.once("close", () => closeSync(log));
  return {
    child,
    stopping: false,
    // Vite prints its local URL only once it listens; ANSI colouring is stripped before matching.
    announced: (port) => output.replace(/\u001b\[[0-9;]*m/g, "").includes(`127.0.0.1:${port}/`),
  };
}

/** SIGTERM, then SIGKILL after a grace period; resolves once the process has exited. */
function stopProcess(owned) {
  owned.stopping = true;
  const { child } = owned;
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolveStop) => {
    const kill = setTimeout(() => child.kill("SIGKILL"), STOP_GRACE_MS);
    child.once("exit", () => {
      clearTimeout(kill);
      resolveStop();
    });
    child.kill("SIGTERM");
  });
}

/** The preview serves the local mkcert certificate. */
function answers(url) {
  return new Promise((resolveAnswer) => {
    const request = https.get(url, { rejectUnauthorized: false, timeout: 2_000 }, (response) => {
      response.resume();
      resolveAnswer(response.statusCode === 200);
    });
    request.on("timeout", () => request.destroy());
    request.on("error", () => resolveAnswer(false));
  });
}

function tail(path) {
  try {
    return readFileSync(path, "utf8").split("\n").slice(-20).join("\n");
  } catch {
    return "";
  }
}
