import { describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "../../..");

describe("host state", () => {
  test("a node the caller cannot inspect comes back null instead of failing the run", async () => {
    // A sudo that refuses stands in for a caller without docker access, the way the box answered the harness.
    const bin = mkdtempSync(join(tmpdir(), "host-state-"));
    try {
      writeFileSync(join(bin, "sudo"), "#!/bin/sh\nexit 1\n");
      chmodSync(join(bin, "sudo"), 0o755);
      const child = Bun.spawn(["bash", "deploy/athanor/scripts/host-state.sh"], {
        cwd: root,
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH}`,
          MADARA_CONTAINER: "absent-madara-1",
          CHAIN_CONFIG_PATH: resolve(root, "deploy/athanor/chain-config.yaml"),
        },
        stdout: "pipe",
        stderr: "pipe",
      });
      const [status, output, error] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ]);
      expect(error).toBe("");
      expect(status).toBe(0);
      const state = JSON.parse(output);
      expect(state.madara).toEqual({
        image: null,
        nativeExecution: null,
        nativeClassesCached: null,
        cpuPercent: null,
        memMib: null,
      });
      expect(typeof state.host.threads).toBe("number");
    } finally {
      rmSync(bin, { recursive: true, force: true });
    }
  });
});
