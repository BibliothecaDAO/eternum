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

vi.mock("../debug-controller", () => ({
  cosmeticDebugController: {
    resolveOverride: () => undefined,
  },
}));

vi.mock("../asset-cache", () => ({
  ensureCosmeticAsset: () => undefined,
}));

import { buildBlitzRegisterCalls } from "@/hooks/blitz-registration";
import { buildDevPreviewWorldKey, createWorldPreviewEntryController } from "@/hooks/use-world-preview-entry";
import { useDevPreviewEntryStore } from "@/hooks/store/use-dev-preview-entry-store";
import { resolveCosmeticsLoadoutScopeKeyForChain } from "@/ui/features/cosmetics/lib/loadout-scope";
import { ModelType } from "../../types/army";
import { StructureType, TroopTier, TroopType } from "@bibliothecadao/types";
import { playerCosmeticsStore } from "../player-cosmetics-store";
import { clearRegistry, seedDefaultCosmetics } from "../registry";
import { resolveArmyCosmetic, resolveStructureCosmetic } from "../resolver";

describe("cosmetic pipeline integration", () => {
  beforeEach(() => {
    playerCosmeticsStore.clear();
    clearRegistry();
    seedDefaultCosmetics({ force: true });
    useDevPreviewEntryStore.getState().clearAllPreviewEntries();
  });

  it("flows from pending loadout to register calldata to applied army skin", () => {
    playerCosmeticsStore.setPendingBlitzLoadout("blitz:mainnet:alpha", "0x123", {
      tokenIds: ["0xabc"],
      selectedBySlot: {
        armor: {
          tokenId: "0xabc",
          cosmeticIds: ["army:Knight:T3:legacy"],
        },
      },
    });

    const calls = buildBlitzRegisterCalls({
      blitzSystemsAddress: "0x1",
      usernameFelt: "0x2",
      tokenId: 0n,
      cosmeticTokenIds: ["0xabc"],
    });

    expect(calls[0]).toMatchObject({
      entrypoint: "register",
      calldata: ["0x2", "0", "1", "0xabc"],
    });

    playerCosmeticsStore.markAppliedBlitzLoadout("blitz:mainnet:alpha", "0x123");

    const result = resolveArmyCosmetic({
      owner: "0x123",
      troopType: TroopType.Knight,
      tier: TroopTier.T3,
      defaultModelType: ModelType.Knight3,
    });

    expect(result.skin.cosmeticId).toBe("army:Knight:T3:legacy");
    expect(result.skin.isFallback).toBe(false);
  });

  it("flows from a pending draft through preview entry into applied army and structure cosmetics", async () => {
    playerCosmeticsStore.setPendingBlitzLoadout(resolveCosmeticsLoadoutScopeKeyForChain("slot"), "0x123", {
      tokenIds: ["0xaaa", "0xbbb", "0xccc"],
      selectedBySlot: {
        armor: {
          tokenId: "0xaaa",
          cosmeticIds: ["army:Knight:T3:legacy"],
        },
        realm: {
          tokenId: "0xbbb",
          cosmeticIds: ["structure:realm:castle-s1-lvl2"],
        },
        aura: {
          tokenId: "0xccc",
          cosmeticIds: ["attachment:army:aura-legacy", "attachment:structure:aura-legacy"],
        },
      },
    });

    const previewEntries = new Map<string, { previewEntered: boolean; enteredAt: number; loadoutWorldKey: string }>();
    const controller = createWorldPreviewEntryController({
      isDev: true,
      address: "0x123",
      chain: "slot",
      worldName: "alpha",
      previewEntries: {
        setPreviewEntry: (key, entry) => {
          previewEntries.set(key, entry);
        },
      },
      cosmeticsStore: playerCosmeticsStore,
    });

    await controller.enterPreview();

    const army = resolveArmyCosmetic({
      owner: "0x123",
      troopType: TroopType.Knight,
      tier: TroopTier.T3,
      defaultModelType: ModelType.Knight3,
    });
    const structure = resolveStructureCosmetic({
      owner: "0x123",
      structureType: StructureType.Realm,
      stage: 2,
      defaultModelKey: "Realm",
    });

    expect(previewEntries.get("slot:alpha:0x123")).toEqual(
      expect.objectContaining({ previewEntered: true, loadoutWorldKey: "blitz:slot:alpha" }),
    );
    expect(army.skin.cosmeticId).toBe("army:Knight:T3:legacy");
    expect(army.attachments).toEqual([expect.objectContaining({ id: "legacy-troop-aura" })]);
    expect(structure.skin.cosmeticId).toBe("structure:realm:castle-s1-lvl2");
    expect(structure.attachments).toEqual([expect.objectContaining({ id: "legacy-realm-aura" })]);
  });

  it("clears preview state and reapplies a changed draft on the next explicit preview entry", async () => {
    playerCosmeticsStore.setPendingBlitzLoadout(resolveCosmeticsLoadoutScopeKeyForChain("slot"), "0x123", {
      tokenIds: ["0xaaa"],
      selectedBySlot: {
        armor: {
          tokenId: "0xaaa",
          cosmeticIds: ["army:Knight:T3:legacy"],
        },
      },
    });

    const controller = createWorldPreviewEntryController({
      isDev: true,
      address: "0x123",
      chain: "slot",
      worldName: "alpha",
      previewEntries: useDevPreviewEntryStore.getState(),
      cosmeticsStore: playerCosmeticsStore,
    });

    await controller.enterPreview();

    expect(
      resolveArmyCosmetic({
        owner: "0x123",
        troopType: TroopType.Knight,
        tier: TroopTier.T3,
        defaultModelType: ModelType.Knight3,
      }).skin.cosmeticId,
    ).toBe("army:Knight:T3:legacy");

    const previewWorldKey = buildDevPreviewWorldKey({
      chain: "slot",
      worldName: "alpha",
      address: "0x123",
    });
    useDevPreviewEntryStore.getState().clearPreviewEntry(previewWorldKey);

    playerCosmeticsStore.setPendingBlitzLoadout(resolveCosmeticsLoadoutScopeKeyForChain("slot"), "0x123", {
      tokenIds: [],
      selectedBySlot: {},
    });

    await controller.enterPreview();

    const reenteredArmy = resolveArmyCosmetic({
      owner: "0x123",
      troopType: TroopType.Knight,
      tier: TroopTier.T3,
      defaultModelType: ModelType.Knight3,
    });

    expect(useDevPreviewEntryStore.getState().hasPreviewEntry(previewWorldKey)).toBe(true);
    expect(reenteredArmy.skin.cosmeticId).toBe("army:Knight:T3:base");
    expect(reenteredArmy.skin.isFallback).toBe(true);
  });

  it("hydrates ownership-driven structure cosmetics and attachments", () => {
    playerCosmeticsStore.setSnapshot({
      owner: "0x999",
      version: 1,
      ownership: {
        owner: "0x999",
        version: 1,
        ownedAttrs: ["0x3040101", "0x2040401"],
        eligibleCosmeticIds: ["structure:realm:castle-s1-lvl2", "attachment:structure:aura-legacy"],
      },
      selection: {
        structures: {
          "structure:Realm:2": {
            skin: "structure:realm:castle-s1-lvl2",
          },
        },
        globalAttachments: ["attachment:structure:aura-legacy"],
      },
    });

    const result = resolveStructureCosmetic({
      owner: "0x999",
      structureType: StructureType.Realm,
      stage: 2,
      defaultModelKey: "Realm",
    });

    expect(result.skin.cosmeticId).toBe("structure:realm:castle-s1-lvl2");
    expect(result.skin.isFallback).toBe(false);
    expect(result.attachments).toEqual([expect.objectContaining({ id: "legacy-realm-aura" })]);
  });

  it("keeps fallback semantics for owners without a custom loadout", () => {
    const army = resolveArmyCosmetic({
      owner: "0x0",
      troopType: TroopType.Knight,
      tier: TroopTier.T1,
      defaultModelType: ModelType.Knight1,
    });
    const structure = resolveStructureCosmetic({
      owner: "0x0",
      structureType: StructureType.Realm,
      defaultModelKey: "Realm",
    });

    expect(army.skin.isFallback).toBe(true);
    expect(structure.skin.isFallback).toBe(true);
  });
});
