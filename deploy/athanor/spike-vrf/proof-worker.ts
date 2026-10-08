import { readFileSync, statSync } from "node:fs";
import { feltBytes, NativeProver } from "./native";

let prover: NativeProver | undefined;
self.onmessage = (event: MessageEvent) => {
  const message = event.data;
  try {
    if (message.kind === "initialize") {
      if ((statSync(message.keyFile).mode & 0o077) !== 0) throw new Error("VRF key file must be private");
      prover = new NativeProver(feltBytes(readFileSync(message.keyFile, "utf8").trim()), message.libraryPath);
      self.postMessage({ kind: "ready", publicKey: prover.publicKey() });
      return;
    }
    if (!prover) throw new Error("VRF worker not initialized");
    const seed = prover.invokeHash(new Uint8Array(message.raw), message.chain);
    const proof = prover.proofs([seed])[0].slice(0, 5);
    self.postMessage({ id: message.id, seed, proof });
  } catch (error) {
    self.postMessage({
      kind: "error",
      id: message.id,
      error: error instanceof Error ? error.message : "VRF worker failed",
    });
  }
};
