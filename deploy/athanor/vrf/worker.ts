import { openProver } from "./native";

declare const self: Worker;
let prover: ReturnType<typeof openProver> | undefined;
self.onmessage = (event: MessageEvent) => {
  const data = event.data;
  try {
    if (data.kind === "start") {
      if (prover) throw new Error("Already initialized");
      prover = openProver(data.keyFile, data.chainId);
      self.postMessage({ kind: "ready", publicKey: prover.publicKey });
    } else if (data.kind === "stamp" && prover) {
      const stamp = prover.stamp(new Uint8Array(data.raw));
      self.postMessage({ kind: "stamp", id: data.id, stamp });
    } else throw new Error("Invalid worker request");
  } catch {
    self.postMessage({ kind: "failed", id: data.id });
  }
};
