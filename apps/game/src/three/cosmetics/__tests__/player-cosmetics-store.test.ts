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
describe("playerCosmeticsStore", () => {
  beforeEach(() => playerCosmeticsStore.clear());

  it("has no selection for an unknown player", () => {
    expect(playerCosmeticsStore.getSnapshot("0x1")).toBeUndefined();
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

  it("notifies selection subscribers and stops after disposal", () => {
    const listener = vi.fn();
    const dispose = playerCosmeticsStore.subscribe(listener);
    playerCosmeticsStore.applySelection(0x123n, { globalAttachments: [] });
    expect(listener).toHaveBeenCalledWith("0x123");
    dispose();
    playerCosmeticsStore.clear();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("marks a successful pending loadout as the applied world loadout", () => {
    playerCosmeticsStore.setPendingBlitzLoadout("blitz:mainnet:alpha", "0x123", {
      tokenIds: ["0xabc"],
      selectedBySlot: {
        armor: {
          tokenId: "0xabc",
          cosmeticIds: ["army:Knight:T3:legacy"],
        },
      },
    });

    playerCosmeticsStore.markAppliedBlitzLoadout("blitz:mainnet:alpha", "0x123");

    expect(playerCosmeticsStore.getSnapshot("0x123")?.activeBlitzLoadouts?.["blitz:mainnet:alpha"]).toEqual({
      tokenIds: ["0xabc"],
      selectedBySlot: {
        armor: {
          tokenId: "0xabc",
          cosmeticIds: ["army:Knight:T3:legacy"],
        },
      },
    });
    expect(playerCosmeticsStore.getSnapshot("0x123")?.selection.armies).toEqual({
      "army:Knight:T3": {
        skin: "army:Knight:T3:legacy",
      },
    });
  });
});
