import dev from "../../../contracts/common/addresses/dev.json";
import { hash } from "starknet";
import { beforeAll, expect, it } from "vitest";
import { environmentL2 } from "@realms-world/chain";
import {
  buildWorkerBundle,
  migrationStatements,
  newStorage,
  ORIGIN,
  pause,
  startWorker,
  vapidKeys,
} from "./workerd-harness";

const MMR_UPDATED = hash.getSelectorFromName("MMRUpdated");
const tokenDeployedAt = (params: unknown) =>
  (params as { block_id: { block_number: number } }).block_id.block_number >= 100;
let bundle: string;
beforeAll(() => {
  bundle = buildWorkerBundle();
}, 180_000);

it("reads wallet owners through the deployed Worker's SDK and serves new ledger values once results were posted", async () => {
  const calls: { method: string; params: unknown }[] = [];
  let points = 1000n;
  let blockNumber = 123;
  let blockHash = "0xabc";
  let unavailable = false;
  const worker = await startWorker({
    bundle,
    environment: "staging",
    storage: newStorage(),
    vapid: await vapidKeys(),
    outbound: async (request) => {
      const payload = await request.json();
      const requests = (Array.isArray(payload) ? payload : [payload]) as {
        id: number;
        method: string;
        params: unknown;
      }[];
      if (unavailable) return new Response(null, { status: 503 });
      const answers = requests.map((rpc) => {
        calls.push(rpc);
        if (rpc.method === "starknet_getClassHashAt" && !tokenDeployedAt(rpc.params))
          return { jsonrpc: "2.0", id: rpc.id, error: { code: 20, message: "Contract not found" } };
        const result = {
          starknet_specVersion: "0.9.0",
          starknet_chainId: "0x534e5f4d41494e",
          starknet_getBlockWithTxHashes: { block_number: blockNumber, block_hash: blockHash },
          starknet_call: [`0x${(points * 10n ** 18n).toString(16)}`, "0x0"],
          starknet_getClassHashAt: "0x1",
          starknet_getEvents: { events: [{ keys: [MMR_UPDATED, "0xa"], data: [] }] },
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
    const resultsPosted = async () => {
      await pause(5);
      const readers = await worker.mf.getDurableObjectNamespace("RATING_READER");
      const reader = readers.get(readers.idFromName(environmentL2("staging").chain));
      await (reader as unknown as { ratingsChanged(): Promise<void> }).ratingsChanged();
    };
    const read = () => worker.mf.dispatchFetch(`${ORIGIN}/api/ratings?players=0xa`);
    const response = await read();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      block_number: 123,
      block_hash: "0xabc",
      ratings: {
        "0xa": { status: "rated", player: "0xa", rating: "1000" },
      },
    });
    expect(calls.find((call) => call.method === "starknet_call")!.params).toMatchObject({
      request: { contract_address: dev.mmrToken, calldata: ["0xa"] },
      block_id: { block_hash: "0xabc" },
    });
    points = 1300n;
    blockNumber = 124;
    blockHash = "0xabd";
    // The ledger moved, but nobody said results were posted: the kept answer still stands.
    expect(await (await read()).json()).toMatchObject({ ratings: { "0xa": { rating: "1000" } } });
    await pause(5);
    await resultsPosted();
    await pause(5);
    expect(await (await read()).json()).toMatchObject({ ratings: { "0xa": { rating: "1300" } } });
    const top = await worker.mf.dispatchFetch(`${ORIGIN}/api/ratings/top?player=0xa`);
    expect(top.status).toBe(200);
    expect(await top.json()).toMatchObject({
      block_number: 124,
      block_hash: "0xabd",
      entries: [{ player: "0xa", rating: "1300", rank: 1 }],
      self: { player: "0xa", rating: "1300", rank: 1 },
    });
    await worker.db
      .prepare('UPDATE "user" SET "name" = ?, "image" = ? WHERE "realmsId" = ?')
      .bind("Aster", "portrait-1", player.realmsId)
      .run();
    await worker.db
      .prepare('INSERT INTO "realms_accounts" ("address", "realmsId") VALUES (?, ?)')
      .bind("0x11", player.realmsId)
      .run();
    const namedTop = await worker.mf.dispatchFetch(`${ORIGIN}/api/ratings/top?player=0x0a`);
    expect(await namedTop.json()).toMatchObject({
      entries: [{ profile: { realmsId: player.realmsId, name: "Aster", portrait: "portrait-1" } }],
      self: { profile: { name: "Aster" } },
    });
    await worker.db.prepare('UPDATE "user" SET "address"=? WHERE "realmsId"=?').bind("0xb", player.realmsId).run();
    expect(
      await (await worker.mf.dispatchFetch(`${ORIGIN}/api/ratings?players=0x0a&block_hash=${blockHash}`)).json(),
    ).toMatchObject({ ratings: { "0x0a": { status: "rated", player: "0xa", rating: "1300" } } });
    await worker.db.prepare('UPDATE "user" SET "address"=? WHERE "realmsId"=?').bind("0xa", player.realmsId).run();
    const tokenCalls = calls.filter((call) => call.method === "starknet_call").length;
    await worker.db.prepare('UPDATE "user" SET "name" = ? WHERE "realmsId" = ?').bind("Renamed", player.realmsId).run();
    expect(await (await worker.mf.dispatchFetch(`${ORIGIN}/api/ratings/top`)).json()).toMatchObject({
      entries: [{ profile: { name: "Renamed" } }],
    });
    await worker.db.prepare('UPDATE "user" SET "address" = NULL WHERE "realmsId" = ?').bind(player.realmsId).run();
    expect(await (await worker.mf.dispatchFetch(`${ORIGIN}/api/ratings/top`)).json()).toMatchObject({
      entries: [{ profile: null }],
    });
    expect(await (await read()).json()).toMatchObject({ ratings: { "0xa": { player: "0xa", rating: "1300" } } });
    // Profiles are read fresh each time; the ratings are kept, so none of these asks reached the chain.
    expect(calls.filter((call) => call.method === "starknet_call").length).toBe(tokenCalls);
    expect(
      calls
        .filter((call) => call.method === "starknet_getEvents")
        .map((call) => (call.params as { filter: { from_block: unknown; to_block: unknown } }).filter),
    ).toEqual([
      expect.objectContaining({
        address: dev.mmrToken,
        from_block: { block_number: 100 },
        to_block: { block_number: 124 },
      }),
    ]);
    await worker.db.prepare('UPDATE "user" SET "address" = ? WHERE "realmsId" = ?').bind("0xa", player.realmsId).run();
    unavailable = true;
    expect((await read()).status).toBe(200);
    await resultsPosted();
    await pause(5);
    expect((await read()).status).toBe(503);
  } finally {
    await worker.dispose();
  }
}, 120_000);
