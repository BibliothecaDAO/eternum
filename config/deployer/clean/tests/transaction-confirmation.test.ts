import { expect, test } from "bun:test";
import { RpcProvider } from "starknet";
import { confirmedTransactionReceipt } from "../shared/transaction";

const HASH = "0x1234";

test("confirms a transaction over HTTP against an RPC that serves no WebSockets", async () => {
  // The node first does not know the transaction, then holds it pre-confirmed, then accepts it.
  const statuses = [null, "PRE_CONFIRMED", "ACCEPTED_ON_L2"];
  const methods: string[] = [];
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      if (request.headers.get("upgrade")) return new Response("RPC method is not public", { status: 403 });
      const call = (await request.json()) as { id: number; method: string };
      methods.push(call.method);
      const answer = (body: object) => Response.json({ jsonrpc: "2.0", id: call.id, ...body });
      if (call.method === "starknet_getTransactionStatus") {
        const status = statuses.length > 0 ? statuses.shift() : "ACCEPTED_ON_L2";
        return status === null
          ? answer({ error: { code: 29, message: "Transaction hash not found" } })
          : answer({ result: { finality_status: status, execution_status: "SUCCEEDED" } });
      }
      if (call.method === "starknet_getTransactionReceipt") return answer({ result: receipt });
      return answer({ error: { code: -32601, message: `unexpected ${call.method}` } });
    },
  });
  try {
    const provider = new RpcProvider({ nodeUrl: `http://127.0.0.1:${server.port}/rpc/v0_10_2` });
    const confirmed = await confirmedTransactionReceipt(provider, HASH);
    expect(confirmed.block_number).toBe(42);
    expect(methods.filter((method) => method === "starknet_getTransactionStatus")).toHaveLength(3);
  } finally {
    server.stop(true);
  }
}, 15_000);

const receipt = {
  type: "INVOKE",
  transaction_hash: HASH,
  actual_fee: { amount: "0x0", unit: "FRI" },
  execution_status: "SUCCEEDED",
  finality_status: "ACCEPTED_ON_L2",
  block_hash: "0x42",
  block_number: 42,
  messages_sent: [],
  events: [],
  execution_resources: { l1_gas: 0, l1_data_gas: 0, l2_gas: 0 },
};
