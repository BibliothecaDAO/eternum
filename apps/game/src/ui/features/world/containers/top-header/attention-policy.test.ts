// @vitest-environment node
import { expect, it } from "vitest";
import type { Structure } from "@bibliothecadao/types";
import { resolveStructureAttention, nextAttentionItem } from "./attention-policy";
const structure = (entityId: number, ends: number[] = []) =>
  ({
    entityId,
    structure: {
      troop_guards: {
        alpha: { battle_cooldown_end: ends[0] ?? 0 },
        bravo: { battle_cooldown_end: ends[1] ?? 0 },
        alpha_destroyed_tick: 100,
      },
    },
  }) as Structure;
it("counts attacked structures once and deduplicates navigation with arrival targets", () => {
  const result = resolveStructureAttention(
    [structure(3, [110, 120]), structure(2, [100]), structure(1)],
    [3, 1, 1, 99],
    100,
  );
  expect(result.attackedCount).toBe(1);
  expect(result.targets.map((target) => target.entityId)).toEqual([1, 3]);
});
it("expires attacks at the same boundary as battle badges", () => {
  expect(resolveStructureAttention([structure(1, [100])], [], 100).attackedCount).toBe(0);
});
it("cycles attention before suggestions and recovers when an item disappears", () => {
  const items = [{key: "attention:1"}, {key: "attention:3"}, {key: "suggestion:1"}];
  expect(nextAttentionItem(items, null)?.key).toBe("attention:1");
  expect(nextAttentionItem(items, "attention:1")?.key).toBe("attention:3");
  expect(nextAttentionItem(items, "attention:3")?.key).toBe("suggestion:1");
  expect(nextAttentionItem(items, "suggestion:1")?.key).toBe("attention:1");
  expect(nextAttentionItem(items, "removed")?.key).toBe("attention:1");
  expect(nextAttentionItem([], null)).toBeUndefined();
});
