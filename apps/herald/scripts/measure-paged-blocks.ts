import { MadaraRpc } from "../src/madara-rpc";
import { manifest, setup } from "../src/native/fixtures";
import { syntheticTransaction, syntheticInvocation } from "../src/native/paged-block-fixtures";

const argument = (name: string, fallback: string) => {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1]!;
};
const COUNT = Number(argument("--transactions", "10000"));
const EVENTS = Number(argument("--events-per-transaction", "6"));
const REQUEST_DELAY_MS = Number(argument("--delay-ms", "3"));
const FAILURE_RATE = Number(argument("--failure-rate", "0.01"));
const MODE = argument("--mode", "cold");
if (
  !Number.isSafeInteger(COUNT) ||
  COUNT <= 0 ||
  !Number.isSafeInteger(EVENTS) ||
  EVENTS <= 0 ||
  !Number.isFinite(REQUEST_DELAY_MS) ||
  REQUEST_DELAY_MS < 0 ||
  !Number.isFinite(FAILURE_RATE) ||
  FAILURE_RATE < 0 ||
  FAILURE_RATE > 1 ||
  !["cold", "live-known", "live-recovery"].includes(MODE)
)
  throw new Error("Invalid synthetic probe inputs");

function startFixtureNode() {
  let maxResponseBytes = 0;
  let requests = 0,
    failures = 0,
    active = 0,
    peakConcurrent = 0,
    random = 0x5eed;
  const methods: Record<string, number> = {};
  let oldResponseBytes = 100;
  for (let index = 0; index < COUNT; index++)
    oldResponseBytes += Buffer.byteLength(JSON.stringify(syntheticTransaction(index, EVENTS))) + 1;
  const reply = (result: unknown, id: unknown) => {
    const body = JSON.stringify({ jsonrpc: "2.0", id, result });
    maxResponseBytes = Math.max(maxResponseBytes, Buffer.byteLength(body));
    return new Response(body, { headers: { "content-type": "application/json" } });
  };
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      if (new URL(request.url).pathname === "/metrics")
        return Response.json({ maxResponseBytes, oldResponseBytes, requests, failures, peakConcurrent, methods });
      const { method, params, id } = await request.json();
      requests++;
      methods[method] = (methods[method] ?? 0) + 1;
      active++;
      peakConcurrent = Math.max(peakConcurrent, active);
      try {
        await Bun.sleep(REQUEST_DELAY_MS);
        random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
        if (random / 2 ** 32 < FAILURE_RATE) {
          failures++;
          return new Response("synthetic unavailability", { status: 503 });
        }
        if (method === "starknet_getBlockWithTxHashes")
          return reply(
            {
              block_number: 10,
              timestamp: 1800,
              ...(params[0] === "pre_confirmed" ? {} : { block_hash: "0xb10", status: "ACCEPTED_ON_L2" }),
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
            const item = syntheticTransaction(index, EVENTS);
            for (
              let event = Math.max(0, start - index * EVENTS);
              event < Math.min(EVENTS, end - index * EVENTS);
              event++
            )
              events.push({
                ...item.receipt.events[event],
                transaction_hash: item.receipt.transaction_hash,
                transaction_index: index,
                event_index: event,
                ...(filter.from_block.block_hash ? { block_number: 10, block_hash: "0xb10" } : {}),
              });
          }
          return reply({ events, ...(end < COUNT * EVENTS ? { continuation_token: String(end) } : {}) }, id);
        }
        const index = Number(BigInt(params[0])) - 100;
        if (method === "starknet_getTransactionByHash") return reply(syntheticInvocation(index), id);
        if (method === "starknet_getTransactionStatus")
          return reply({ finality_status: "ACCEPTED_ON_L2", execution_status: "SUCCEEDED" }, id);
        throw new Error("Unexpected synthetic RPC method");
      } finally {
        active--;
      }
    },
  });
  console.log(JSON.stringify({ url: server.url.origin }));
}

async function measure() {
  // A separate process owns the synthetic node; its fixture memory is not counted as Herald memory.
  const child = Bun.spawn([process.execPath, import.meta.path, ...process.argv.slice(2), "--fixture-node"], {
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
    const block = await rpc.readBlock(10, manifest.world.address, {
      retainTransactions: MODE !== "cold",
      ...(MODE === "live-known"
        ? { knownTransaction: (hash: string) => syntheticInvocation(Number(BigInt(hash)) - 100) }
        : {}),
    });
    const readMs = performance.now() - readStart;
    const foldStart = performance.now();
    const result = await native.replay({ fold, rpc: { readBlock: async () => block }, fromBlock: 10, toBlock: 10 });
    const foldMs = performance.now() - foldStart;
    const metrics = await (await fetch(`${url}/metrics`)).json();
    console.log(
      JSON.stringify({
        mode: MODE,
        delayMs: REQUEST_DELAY_MS,
        failureRate: FAILURE_RATE,
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
