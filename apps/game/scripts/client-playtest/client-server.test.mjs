import { spawn } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
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
const runRunner = (args, { signalAfterMs } = {}) =>
  new Promise((resolveRun) => {
    // Vitest injects VITE_* values of its own; the command runs with the caller's environment, as from a shell.
    const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("VITE_")));
    const child = spawn(process.execPath, [RUNNER, ...args], { env, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    if (signalAfterMs) setTimeout(() => child.kill("SIGTERM"), signalAfterMs);
    child.on("exit", (code) => resolveRun({ code, output }));
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

  it("unwinds a SIGTERM during the build: summary written, its build process gone, nothing left held", async () => {
    const free = await listenOn();
    const { port } = free.address();
    free.close();
    const root = mkdtempSync(join(tmpdir(), "playtest-cancelled-"));

    const { code } = await runRunner(["--port", String(port), "--out", root, "--iterations", "1"], {
      signalAfterMs: 3_000,
    });

    expect(code).toBe(1);
    const { dir, summary } = onlyRunOf(root);
    expect(summary.failure.stage).toBe("starting the client");
    expect(summary.failure.cancelled).toBe("SIGTERM");
    expect(summary.released).toEqual({ failures: [], stillHeld: [] });
    expect(readFileSync(join(dir, "client.log"), "utf8")).not.toBe("");
    const buildPid = /client build pid (\d+)/.exec(JSON.stringify(summary))?.[1];
    if (buildPid) expect(() => process.kill(Number(buildPid), 0)).toThrow();
    rmSync(root, { recursive: true });
  }, 60_000);
});
