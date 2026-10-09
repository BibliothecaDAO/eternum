import { MadaraRpc } from "../src/madara-rpc";
import { manifest, setup } from "../src/native/fixtures";
import { syntheticTransaction } from "../src/native/paged-block-fixtures";

const COUNT = 10_000;
const EVENTS = 6;

function startFixtureNode() {
  let maxResponseBytes = 0;
  let oldResponseBytes = 100;
  for (let index = 0; index < COUNT; index++)
    oldResponseBytes += Buffer.byteLength(JSON.stringify(syntheticTransaction(index))) + 1;
  const reply = (result: unknown, id: unknown) => {
    const body = JSON.stringify({ jsonrpc: "2.0", id, result });
    maxResponseBytes = Math.max(maxResponseBytes, Buffer.byteLength(body));
    return new Response(body, { headers: { "content-type": "application/json" } });
  };
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      if (new URL(request.url).pathname === "/metrics") return Response.json({ maxResponseBytes, oldResponseBytes });
      const { method, params, id } = await request.json();
      if (method === "starknet_getBlockWithTxHashes")
        return reply(
          {
            block_number: 10,
            timestamp: 1800,
            block_hash: "0xb10",
            status: "ACCEPTED_ON_L2",
            transactions: Array.from(
              { length: COUNT },
              (_, index) => `0x${(index + 100).toString(16).padStart(64, "0")}`,
            ),
          },
          id,
        );
      if (method === "starknet_getEvents") {
        const filter = params[0],
          start = Number(filter.continuation_token ?? 0),
          end = Math.min(start + filter.chunk_size, COUNT * EVENTS);
        const events = [];
        for (let index = Math.floor(start / EVENTS); index < Math.ceil(end / EVENTS); index++) {
          const item = syntheticTransaction(index);
          for (let event = Math.max(0, start - index * EVENTS); event < Math.min(EVENTS, end - index * EVENTS); event++)
            events.push({
              ...item.receipt.events[event],
              transaction_hash: item.receipt.transaction_hash,
              transaction_index: index,
              event_index: event,
              block_number: 10,
              block_hash: "0xb10",
            });
        }
        return reply({ events, ...(end < COUNT * EVENTS ? { continuation_token: String(end) } : {}) }, id);
      }
      const index = Number(BigInt(params[0])) - 100;
      if (method === "starknet_getTransactionByHash") return reply(syntheticTransaction(index).transaction, id);
      if (method === "starknet_getTransactionStatus")
        return reply({ finality_status: "ACCEPTED_ON_L2", execution_status: "SUCCEEDED" }, id);
      throw new Error("Unexpected synthetic RPC method");
    },
  });
  console.log(JSON.stringify({ url: server.url.origin }));
}

async function measure() {
  // A separate process owns the synthetic node; its fixture memory is not counted as Herald memory.
  const child = Bun.spawn([process.execPath, import.meta.path, "--fixture-node"], {
    stdout: "pipe",
    stderr: "inherit",
  });
  let rpc: MadaraRpc | undefined;
  try {
    const reader = child.stdout.getReader();
    const first = await reader.read();
    const { url } = JSON.parse(new TextDecoder().decode(first.value));
    reader.releaseLock();
    rpc = new MadaraRpc(url);
    const { native, fold } = setup();
    const baselineRss = process.memoryUsage().rss;
    const readStart = performance.now();
    const block = await rpc.readBlock(10, manifest.world.address);
    const readMs = performance.now() - readStart;
    const foldStart = performance.now();
    const result = await native.replay({ fold, rpc: { readBlock: async () => block }, fromBlock: 10, toBlock: 10 });
    const foldMs = performance.now() - foldStart;
    const metrics = await (await fetch(`${url}/metrics`)).json();
    console.log(
      JSON.stringify({
        transactions: COUNT,
        events: COUNT * EVENTS,
        readMs,
        foldMs,
        peakRssMiB: process.resourceUsage().maxRSS / 1024,
        baselineRssMiB: baselineRss / 1048576,
        retainedRows: fold.retainedRowCount(),
        decodedEvents: result.events.length,
        ...metrics,
      }),
    );
  } finally {
    rpc?.close();
    child.kill();
    await child.exited;
  }
}

if (process.argv.includes("--fixture-node")) startFixtureNode();
else await measure();
