import { dlopen, ptr, suffix } from "bun:ffi";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { feltBytes } from "./native";
import { invokeHash } from "./transaction";

let key: Buffer;
function loadLibrary() {
  return dlopen(join(import.meta.dir, `prover/target/release/libnode_first_vrf_prover.${suffix}`), {
    node_first_vrf_invoke_hash: { args: ["ptr", "usize", "ptr", "ptr"], returns: "u32" },
    node_first_vrf_prove: { args: ["ptr", "ptr", "usize", "usize", "ptr"], returns: "u32" },
  });
}
let library: ReturnType<typeof loadLibrary>;
self.onmessage = (event: MessageEvent) => {
  const message = event.data;
  if (message.kind === "initialize") {
    key = feltBytes(readFileSync(message.keyFile, "utf8").trim());
    library = loadLibrary();
    self.postMessage({ kind: "ready" });
    return;
  }
  if (message.echo) {
    self.postMessage({
      id: message.id,
      proof: Array.from({ length: 5 }, () => "0x" + "1234".repeat(16)),
      stages: { hashMs: 0, inputEncodingMs: 0, nativeMs: 0, suffixEncodingMs: 0 },
    });
    return;
  }
  const started = performance.now();
  let seed: string;
  if (message.native) {
    const raw = new Uint8Array(message.raw),
      chain = feltBytes(message.chain),
      result = Buffer.alloc(32);
    const status = library.symbols.node_first_vrf_invoke_hash(ptr(raw), raw.byteLength, ptr(chain), ptr(result));
    if (status !== 0) throw new Error(`Profile native hash failed (${status})`);
    seed = "0x" + result.toString("hex");
  } else seed = invokeHash(message.tx, message.chain);
  const hashed = performance.now();
  const input = feltBytes(seed);
  const output = Buffer.alloc(192);
  const encoded = performance.now();
  const status = library.symbols.node_first_vrf_prove(ptr(key), ptr(input), 1, 1, ptr(output));
  const proved = performance.now();
  if (status !== 0) throw new Error(`Profile prover failed (${status})`);
  const proof = Array.from(
    { length: 6 },
    (_, field) => "0x" + output.subarray(field * 32, (field + 1) * 32).toString("hex"),
  ).slice(0, 5);
  const suffixed = performance.now();
  self.postMessage({
    id: message.id,
    proof,
    stages: {
      hashMs: hashed - started,
      inputEncodingMs: encoded - hashed,
      nativeMs: proved - encoded,
      suffixEncodingMs: suffixed - proved,
    },
  });
};
