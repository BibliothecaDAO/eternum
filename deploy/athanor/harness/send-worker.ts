import { parentPort, workerData } from "node:worker_threads";
import * as http from "node:http";
import * as https from "node:https";
const { request, Agent } = new URL(workerData.url).protocol === "https:" ? https : http;
import { now } from "./clock";

const { url, payloads, barrier } = workerData as {
  url: string;
  payloads: { hash: string; body: string }[];
  barrier: SharedArrayBuffer;
};
const gate = new Int32Array(barrier);
const agent = new Agent({ keepAlive: true, maxSockets: payloads.length, maxFreeSockets: payloads.length });
function send(body: string): Promise<{ sentNs: string; acknowledgedNs: string | null; error: string | null }> {
  return new Promise((resolve) => {
    const req = request(url, {
      method: "POST",
      agent,
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(body),
      },
    });
    let sentNs = now().toString();
    req.on("socket", (socket) => {
      socket.setNoDelay(true);
      sentNs = now().toString();
      req.end(body);
    });
    req.on("response", (response) => {
      let data = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => (data += chunk));
      response.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve({
            sentNs,
            acknowledgedNs: now().toString(),
            error: parsed.error ? `RPC ${parsed.error.code}` : null,
          });
        } catch {
          resolve({ sentNs, acknowledgedNs: now().toString(), error: "invalid response" });
        }
      });
    });
    req.on("error", () => resolve({ sentNs, acknowledgedNs: null, error: "transport error" }));
    req.setTimeout(90000, () => req.destroy());
  });
}
async function main() {
  const warm = await Promise.all(
    payloads.map((_, i) => send(JSON.stringify({ jsonrpc: "2.0", id: i, method: "starknet_chainId", params: [] }))),
  );
  if (warm.some((r) => r.error)) throw new Error("warm connections failed");
  parentPort!.postMessage({ ready: true });
  Atomics.wait(gate, 0, 0);
  const rows = await Promise.all(payloads.map(async (p) => ({ hash: p.hash, ...(await send(p.body)) })));
  agent.destroy();
  parentPort!.postMessage({ rows });
  parentPort!.close();
}
main().catch(() => {
  parentPort!.postMessage({ failed: true });
  process.exitCode = 1;
  parentPort!.close();
});
