// @vitest-environment node
import { expect, it } from "vitest";
import type { Structure } from "@bibliothecadao/types";
import { guardHits, nextAttentionItem, resolveStructureAttention, type CombatHistory } from "./attention-policy";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";

const ME = "0xme";
const THEM = "0xthem";
const COOLDOWN = 60;
const structure = (entityId: number) => ({ entityId }) as Structure;
const guard = (entityId: number, end: number) =>
  ({ structure_id: BigInt(entityId), troops: { battle_cooldown_end: end } }) as NativeRows["Guard"];
/** A battle at `at` against structure `defender`'s guards, struck by `striker` while `holder` held it. */
const battle = (at: number, defender: number, striker: string, holder: string, attacker = 900) => ({
  story: "BattleEvent",
  timestamp: String(at),
  storyPayload: {
    attacker_id: attacker,
    defender_id: defender,
    attacker: { player: striker },
    defender: { player: holder },
  },
});
const raid = (at: number, structureId: number, raider: string, holder: string) => ({
  story: "RaidEvent",
  timestamp: String(at),
  storyPayload: { structure_id: structureId, player: raider, target_owner: holder },
});
const history = (stories: Parameters<typeof guardHits>[0]): CombatHistory => ({
  hits: guardHits(stories),
  cooldownSeconds: COOLDOWN,
  isPlayer: (address) => address === ME,
});
const attacked = (guards: NativeRows["Guard"][], combat: CombatHistory | null, now = 100) =>
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
  expect(attacked([guard(1, 100)], history([battle(60, 1, THEM, ME)]))).toEqual([]);
});
it("flags a structure another player's army struck while the player held it, by battle or raid", () => {
  expect(attacked([guard(1, 130), guard(2, 130)], history([battle(90, 1, THEM, ME), raid(95, 2, THEM, ME)]))).toEqual([
    1, 2,
  ]);
});
it("never flags the player's own capture, nor a hit on the structure before it was theirs", () => {
  // The Obsidian Hyperstructure: someone else fought its former holder, then the player captured it.
  const combat = history([battle(80, 1, THEM, "0xformer"), battle(95, 1, ME, "0xformer")]);
  expect(attacked([guard(1, 150)], combat)).toEqual([]);
});
it("flags a hostile hit that comes after the player's own capture", () => {
  const combat = history([battle(80, 1, ME, "0xformer"), battle(95, 1, THEM, ME)]);
  expect(attacked([guard(1, 150)], combat)).toEqual([1]);
});
it("never flags a cooldown the structure's own guards earned striking out", () => {
  const combat = history([battle(95, 77, ME, THEM, 1)]);
  expect(attacked([guard(1, 150)], combat)).toEqual([]);
});
it("never flags a cooldown whose hit is not read: history still loading, or only an older hit known", () => {
  expect(attacked([guard(1, 150)], null)).toEqual([]);
  expect(attacked([guard(1, 150)], history([]))).toEqual([]);
  // An old hostile hit cannot have set a cooldown ending at 150: the hit behind it is missing.
  expect(attacked([guard(1, 150)], history([battle(10, 1, THEM, ME)]))).toEqual([]);
  // Nor can an old own capture stand for a newer cooldown.
  expect(attacked([guard(1, 150)], history([battle(10, 1, ME, "0xformer")]))).toEqual([]);
});
it("follows a run of hits: each extends the cooldown, and the latest decides", () => {
  const combat = history([battle(40, 1, THEM, ME), battle(70, 1, THEM, ME), battle(95, 1, THEM, ME)]);
  expect(attacked([guard(1, 210)], combat)).toEqual([1]);
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
