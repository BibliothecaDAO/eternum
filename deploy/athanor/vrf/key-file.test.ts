import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, statSync, chmodSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ec } from "starknet";
import { createShardVrfKey, readShardVrfPoint } from "./key-file";

test("deployment draws its own protected VRF credential once and restart preserves its public point", () => {
  const dir = mkdtempSync(join(tmpdir(), "shard-vrf-key-"));
  try {
    const point = createShardVrfKey(dir),
      path = join(dir, "vrf-key.json");
    expect(statSync(path).mode & 0o777).toBe(0o600);
    expect(readShardVrfPoint(dir)).toEqual(point);
    expect(() => createShardVrfKey(dir)).toThrow();
    const credential = JSON.parse(readFileSync(path, "utf8"));
    expect(credential.privateKey).toMatch(/^0x[0-9a-f]{64}$/);
    const publicBytes = ec.starkCurve.getPublicKey(credential.privateKey, false);
    expect(BigInt(point.x)).toBe(BigInt("0x" + Buffer.from(publicBytes.subarray(1, 33)).toString("hex")));
    writeFileSync(path, JSON.stringify({ privateKey: "0x" + ec.starkCurve.CURVE.n.toString(16).padStart(64, "0") }));
    expect(() => readShardVrfPoint(dir)).toThrow("Invalid protected VRF credential");
    chmodSync(path, 0o644);
    expect(() => readShardVrfPoint(dir)).toThrow("0600");
    unlinkSync(path);
    expect(() => readShardVrfPoint(dir)).toThrow();
  } finally {
    rmSync(dir, { recursive: true });
  }
});
