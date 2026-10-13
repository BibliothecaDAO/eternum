import { expect, test } from "bun:test";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { root } from "./settings";

test("all public commands start in an export without installed dependencies", async () => {
  const directory = mkdtempSync(join(tmpdir(), "deploy-entry-"));
  const exported = join(directory, "source");
  const privateDirectory = join(directory, "private");
  const bin = join(directory, "bin");
  try {
    mkdirSync(exported);
    mkdirSync(privateDirectory, { mode: 0o700 });
    mkdirSync(bin);
    cpSync(join(root, "deploy/first"), join(exported, "deploy/first"), { recursive: true });
    cpSync(join(root, "package.json"), join(exported, "package.json"));
    writeFileSync(join(exported, "deploy/first/commit.txt"), "a".repeat(40));
    // Reach the SSH boundary without contacting or changing a real shard.
    writeFileSync(join(bin, "ssh"), '#!/bin/sh\ncat >/dev/null\nprintf \'{"log":"box boundary reached"}\\n\'\n', {
      mode: 0o700,
    });
    for (const command of ["setup", "deploy", "deploy:cloudflare", "season", "teardown"]) {
      const args = ["pnpm", "run", command, "dev"];
      if (!["deploy", "teardown"].includes(command)) args.push(privateDirectory);
      const child = Bun.spawn(args, {
        cwd: exported,
        env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, NODE_PATH: "" },
        stdout: "pipe",
        stderr: "pipe",
      });
      const [code, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ]);
      const output = stdout + stderr;
      expect(output).not.toContain("Cannot find");
      if (command === "setup" || command === "season") {
        expect(code).toBe(1);
        expect(output).toContain(
          `Deployment stopped at ${command} prerequisites; HTTP n/a; code dependencies_missing: Run pnpm install --frozen-lockfile --ignore-scripts first`,
        );
      } else if (command === "deploy:cloudflare") {
        expect(code).toBe(1);
        expect(output).toContain(
          "Deployment stopped at publish Cloudflare; HTTP n/a; code precondition_failed: Run setup before publishing Cloudflare",
        );
      } else {
        expect(code).toBe(0);
        expect(output).toContain("box boundary reached");
      }
      expect(existsSync(join(exported, "node_modules"))).toBe(false);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 20_000);
