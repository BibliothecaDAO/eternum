// Throwaway COPY; emulates separate clients through the loopback trusted proxy.
import { parentPort, workerData } from "node:worker_threads";
import { request, Agent } from "node:http";
import { now } from "../spikes/node-first/clock";

const { url, payloads, barrier } = workerData as {
  url: string;
  payloads: { hash: string; body: string }[];
  barrier: SharedArrayBuffer;
};
const gate = new Int32Array(barrier);
const agent = new Agent({ keepAlive: true, maxSockets: payloads.length, maxFreeSockets: payloads.length });
function send(body: string): Promise<{ sentNs: string; error: string | null }> {
  const id = Number(JSON.parse(body).id);
  const client = `10.88.${Math.floor(id / 250)}.${(id % 250) + 1}`;
  return new Promise((resolve) => {
    const req = request(url, {
      method: "POST",
      agent,
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(body),
        "x-forwarded-for": client,
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
          resolve({ sentNs, error: parsed.error ? `RPC ${parsed.error.code}` : null });
        } catch {
          resolve({ sentNs, error: "invalid response" });
        }
      });
    });
    req.on("error", () => resolve({ sentNs, error: "transport error" }));
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
