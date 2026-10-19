// @vitest-environment node
import { expect, it } from "vitest";
import type { Structure } from "@bibliothecadao/types";
import { guardActions, nextAttentionItem, resolveStructureAttention, type CombatHistory } from "./attention-policy";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";

const ME = "0xme";
/** The current stream generation: the last handshake. */
const STREAM = 7;
const THEM = "0xthem";
const structure = (entityId: number) => ({ entityId }) as Structure;
const guard = (entityId: number, end: number) =>
  ({ structure_id: BigInt(entityId), troops: { battle_cooldown_end: end } }) as NativeRows["Guard"];
/** How a story arrived: over this session's live stream, or read from history only. */
type Arrival = "live" | "history";
const story = (block: number, kind: string, owner: string | null, payload: Record<string, unknown>, by: Arrival) => ({
  story: kind,
  owner,
  storyPayload: payload,
  position: { block, transactionIndex: 0, eventIndex: 0 },
  confirmation: { preconfirmed: false, confirmedAfterAttach: by === "live" },
  streamGeneration: by === "live" ? STREAM : null,
});
/** A battle in `block` against structure `defender`'s guards, struck by `striker` while `holder` held it. */
const battle = (
  block: number,
  defender: number,
  striker: string,
  holder: string,
  by: Arrival = "live",
  attacker = 900,
) =>
  story(
    block,
    "BattleEvent",
    striker,
    {
      attacker_id: attacker,
      defender_id: defender,
      attacker: { player: striker },
      defender: { player: holder },
    },
    by,
  );
const raid = (block: number, structureId: number, raider: string, holder: string, by: Arrival = "live") =>
  story(block, "RaidEvent", raider, { structure_id: structureId, player: raider, target_owner: holder }, by);
const reinforce = (block: number, structureId: number, by: Arrival = "live") =>
  story(
    block,
    "TroopsTransferred",
    ME,
    { source: { Explorer: 5 }, target: { Guard: { structure_id: structureId, slot: 0 } } },
    by,
  );
/** `complete`: Herald's history held every story through the block the facts were read at. */
const history = (stories: Parameters<typeof guardActions>[0], complete = false): CombatHistory => ({
  actions: guardActions(stories, STREAM),
  isPlayer: (address) => address === ME,
  complete,
});
const attacked = (guards: NativeRows["Guard"][], combat: CombatHistory | null, now = 120) =>
  [
    ...resolveStructureAttention([structure(1), structure(2), structure(3)], [], now, guards, combat).attackedIds,
  ].toSorted();

