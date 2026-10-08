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
  let blockNumber = 123;
  let blockHash = "0xabc";
  let unavailable = false;
  const worker = await startWorker({
    bundle,
    storage: newStorage(),
    vapid: await vapidKeys(),
    outbound: async (request) => {
      if (request.url === "https://realms.world/api/ratings/population")
        return request.method === "HEAD"
          ? new Response(null, { headers: { "x-rating-hash": blockHash, "x-rating-block": String(blockNumber) } })
          : Response.json({ block_number: blockNumber, block_hash: blockHash, players: ["0xa"] });
      const payload = await request.json();
      const requests = (Array.isArray(payload) ? payload : [payload]) as {
        id: number;
        method: string;
        params: unknown;
      }[];
      if (unavailable) return new Response(null, { status: 503 });
      const answers = requests.map((rpc) => {
        calls.push(rpc);
        const result = {
          starknet_specVersion: "0.9.0",
          starknet_chainId: "0x534e5f4d41494e",
          starknet_getBlockWithTxHashes: { block_number: blockNumber, block_hash: blockHash },
          starknet_call: [`0x${(points * 10n ** 18n).toString(16)}`, "0x0"],
        }[rpc.method];
        if (result === undefined) throw new Error(`Unexpected RPC method ${rpc.method}`);
        return { jsonrpc: "2.0", id: rpc.id, result };
      });
      return Response.json(Array.isArray(payload) ? [...answers].reverse() : answers[0]);
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
      block_hash: "0xabc",
      ratings: {
        [player.realmsId]: { status: "rated", player: "0xa", rating: "1000" },
      },
    });
    expect(calls.find((call) => call.method === "starknet_call")!.params).toMatchObject({
      request: { contract_address: valuePlaneAddress("mmrToken"), calldata: ["0xa"] },
      block_id: { block_hash: "0xabc" },
    });
    points = 1300n;
    blockNumber = 124;
    blockHash = "0xabd";
    expect(await (await read()).json()).toMatchObject({ ratings: { [player.realmsId]: { rating: "1300" } } });
    const top = await worker.mf.dispatchFetch(`${ORIGIN}/api/ratings/top?realmsId=${player.realmsId}`);
    expect(top.status).toBe(200);
    expect(await top.json()).toMatchObject({
      block_number: 124,
      block_hash: "0xabd",
      total: 1,
      entries: [{ player: "0xa", rating: "1300", rank: 1 }],
      self: { player: "0xa", rating: "1300", rank: 1 },
    });
    unavailable = true;
    expect((await read()).status).toBe(503);
  } finally {
    await worker.dispose();
  }
}, 120_000);
