// @vitest-environment node
import { expect, it } from "vitest";
import type { Structure } from "@bibliothecadao/types";
import { resolveStructureAttention, nextAttentionItem } from "./attention-policy";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
const structure = (entityId: number) => ({ entityId }) as Structure;
const guard = (entityId: number, end: number) =>
  ({ structure_id: entityId, troops: { battle_cooldown_end: end } }) as NativeRows["Guard"];
it("counts attacked structures once and deduplicates navigation with arrival targets", () => {
  const result = resolveStructureAttention([structure(3), structure(2), structure(1)], [3, 1, 1, 99], 100, [
    guard(3, 110),
    guard(3, 120),
    guard(2, 100),
  ]);
  expect(result.attackedCount).toBe(1);
  expect(result.targets.map((target) => target.entityId)).toEqual([1, 3]);
});
it("expires attacks at the same boundary as battle badges", () => {
  expect(resolveStructureAttention([structure(1)], [], 100, [guard(1, 100)]).attackedCount).toBe(0);
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
