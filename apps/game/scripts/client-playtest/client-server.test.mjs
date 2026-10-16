import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { assertPortFree, buildDirectoryFor } from "./client-server.mjs";

const RUNNER = resolve(dirname(fileURLToPath(import.meta.url)), "../run-client-playtest.mjs");

const listenOn = () =>
  new Promise((resolveServer) => {
    const server = net.createServer((socket) => socket.end("still mine\n"));
    server.listen(0, "127.0.0.1", () => resolveServer(server));
  });
const ask = (port) =>
  new Promise((resolveAnswer, reject) => {
    const socket = net.connect(port, "127.0.0.1");
    let answer = "";
    socket.on("data", (chunk) => (answer += chunk));
    socket.on("end", () => resolveAnswer(answer));
    socket.on("error", reject);
  });
const runRunner = (args, { env: extraEnv = {}, signalWhen } = {}) =>
  new Promise((resolveRun) => {
    // Vitest injects VITE_* values of its own; the command runs with the caller's environment, as from a shell.
    const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("VITE_")));
    const child = spawn(process.execPath, [RUNNER, ...args], {
      env: { ...env, ...extraEnv },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    const poll = signalWhen
      ? setInterval(() => {
          if (!signalWhen()) return;
          clearInterval(poll);
          child.kill("SIGTERM");
        }, 100)
      : null;
    child.on("exit", (code) => {
      clearInterval(poll);
      resolveRun({ code, output });
    });
  });
const onlyRunOf = (root) => {
  const [run] = readdirSync(root);
  return { dir: join(root, run), summary: JSON.parse(readFileSync(join(root, run, "summary.json"), "utf8")) };
};

describe("assertPortFree", () => {
  it("refuses a port someone else listens on, and leaves that server serving", async () => {
    const server = await listenOn();
    const { port } = server.address();
    await expect(assertPortFree(port)).rejects.toThrow(`port ${port} is already in use`);
    expect(await ask(port)).toBe("still mine\n");
    server.close();
  });
});

describe("buildDirectoryFor", () => {
  it("gives every run its own build, so concurrent runs never replace each other's assets", () => {
    expect(buildDirectoryFor("/out/2026-10-14T18-00-00-000Z-spectator")).not.toBe(
      buildDirectoryFor("/out/2026-10-14T18-00-00-001Z-spectator"),
    );
  });
});

describe("the playtest command", () => {
  it("fails on an occupied port with a structured summary, never driving or stopping the other server", async () => {
    const server = await listenOn();
    const { port } = server.address();
    const root = mkdtempSync(join(tmpdir(), "playtest-occupied-"));

    const { code } = await runRunner(["--port", String(port), "--out", root, "--iterations", "1"]);

    expect(code).toBe(1);
    const { summary } = onlyRunOf(root);
    expect(summary.failure).toEqual({
      stage: "starting the client",
      error: `port ${port} is already in use: pass another --port, or --base-url to use that server`,
      cancelled: null,
    });
    expect(summary.released).toEqual({ failures: [], stillHeld: [] });
    expect(await ask(port)).toBe("still mine\n");
    server.close();
    rmSync(root, { recursive: true });
  }, 30_000);

  it("unwinds a SIGTERM during the build: summary written, its build process stopped, nothing left held", async () => {
    const free = await listenOn();
    const { port } = free.address();
    free.close();
    const root = mkdtempSync(join(tmpdir(), "playtest-cancelled-"));
    // A build that never ends on its own: only the run's unwind can stop it.
    const tools = mkdtempSync(join(tmpdir(), "playtest-stub-build-"));
    const stubBuild = join(tools, "endless-build.mjs");
    writeFileSync(stubBuild, "console.log(`stub build pid ${process.pid}`);\nsetInterval(() => {}, 1_000);\n");
    const buildLog = () => {
      const [run] = existsSync(root) ? readdirSync(root) : [];
      const log = run && join(root, run, "client.log");
      return log && existsSync(log) ? readFileSync(log, "utf8") : "";
    };

    const { code } = await runRunner(["--port", String(port), "--out", root, "--iterations", "1"], {
      env: { PLAYTEST_VITE_BIN: stubBuild },
      signalWhen: () => buildLog().includes("stub build pid"),
    });

    expect(code).toBe(1);
    const { summary } = onlyRunOf(root);
    expect(summary.failure.stage).toBe("starting the client");
    expect(summary.failure.cancelled).toBe("SIGTERM");
    expect(summary.released).toEqual({ failures: [], stillHeld: [] });
    const buildPid = Number(/stub build pid (\d+)/.exec(buildLog())[1]);
    expect(() => process.kill(buildPid, 0)).toThrow();
    rmSync(root, { recursive: true });
    rmSync(tools, { recursive: true });
  }, 30_000);
});
