import { afterEach, expect, it, vi } from "vitest";
import { readDeepSiteWatches } from "../../realms/server/deep-site-watch";
import {
  snapshot,
  siteSnapshot,
  GAME_ID,
  PLAYER_ACCOUNT,
  ARMIES_TICK_SECONDS,
} from "../../realms/server/fixtures/shard-world";
import { LiveWorld } from "./live-world";
import { WorldFold } from "./world-fold";
import { setup, schema, receipt, rowEvent } from "./native/fixtures";
import { nativeRowKey } from "./native/row-key";
import type { MadaraRpc } from "./madara-rpc";

async function heldQuarry(now: number) {
  const { decoder, fold, native } = setup();
  const facts = siteSnapshot(snapshot(null, null, null, [PLAYER_ACCOUNT], "realm", null), {
    troops: 1000,
    aspect: 2,
    lore: true,
    lastTick: Math.floor(now / ARMIES_TICK_SECONDS),
  });
  const checkpoint = fold.checkpoint();
  for (const model of checkpoint.models) {
    const rows = facts.models.find((row) => row.model === model.model)?.rows ?? [];
    const keys = schema.models.find(({ name }) => name === model.model)?.keys;
    if (rows.length && !keys) throw new Error(`Missing keys for ${model.model}`);
    model.rows = rows.map((row) => ({
      entity_id: nativeRowKey(
        keys!.map(({ name }) =>
          typeof row.value[name] === "boolean" ? String(Number(row.value[name])) : String(row.value[name]),
        ),
      ),
      key: Object.fromEntries(keys!.map(({ name }) => [name, row.value[name]])),
      value: row.value,
    }));
  }
  const head = { block_number: 11, timestamp: now, transactions: [] };
  const confirmedFold = WorldFold.restore(decoder.registry, checkpoint);
  const live = new LiveWorld({
    native,
    registry: decoder.registry,
    chain: "0xa",
    checkpointEveryBlocks: 100,
    checkpointStore: { save: async () => undefined },
    confirmedBlock: 10,
    confirmedFold,
    rpc: {
      getBlockHeader: async () => head,
      getPreconfirmedHeader: async () => ({ ...head, block_number: 12 }),
      readBlock: async () => head,
    } as unknown as MadaraRpc,
  });
  await live.acceptSubscribedHead(head);
  return { live, confirmedFold, native };
}

afterEach(() => vi.unstubAllGlobals());

it("plans a Deep site opportunity from Herald's actor snapshot with public rival troops and private research", async () => {
  const now = Math.floor(Date.now() / 1000);
  const { live, confirmedFold, native } = await heldQuarry(now);
  const shared = live.snapshot(String(GAME_ID), ["Guard", "ExplorerTroops", "RealmKnowledge"], PLAYER_ACCOUNT);
  expect(
    shared.models.find(({ model }) => model === "Guard")!.rows.map(({ value }) => Number(value.structure_id)),
  ).toEqual([800, 801, 802]);
  const ownerOnly = live.snapshot(String(GAME_ID), ["ExplorerTroops"], PLAYER_ACCOUNT, PLAYER_ACCOUNT);
  expect(ownerOnly.models[0]!.rows.map(({ value }) => Number(value.explorer_id))).toEqual([7]);
  vi.stubGlobal("fetch", async (address: string) => {
    const url = new URL(address);
    if (url.pathname === "/manifest") return Response.json({ version: 1, releaseSchemas: { "1": schema.identity } });
    return Response.json(
      live.snapshot(
        String(GAME_ID),
        url.searchParams.get("models")?.split(","),
        url.searchParams.get("actor") ?? undefined,
        url.searchParams.get("owner") ?? undefined,
      ),
    );
  });
  const watches = await readDeepSiteWatches(
    "https://herald.test",
    {
      gameId: GAME_ID,
      actor: PLAYER_ACCOUNT,
      owner: "player",
    },
    now * 1000,
  );
  expect(watches).toEqual([
    expect.objectContaining({
      gameId: GAME_ID,
      actor: PLAYER_ACCOUNT,
      owner: "player",
      home: "5",
      siteId: "801",
      siteName: "Quarry",
      dueAt: (Math.floor(now / ARMIES_TICK_SECONDS) + 1) * ARMIES_TICK_SECONDS * 1000,
      attempts: 0,
    }),
  ]);
  native.applyReceipt(
    confirmedFold,
    receipt([rowEvent("DeepGuard", [String(GAME_ID), "8"], { site_id: 999, slot: 0 })]),
    12,
    0,
  );
  const moved = live.snapshot(String(GAME_ID), ["ExplorerTroops"], PLAYER_ACCOUNT);
  expect(moved.models[0]!.rows.map(({ value }) => Number(value.explorer_id))).toEqual([7]);
});
