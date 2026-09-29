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

const storeWith = (sites: Record<number, "Rift" | "Camp" | "FallenRealm">) => ({
  get: (model: string, key: { entity_id: number }) =>
    model === "ExpeditionSite" && sites[key.entity_id] ? { kind: sites[key.entity_id] } : undefined,
});

describe("the mine kind a structure is drawn as", () => {
  it("draws a Frontier Rift, written as a Mine with no mine kind, as the Essence Rift", () => {
    const store = storeWith({ 7: "Rift" });
    expect(presentedMineKind(store as never, mine(7, 0))).toBe(1);
    expect(getStructureName(store as never, mine(7, 0), false).name).toBe("Essence Rift 7");
  });

  it("draws a mine with no site row by its own kind, and gives other structures none", () => {
    const store = storeWith({});
    expect(presentedMineKind(store as never, mine(8, 2))).toBe(2);
    const realm = { ...(mine(9, 0) as object), base: { category: StructureType.Realm, level: 0 } };
    expect(presentedMineKind(store as never, realm as never)).toBeUndefined();
  });

  it("is loud about a site that is not a mine", () => {
    expect(() => presentedMineKind(storeWith({ 10: "Camp" }) as never, mine(10, 0))).toThrow(
      "Mine 10 is a Camp site, which is not drawn as a mine",
    );
  });
});
