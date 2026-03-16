import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@bibliothecadao/types", () => ({
  TroopType: {
    Knight: "Knight",
    Crossbowman: "Crossbowman",
    Paladin: "Paladin",
  },
  TroopTier: {
    T1: "T1",
    T2: "T2",
    T3: "T3",
  },
  StructureType: {
    1: "Realm",
    Realm: 1,
  },
}));

vi.mock("@/three/constants/scene-constants", () => ({
  getStructureModelPaths: () => ({
    1: ["structures/realm.glb"],
  }),
}));

import { playerCosmeticsStore } from "../player-cosmetics-store";
import type { ClientComponents } from "@bibliothecadao/types";

vi.mock("@dojoengine/utils", () => ({
  getEntityIdFromKeys: vi.fn(() => "entity"),
}));

const getComponentValueMock = vi.fn();

vi.mock("@dojoengine/recs", () => ({
  getComponentValue: (...args: unknown[]) => getComponentValueMock(...args),
}));

describe("playerCosmeticsStore.hydrateFromBlitzComponent", () => {
  beforeEach(() => {
    playerCosmeticsStore.clear();
    getComponentValueMock.mockReset();
  });

  it("returns undefined when component value missing", () => {
    getComponentValueMock.mockReturnValue(undefined);

    const result = playerCosmeticsStore.hydrateFromBlitzComponent({} as ClientComponents, "0x1");

    expect(result).toBeUndefined();
    expect(playerCosmeticsStore.getSnapshot("0x1")).toBeUndefined();
  });

  it("stores snapshot with token ids", () => {
    getComponentValueMock.mockReturnValue({
      attrs: [1n, 2n, 3n],
    });

    const result = playerCosmeticsStore.hydrateFromBlitzComponent({} as ClientComponents, "0x123");

    expect(result).toBeDefined();
    expect(result?.ownership.ownedAttrs).toEqual(["0x1", "0x2", "0x3"]);
    expect(result?.ownership.eligibleCosmeticIds).toEqual([]);
    expect(result?.selection).toEqual({
      armies: {},
      structures: {},
      globalAttachments: [],
    });

    const snapshot = playerCosmeticsStore.getSnapshot("0x123");
    expect(snapshot?.ownership.ownedAttrs).toEqual(["0x1", "0x2", "0x3"]);
  });

  it("tracks pending blitz loadout drafts by world", () => {
    playerCosmeticsStore.setPendingBlitzLoadout("slot:eternum-test", "0x123", {
      tokenIds: ["0xaaa", "0xbbb"],
    });

    expect(playerCosmeticsStore.getPendingBlitzLoadout("slot:eternum-test", "0x123")).toEqual({
      tokenIds: ["0xaaa", "0xbbb"],
      selectedBySlot: {},
    });
  });

  it("hydrates deterministic eligible cosmetics from owned attrs", () => {
    getComponentValueMock.mockReturnValue({
      attrs: [0x107050201n, 0x4050301n],
    });

    const result = playerCosmeticsStore.hydrateFromBlitzComponent({} as ClientComponents, "0x123");

    expect(result?.ownership.eligibleCosmeticIds).toEqual([
      "attachment:army:aura-legacy",
      "army:Knight:T3:legacy",
    ]);
  });

  it("applies army, structure, and global attachment selection without dropping prior state", () => {
    playerCosmeticsStore.applySelection("0x123", {
      armies: {
        "army:Knight:T3": {
          skin: "army:Knight:T3:legacy",
        },
      },
    });

    playerCosmeticsStore.applySelection("0x123", {
      structures: {
        "structure:Realm:2": {
          skin: "structure:realm:castle-s1-lvl2",
        },
      },
      globalAttachments: ["attachment:army:aura-legacy"],
    });

    expect(playerCosmeticsStore.getSnapshot("0x123")?.selection).toEqual({
      armies: {
        "army:Knight:T3": {
          skin: "army:Knight:T3:legacy",
        },
      },
      structures: {
        "structure:Realm:2": {
          skin: "structure:realm:castle-s1-lvl2",
        },
      },
      globalAttachments: ["attachment:army:aura-legacy"],
    });
  });

  it("preserves valid local selection when ownership hydration refreshes", () => {
    playerCosmeticsStore.applySelection("0x123", {
      armies: {
        "army:Knight:T3": {
          skin: "army:Knight:T3:legacy",
        },
      },
    });

    getComponentValueMock.mockReturnValue({
      attrs: [0x107050201n],
    });

    const result = playerCosmeticsStore.hydrateFromBlitzComponent({} as ClientComponents, "0x123");

    expect(result?.selection.armies).toEqual({
      "army:Knight:T3": {
        skin: "army:Knight:T3:legacy",
      },
    });
  });
});
