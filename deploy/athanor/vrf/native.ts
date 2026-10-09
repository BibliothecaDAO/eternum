import { dlopen, FFIType, ptr } from "bun:ffi";
import { lstatSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { felt, STAMP_TAG, type PlayInvoke } from "./transaction";

const ORDER = 0x800000000000010fffffffffffffffffb781126dcae7b2321e66a241adc64d2fn;
function bytes(value: string): Uint8Array {
  if (!/^0x[0-9a-fA-F]{1,64}$/.test(value)) throw new Error("Invalid fixed-width value");
  return new Uint8Array(Buffer.from(value.slice(2).padStart(64, "0"), "hex"));
}
function hex(bytes: Uint8Array): string {
  return "0x" + Buffer.from(bytes).toString("hex");
}
function privateKey(path: string): Uint8Array {
  const stat = lstatSync(path);
  if (!stat.isFile() || (stat.mode & 0o777) !== 0o600 || stat.uid !== process.getuid?.())
    throw new Error("VRF key file must be owned by this process and mode 0600");
  const data = JSON.parse(readFileSync(path, "utf8")) as { privateKey?: unknown };
  if (typeof data.privateKey !== "string" || !/^0x[0-9a-f]{64}$/.test(data.privateKey))
    throw new Error("Invalid VRF key file");
  const n = BigInt(data.privateKey);
  if (n === 0n || n >= ORDER) throw new Error("Invalid VRF key file");
  return bytes(data.privateKey);
}

// Every worker owns its native handle and key bytes; no key travels over its message channel.
export function openProver(keyFile: string, chainId: string) {
  if (felt(chainId) === undefined) throw new Error("Invalid chain identity");
  const key = privateKey(keyFile),
    chain = bytes(chainId);
  const library = dlopen(fileURLToPath(new URL("./prover/target/release/librealms_vrf_prover.so", import.meta.url)), {
    realms_vrf_public_key: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.u32 },
    realms_vrf_stamp: { args: [FFIType.ptr, FFIType.u64, FFIType.ptr, FFIType.ptr, FFIType.ptr], returns: FFIType.u32 },
  });
  let closed = false;
  const point = new Uint8Array(64);
  if (library.symbols.realms_vrf_public_key(ptr(key), ptr(point)) !== 0) {
    key.fill(0);
    library.close();
    throw new Error("VRF prover initialization failed");
  }
  return {
    publicKey: { x: hex(point.subarray(0, 32)), y: hex(point.subarray(32)) },
    stamp(raw: Uint8Array) {
      if (closed) throw new Error("Transaction refused");
      const output = new Uint8Array(192);
      if (library.symbols.realms_vrf_stamp(ptr(raw), raw.length, ptr(key), ptr(chain), ptr(output)) !== 0)
        throw new Error("Transaction refused");
      const values = Array.from({ length: 6 }, (_, i) => hex(output.subarray(i * 32, (i + 1) * 32)));
      return { transactionHash: values[0]!, suffix: [STAMP_TAG, ...values.slice(1)] };
    },
    close() {
      if (closed) return;
      closed = true;
      key.fill(0);
      library.close();
    },
  };
}
export interface Stamp {
  transactionHash: string;
  suffix: string[];
}
export interface StampProvider {
  stamp(transaction: PlayInvoke): Promise<Stamp>;
}
