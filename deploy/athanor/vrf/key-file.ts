import { lstatSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ec } from "starknet";
const ORDER = ec.starkCurve.CURVE.n;
export interface VrfPoint {
  x: string;
  y: string;
}
function point(privateKey: string): VrfPoint {
  if (!/^0x[0-9a-f]{64}$/.test(privateKey) || BigInt(privateKey) === 0n || BigInt(privateKey) >= ORDER)
    throw new Error("Invalid protected VRF credential");
  const bytes = ec.starkCurve.getPublicKey(privateKey, false);
  return {
    x: "0x" + Buffer.from(bytes.subarray(1, 33)).toString("hex"),
    y: "0x" + Buffer.from(bytes.subarray(33)).toString("hex"),
  };
}
export function createShardVrfKey(directory: string): VrfPoint {
  const bytes = ec.starkCurve.utils.randomPrivateKey();
  const privateKey = "0x" + Buffer.from(bytes).toString("hex").padStart(64, "0");
  bytes.fill(0);
  writeFileSync(join(directory, "vrf-key.json"), JSON.stringify({ privateKey }) + "\n", { mode: 0o600, flag: "wx" });
  return point(privateKey);
}
export function readShardVrfPoint(directory: string): VrfPoint {
  const path = join(directory, "vrf-key.json"),
    stat = lstatSync(path);
  if (!stat.isFile() || (stat.mode & 0o777) !== 0o600)
    throw new Error("VRF credential must be a regular file with mode 0600");
  return point(JSON.parse(readFileSync(path, "utf8")).privateKey);
}
