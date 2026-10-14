// @vitest-environment node
import { expect, it } from "vitest";
import type { Structure } from "@bibliothecadao/types";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { resolveStructureAttention } from "./attention-policy";

const structure = (entityId: number) => ({ entityId }) as Structure;
const guard = (entityId: number, end: number) =>
  ({ structure_id: BigInt(entityId), troops: { battle_cooldown_end: end } }) as NativeRows["Guard"];
const read = (items: ReturnType<typeof resolveStructureAttention>) =>
  items.map((item) => [item.structure.entityId, item.reason]);

it("lists each structure once, attacks before arrivals, and only the player's own", () => {
  const items = resolveStructureAttention([structure(3), structure(2), structure(1)], [3, 1, 1, 99], 100, [
    guard(3, 110),
    guard(3, 120),
    guard(2, 100),
  ]);
  expect(read(items)).toEqual([
    [3, "attacked"],
    [1, "arrived"],
  ]);
});

it("ends an attack at the same boundary as the battle badge", () => {
  expect(resolveStructureAttention([structure(1)], [], 100, [guard(1, 100)])).toEqual([]);
});
