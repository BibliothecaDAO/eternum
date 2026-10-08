import { StructureType } from "@bibliothecadao/types";
import { describe, expect, it, vi } from "vitest";

vi.mock("../managers", () => ({ configManager: {} }));
// A player's own renaming lives in their browser; none here.
vi.stubGlobal("localStorage", { getItem: () => null });

import { getStructureName } from "./entities";
import { presentedMineKind } from "./structure";

const mine = (entityId: number, mineKind: number) =>
  ({
    game_id: 1,
    entity_id: entityId,
    owner: 0n,
    base: { category: StructureType.Mine, level: 0 },
    metadata: { realm_id: 0, order: 0, mine_kind: mineKind },
  }) as never;

describe("the mine kind a structure is drawn as", () => {
  it("draws a mine by its own kind and gives other structures none", () => {
    expect(presentedMineKind(mine(8, 2))).toBe(2);
    expect(getStructureName(mine(8, 2), false).name).toBe("Fragment Mine 8");
    const realm = { ...(mine(9, 0) as object), base: { category: StructureType.Realm, level: 0 } };
    expect(presentedMineKind(realm as never)).toBeUndefined();
  });

  it("names a Frontier rift by its own category, not as a mine", () => {
    const rift = { ...(mine(7, 0) as object), base: { category: StructureType.Rift, level: 0 } };
    expect(presentedMineKind(rift as never)).toBeUndefined();
    expect(getStructureName(rift as never, false).name).toBe("Rift 7");
  });
});
