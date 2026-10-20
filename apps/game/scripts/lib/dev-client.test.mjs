import { chmodSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { withDevClient } from "./dev-client.mjs";

const SCRIPTS = fileURLToPath(new URL("../", import.meta.url));
const temporary = [];
const originalPath = process.env.PATH;

afterEach(() => {
  process.env.PATH = originalPath;
  for (const directory of temporary.splice(0)) rmSync(directory, { recursive: true, force: true });
});

/** A `pnpm` on PATH that announces a dev server as Vite does, records its pid and waits to be stopped. */
const fakePnpm = () => {
  const directory = mkdtempSync(join(tmpdir(), "dev-client-test-"));
  temporary.push(directory);
  const pidFile = join(directory, "server.pid");
  const pnpm = join(directory, "pnpm");
  writeFileSync(pnpm, `#!/bin/sh\necho $$ > "${pidFile}"\necho "  Local:   https://127.0.0.1:$5/"\nexec sleep 60\n`);
  chmodSync(pnpm, 0o755);
  process.env.PATH = `${directory}:${originalPath}`;
  return { directory, pid: () => Number(readFileSync(pidFile, "utf8")) };
};

const running = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

describe("the dev client a lab proof drives", () => {
  it("starts pnpm dev on the port, hands the proof its address, and stops it after", async () => {
    const server = fakePnpm();
    const seen = await withDevClient({ base: null, port: 4321, out: server.directory }, async (baseUrl) => {
      expect(running(server.pid())).toBe(true);
      return baseUrl;
    });
    expect(seen).toBe("https://127.0.0.1:4321");
    expect(running(server.pid())).toBe(false);
    expect(readFileSync(join(server.directory, "client.log"), "utf8")).toContain("Local:");
  });

  it("stops the server when the proof fails", async () => {
    const server = fakePnpm();
    await expect(
      withDevClient({ base: null, port: 4322, out: server.directory }, async () => {
        throw new Error("proof failed");
      }),
    ).rejects.toThrow("proof failed");
    expect(running(server.pid())).toBe(false);
  });

  it("drives a given base URL without starting anything", async () => {
    process.env.PATH = "/nonexistent";
    expect(
      await withDevClient({ base: "https://127.0.0.1:4176/", port: 1, out: "/nonexistent" }, async (url) => url),
    ).toBe("https://127.0.0.1:4176");
  });

  it("is the only script that starts pnpm dev", () => {
    const files = (directory) =>
      readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)],
      );
    const starters = files(SCRIPTS)
      .filter((path) => /\.m?[jt]s$/.test(path) && !path.endsWith(".test.mjs"))
      .filter((path) => /spawn\(\s*"pnpm",\s*\[\s*"dev"/.test(readFileSync(path, "utf8")))
      .map((path) => relative(SCRIPTS, path));
    expect(starters).toEqual(["lib/dev-client.mjs"]);
  });
});
