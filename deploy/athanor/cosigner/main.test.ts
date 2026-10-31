import { expect, test } from "bun:test";
import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ec } from "starknet";

const main = new URL("./main.ts", import.meta.url).pathname;
test("key initialization preserves the key on rerun, prints only its public identity and rejects unsafe permissions", () => {
  const directory = mkdtempSync(join(tmpdir(), "payout-cosigner-test-"));
  const path = join(directory, "key");
  const init = () => Bun.spawnSync([process.execPath, main, "init-key", path]);
  try {
    const first = init();
    expect(first.exitCode).toBe(0);
    const key = readFileSync(path, "utf8").trim();
    expect(statSync(path).mode & 0o777).toBe(0o600);
    expect(JSON.parse(first.stdout.toString())).toEqual({ publicKey: ec.starkCurve.getStarkKey(key) });
    const second = init();
    expect(second.exitCode).toBe(0);
    expect(second.stdout.toString()).toBe(first.stdout.toString());
    expect(readFileSync(path, "utf8").trim()).toBe(key);
    chmodSync(path, 0o644);
    const refused = init();
    expect(refused.exitCode).not.toBe(0);
    expect(refused.stderr.toString()).toContain("cosigner_file_requires_0600");
    expect(refused.stdout.toString()).toBe("");
  } finally {
    rmSync(directory, { recursive: true });
  }
});
