import { normalizeFelt } from "../model-registry";
import { POSEIDON_WASM_BASE64 } from "./poseidon-wasm.gen";

interface PoseidonExports {
  memory: WebAssembly.Memory;
  buffer(): number;
  poseidon_hash(count: number): number;
}

const MAX_FELTS = 64;
const poseidon = new WebAssembly.Instance(new WebAssembly.Module(Buffer.from(POSEIDON_WASM_BASE64, "base64")))
  .exports as unknown as PoseidonExports;

/**
 * A native row's identity: Starknet Poseidon over its key felts, as the contracts derive it. Every row, history event
 * and nonce id in Herald comes from here, computed by the WebAssembly build of starknet-crypto (apps/herald/poseidon).
 */
export function nativeEntityId(felts: readonly (string | number | bigint)[]): string {
  if (felts.length === 0 || felts.length > MAX_FELTS) throw new Error(`Entity id needs 1 to ${MAX_FELTS} felts`);
  const input = new Uint8Array(poseidon.memory.buffer, poseidon.buffer(), 32 * MAX_FELTS);
  felts.forEach((felt, index) => input.set(feltBytes(felt), 32 * index));
  if (poseidon.poseidon_hash(felts.length) !== 1) throw new Error("Poseidon rejected its input");
  // Hashing can grow the module's memory, which detaches earlier views, so the result is read through a fresh one.
  const hash = new Uint8Array(poseidon.memory.buffer, poseidon.buffer(), 32);
  return normalizeFelt(`0x${Buffer.from(hash).toString("hex")}`);
}

const feltBytes = (felt: string | number | bigint): Uint8Array => {
  const value = BigInt(felt);
  if (value < 0n || value >= 1n << 256n) throw new Error(`Not a felt: ${felt}`);
  return Buffer.from(value.toString(16).padStart(64, "0"), "hex");
};
