/**
 * The dev client a lab proof drives. The lab routes exist only on the dev server, so a proof runs on `--base-url` when
 * it is given, or on `pnpm dev` started here on `port` and stopped, its whole process group, however the proof ends.
 */
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const APP = fileURLToPath(new URL("../../", import.meta.url));
const START_SECONDS = 30;

/** Runs `prove(baseUrl)` against the dev client, and writes the server's output to `<out>/client.log`. */
export async function withDevClient({ base, port, out }, prove) {
  if (base) return prove(base.replace(/\/$/, ""));
  let log = "";
  const server = spawn("pnpm", ["dev", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: APP,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const exited = new Promise((done) => server.once("exit", done));
  server.stdout.on("data", (chunk) => (log += chunk));
  server.stderr.on("data", (chunk) => (log += chunk));
  try {
    const deadline = Date.now() + START_SECONDS * 1000;
    while (!log.includes("Local:")) {
      if (server.exitCode !== null || server.signalCode !== null || Date.now() > deadline)
        throw new Error(`Client did not start: ${log}`);
      await new Promise((done) => setTimeout(done, 200));
    }
    return await prove(`https://127.0.0.1:${port}`);
  } finally {
    if (server.exitCode === null && server.signalCode === null) {
      process.kill(-server.pid, "SIGTERM");
      await exited;
    }
    writeFileSync(join(out, "client.log"), log);
  }
}
