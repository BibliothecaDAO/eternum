import { dlopen, ptr, suffix } from "bun:ffi";
import { join } from "node:path";

const FIELD = 2n ** 251n + 17n * 2n ** 192n + 1n;
const WIDTH = 32;
const RECORD = 6 * WIDTH;

export function feltBytes(value: string): Buffer {
  const integer = BigInt(value);
  if (integer < 0n || integer >= FIELD) throw new Error("Noncanonical VRF input");
  return Buffer.from(integer.toString(16).padStart(64, "0"), "hex");
}

const hex = (value: Uint8Array) => `0x${Buffer.from(value).toString("hex")}`;

/** Synchronous native calls; the proxy runs them in Bun workers so forwarding stays responsive. */
export class NativeProver {
  private readonly library;
  private closed = false;
  constructor(private readonly key: Buffer, libraryPath = join(import.meta.dir, `prover/target/release/libnode_first_vrf_prover.${suffix}`)) {
    if (key.length !== WIDTH) throw new Error("VRF scalar must be 32 bytes");
    this.library = dlopen(libraryPath, {
      node_first_vrf_public_key: { args: ["ptr", "ptr"], returns: "u32" },
      node_first_vrf_prove: { args: ["ptr", "ptr", "usize", "usize", "ptr"], returns: "u32" },
    });
  }

  publicKey(): [string, string] {
    this.requireOpen();
    const output = Buffer.alloc(64);
    const status = this.library.symbols.node_first_vrf_public_key(ptr(this.key), ptr(output));
    if (status !== 0) throw new Error(`VRF public-key derivation failed (${status})`);
    return [hex(output.subarray(0, WIDTH)), hex(output.subarray(WIDTH))];
  }

  proofs(seeds: readonly string[], threads: 1 | 2 | 4 = 1): string[][] {
    this.requireOpen();
    if (!seeds.length || seeds.length > 4096) throw new Error("VRF batch must contain 1..4096 seeds");
    const input = Buffer.concat(seeds.map(feltBytes));
    const output = Buffer.alloc(seeds.length * RECORD);
    const status = this.library.symbols.node_first_vrf_prove(ptr(this.key), ptr(input), seeds.length, threads, ptr(output));
    if (status !== 0) throw new Error(`VRF proof generation failed (${status})`);
    return seeds.map((_, index) => Array.from({ length: 6 }, (_, field) => hex(output.subarray(index * RECORD + field * WIDTH, index * RECORD + (field + 1) * WIDTH))));
  }

  close(): void {
    if (!this.closed) {
      this.closed = true;
      this.library.close();
      this.key.fill(0);
    }
  }

  private requireOpen(): void {
    if (this.closed) throw new Error("VRF prover is closed");
  }
}
