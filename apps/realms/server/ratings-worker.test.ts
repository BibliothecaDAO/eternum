import { beforeAll, expect, it } from "vitest";
import { valuePlaneAddress } from "@realms-world/chain";
import { buildWorkerBundle, migrationStatements, newStorage, ORIGIN, startWorker, vapidKeys } from "./workerd-harness";

let bundle: string;
beforeAll(() => {
  bundle = buildWorkerBundle();
}, 180_000);

it("reads linked owners through the deployed Worker's SDK and serves new ledger values without caching", async () => {
  const calls: { method: string; params: unknown }[] = [];
  let points = 1000n;
  let unavailable = false;
  const worker = await startWorker({
    bundle,
    storage: newStorage(),
    vapid: await vapidKeys(),
    outbound: async (request) => {
      const rpc = (await request.json()) as { id: number; method: string; params: unknown };
      calls.push(rpc);
      if (unavailable) return new Response(null, { status: 503 });
      const result = {
        starknet_specVersion: "0.9.0",
        starknet_chainId: "0x534e5f4d41494e",
        starknet_blockNumber: 123,
        starknet_call: [`0x${(points * 10n ** 18n).toString(16)}`, "0x0"],
      }[rpc.method];
      if (result === undefined) throw new Error(`Unexpected RPC method ${rpc.method}`);
      return Response.json({ jsonrpc: "2.0", id: rpc.id, result });
    },
  });
  try {
    await worker.db.batch(migrationStatements().map((statement) => worker.db.prepare(statement)));
    const player = await worker.signInWithEmailCode("ratings@realms.test");
    await worker.db.prepare('UPDATE "user" SET "address" = ? WHERE "realmsId" = ?').bind("0xa", player.realmsId).run();
    const read = () => worker.mf.dispatchFetch(`${ORIGIN}/api/ratings?realmsIds=${player.realmsId}`);
    const response = await read();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      block_number: 123,
      ratings: {
        [player.realmsId]: { status: "rated", player: "0xa", rating: "1000" },
      },
    });
    expect(calls.find((call) => call.method === "starknet_call")!.params).toMatchObject({
      request: { contract_address: valuePlaneAddress("mmrToken"), calldata: ["0xa"] },
      block_id: { block_number: 123 },
    });
    points = 1300n;
    expect(await (await read()).json()).toMatchObject({ ratings: { [player.realmsId]: { rating: "1300" } } });
    unavailable = true;
    expect((await read()).status).toBe(503);
  } finally {
    await worker.dispose();
  }
}, 120_000);