it("counts attacked structures once and deduplicates navigation with arrival targets", () => {
  const combat = history([battle(90, 3, THEM, ME)]);
  const result = resolveStructureAttention(
    [structure(3), structure(2), structure(1)],
    [3, 1, 1, 99],
    100,
    [guard(3, 110), guard(3, 120)],
    combat,
  );
  expect(result.attackedCount).toBe(1);
  expect(result.targets.map((target) => target.entityId)).toEqual([1, 3]);
});
it("expires attacks at the same boundary as battle badges", () => {
  expect(attacked([guard(1, 120)], history([battle(60, 1, THEM, ME)]))).toEqual([]);
});
it("flags a structure another player's army struck, live, while the player held it, by battle or raid", () => {
  expect(attacked([guard(1, 170), guard(2, 170)], history([battle(90, 1, THEM, ME), raid(95, 2, THEM, ME)]))).toEqual([
    1, 2,
  ]);
});
it("never flags the player's own capture, nor a hit on the structure before it was theirs", () => {
  // The Obsidian Hyperstructure: someone else fought its former holder, then the player captured it.
  const combat = history([battle(80, 1, THEM, "0xformer"), battle(95, 1, ME, "0xformer")]);
  expect(attacked([guard(1, 170)], combat)).toEqual([]);
});
it("never flags a cooldown whose latest action was the player's own: a sortie or troops moved in", () => {
  expect(attacked([guard(1, 170)], history([battle(90, 1, THEM, ME), battle(110, 77, ME, THEM, "live", 1)]))).toEqual(
    [],
  );
  expect(attacked([guard(1, 170)], history([battle(90, 1, THEM, ME), reinforce(110, 1)]))).toEqual([]);
});
it("stays silent while the latest known action is read from history only: a newer one may not be read yet", () => {
  // Review case: ranged hits at 10, 20 and 30 expired by 100; the guards' own sortie at 110 set the cooldown to 170,
  // and its story is not read yet. Nothing proves the hits behind the current cooldown.
  const hostileHits = [
    battle(10, 1, THEM, ME, "history"),
    battle(20, 1, THEM, ME, "history"),
    battle(30, 1, THEM, ME, "history"),
  ];
  expect(attacked([guard(1, 170)], history(hostileHits))).toEqual([]);
  expect(attacked([guard(1, 170)], history([...hostileHits, battle(110, 77, ME, THEM, "live", 1)]))).toEqual([]);
  expect(attacked([guard(1, 170)], null)).toEqual([]);
  expect(attacked([guard(1, 170)], history([]))).toEqual([]);
});
it("recovers an attack after a reload once history is complete through the block the facts were read at", () => {
  const hostileHits = [battle(20, 1, THEM, ME, "history"), battle(30, 1, THEM, ME, "history")];
  expect(attacked([guard(1, 170)], history(hostileHits, true))).toEqual([1]);
  // The guards' own sortie at 110 is in the complete history: it set the cooldown, not the hits.
  expect(attacked([guard(1, 170)], history([...hostileHits, battle(110, 77, ME, THEM, "history", 1)], true))).toEqual(
    [],
  );
  expect(attacked([guard(1, 170)], history([...hostileHits, reinforce(110, 1, "history")], true))).toEqual([]);
});
it("passes over a pre-confirmed action an earlier stream delivered, which may never have landed", () => {
  const unlanded = {
    ...reinforce(0, 1, "history"),
    position: { block: null, transactionIndex: 0, eventIndex: 0 },
    confirmation: { preconfirmed: true },
  };
  expect(attacked([guard(1, 170)], history([battle(30, 1, THEM, ME, "history"), unlanded], true))).toEqual([1]);
});
it("flags a hostile hit that comes live after the player's own action", () => {
  expect(attacked([guard(1, 170)], history([battle(80, 1, ME, "0xformer"), battle(115, 1, THEM, ME)]))).toEqual([1]);
  expect(
    attacked([guard(1, 170)], history([battle(110, 77, ME, THEM, "history", 1), battle(115, 1, THEM, ME)])),
  ).toEqual([1]);
});
it("orders actions by their place on the chain, a pre-confirmed one newest", () => {
  const preconfirmedOwn = {
    ...battle(0, 77, ME, THEM, "live", 1),
    position: { block: null, transactionIndex: 0, eventIndex: 0 },
  };
  const pending = { ...preconfirmedOwn, confirmation: { preconfirmed: true } };
  expect(attacked([guard(1, 170)], history([battle(115, 1, THEM, ME), pending]))).toEqual([]);
});
it("cycles attention before suggestions and recovers when an item disappears", () => {
  const items = [{ key: "attention:1" }, { key: "attention:3" }, { key: "suggestion:1" }];
  expect(nextAttentionItem(items, null)?.key).toBe("attention:1");
  expect(nextAttentionItem(items, "attention:1")?.key).toBe("attention:3");
  expect(nextAttentionItem(items, "attention:3")?.key).toBe("suggestion:1");
  expect(nextAttentionItem(items, "suggestion:1")?.key).toBe("attention:1");
  expect(nextAttentionItem(items, "removed")?.key).toBe("attention:1");
  expect(nextAttentionItem([], null)).toBeUndefined();
});
it("stays silent on actions an earlier stream delivered, after a reconnect or a replacement snapshot", () => {
  const before = battle(30, 1, THEM, ME);
  const earlier = { ...before, streamGeneration: STREAM - 1 };
  expect(attacked([guard(1, 170)], history([before]))).toEqual([1]);
  expect(attacked([guard(1, 170)], history([earlier]))).toEqual([]);
  expect(attacked([guard(1, 170)], history([earlier, battle(115, 1, THEM, ME)]))).toEqual([1]);
});
