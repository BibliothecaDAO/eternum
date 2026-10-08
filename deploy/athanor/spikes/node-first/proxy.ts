// Throwaway allowlist at a fresh trial's public boundary. Never use on a live shard.
import { appendFileSync } from "node:fs";
import { hash } from "starknet";
import { args, required, load, normalize, now, type Fixture } from "./common";

const a = args(["fixture", "upstream", "port", "events"]);
const fixture = load<Fixture>(required(a.fixture, "fixture"));
const upstream = new URL(required(a.upstream, "upstream"));
if (upstream.protocol !== "http:" || upstream.username || upstream.password)
  throw new Error("Private trial node HTTP URL required");
const port = Number(required(a.port, "port"));
if (!Number.isInteger(port) || port < 28000) throw new Error("Isolated trial port >=28000 required");
const actors = new Set(fixture.players.map((p) => normalize(p.address)));
const selector = hash.getSelectorFromName(fixture.entrypoint ?? "probe");
const events = required(a.events, "events");
const pending: object[] = [];
const flush = () => {
  if (pending.length)
    appendFileSync(
      events,
      pending
        .splice(0)
        .map((v) => JSON.stringify(v))
        .join("\n") + "\n",
    );
};
setInterval(flush, 100);
process.on("SIGTERM", () => {
  flush();
  process.exit(0);
});
Bun.serve({
  hostname: "127.0.0.1",
  port,
  idleTimeout: 120,
  async fetch(request) {
    const received = now();
    try {
      const text = await request.text();
      const call = JSON.parse(text);
      const tx = call.params?.[0];
      if (call.method === "starknet_addInvokeTransaction") {
        const c = tx?.calldata;
        if (
          tx.type !== "INVOKE" ||
          BigInt(tx.version) !== 3n ||
          BigInt(tx.tip) !== 0n ||
          !actors.has(normalize(tx.sender_address)) ||
          !Array.isArray(tx.signature) ||
          tx.signature.length !== 3 ||
          !Array.isArray(c) ||
          c.length !== (fixture.game ? 10 : 9) ||
          BigInt(c[0]) !== 1n ||
          normalize(c[1]) !== normalize(fixture.contract) ||
          normalize(c[2]) !== normalize(selector) ||
          BigInt(c[3]) !== (fixture.game ? 6n : 5n)
        )
          return Response.json({
            jsonrpc: "2.0",
            id: call.id,
            error: { code: -32601, message: "not a spike invocation" },
          });
      } else if (
        ![
          "starknet_chainId",
          "starknet_getNonce",
          "starknet_getClassHashAt",
          "starknet_getTransactionReceipt",
          "starknet_getTransactionStatus",
          "starknet_getStorageAt",
          "starknet_blockNumber",
          "starknet_call",
        ].includes(call.method)
      ) {
        return Response.json({ jsonrpc: "2.0", id: call.id, error: { code: -32601, message: "not public" } });
      }
      const forwarded = now();
      const response = await fetch(new URL("/rpc/v0_10_2", upstream), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: text,
        signal: AbortSignal.timeout(90000),
      });
      const body = await response.text();
      if (call.method === "starknet_addInvokeTransaction")
        pending.push({
          actor: tx.sender_address,
          nonce: tx.nonce,
          receivedNs: received.toString(),
          forwardedNs: forwarded.toString(),
          responseNs: now().toString(),
        });
      return new Response(body, { status: response.status, headers: { "content-type": "application/json" } });
    } catch {
      return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32000, message: "spike proxy failure" } });
    }
  },
});
console.log(JSON.stringify({ spikeProxy: port, actors: actors.size, contract: fixture.contract }));
