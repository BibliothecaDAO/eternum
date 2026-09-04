// Lab-only: logs what a WebSocket subscriber sees (heads, pre-confirmed events, new transactions) as JSON lines,
// reconnecting across a sequencer restart. Usage: pnpm lab:probe-ws <out.jsonl>; runs for 60 s.
const url = "ws://127.0.0.1:5050/rpc/v0_10_2"; const out = process.argv[2]; const fs = await import("node:fs");
const log = (o) => fs.appendFileSync(out, JSON.stringify({ t: Date.now(), ...o }) + "\n");
let gen = 0;
function connect() {
  const ws = new WebSocket(url); const g = ++gen;
  ws.onopen = () => { log({ gen: g, ev: "open" });
    ws.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "starknet_subscribeNewHeads", params: {} }));
    ws.send(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "starknet_subscribeEvents", params: { finality_status: "PRE_CONFIRMED" } }));
    ws.send(JSON.stringify({ jsonrpc: "2.0", id: 3, method: "starknet_subscribeNewTransactions", params: { finality_status: ["PRE_CONFIRMED", "ACCEPTED_ON_L2"] } })); };
  ws.onmessage = (e) => { const m = JSON.parse(e.data);
    if (m.id) return log({ gen: g, ev: "sub", id: m.id, result: m.result, error: m.error });
    const r = m.params?.result;
    if (m.method === "starknet_subscriptionNewHeads") log({ gen: g, ev: "head", block: r.block_number, hash: r.block_hash?.slice(0, 12) });
    else if (m.method === "starknet_subscriptionEvents") log({ gen: g, ev: "event", block: r.block_number, tx: r.transaction_hash?.slice(0, 14), from: r.from_address?.slice(0, 10), keys0: r.keys?.[0]?.slice(0, 10), finality: r.finality_status });
    else if (m.method === "starknet_subscriptionNewTransaction" || m.method === "starknet_subscriptionNewTransactions") log({ gen: g, ev: "newtx", tx: (r.transaction_hash ?? r.transaction?.transaction_hash ?? r)?.toString().slice(0, 14), finality: r.finality_status });
    else log({ gen: g, ev: "other", method: m.method, params: JSON.stringify(m.params).slice(0, 200) }); };
  ws.onclose = () => { log({ gen: g, ev: "close" }); setTimeout(connect, 200); };
  ws.onerror = () => {};
}
connect(); setTimeout(() => process.exit(0), 60000);
