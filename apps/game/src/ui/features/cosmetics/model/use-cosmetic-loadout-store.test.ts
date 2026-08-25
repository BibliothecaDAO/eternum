// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

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

import type { CosmeticItem } from "../config/cosmetics.data";
import {
  buildCosmeticLoadoutViewState,
  buildDraftForEquippedCosmetic,
  describeBlitzLoadoutSummary,
} from "./use-cosmetic-loadout-store";

const cosmeticItem = (overrides: Partial<CosmeticItem> = {}): CosmeticItem => ({
  id: "legacy-knight",
  name: "Legacy Knight T3",
  description: "desc",
  modelPath: "/models/cosmetics/low-res/0x107050201.glb",
  tokenId: "0xabc",
  slot: "armor",
  attributesRaw: "0x107050201",
  ...overrides,
});

describe("buildDraftForEquippedCosmetic", () => {
  it("builds a slot-keyed draft payload that preserves token ids and cosmetic ids", () => {
    const draft = buildDraftForEquippedCosmetic({
      currentDraft: undefined,
      slot: "armor",
      item: cosmeticItem(),
      maxSelections: 2,
    });

    expect(draft.selectedBySlot).toEqual({
      armor: {
        tokenId: "0xabc",
        cosmeticIds: ["army:Knight:T3:legacy"],
        ownershipKey: "0x107050201",
        label: "Legacy Knight T3",
      },
    });
    expect(draft.tokenIds).toEqual(["0xabc"]);
  });
});

describe("buildCosmeticLoadoutViewState", () => {
  it("keeps the UI adapter in parity with the pending draft", () => {
    const draft = {
      tokenIds: ["0xabc"],
      selectedBySlot: {
        armor: {
          tokenId: "0xabc",
          cosmeticIds: ["army:Knight:T3:legacy"],
          ownershipKey: "0x107050201",
        },
      },
    };

    const state = buildCosmeticLoadoutViewState({ draft, maxSelections: 2 });

    expect(state.selectedBySlot).toEqual({ armor: "0xabc" });
    expect(state.pendingTokenIds).toEqual(["0xabc"]);
    expect(state.pendingCount).toBe(1);
    expect(state.isValid).toBe(true);
  });

  it("reports an invalid summary when the pending loadout exceeds the max", () => {
    const state = buildCosmeticLoadoutViewState({
      draft: {
        tokenIds: ["0x1", "0x2", "0x3"],
        selectedBySlot: {
          aura: {
            tokenId: "0x1",
            cosmeticIds: ["attachment:army:aura-legacy"],
          },
          armor: {
            tokenId: "0x2",
            cosmeticIds: ["army:Knight:T3:legacy"],
          },
          realm: {
            tokenId: "0x3",
            cosmeticIds: ["structure:realm:castle-s1-lvl2"],
          },
        },
      },
      maxSelections: 2,
    });

    expect(state.isValid).toBe(false);
    expect(state.errors).toEqual(["Select at most 2 cosmetics for the next Blitz registration."]);
  });
});

describe("describeBlitzLoadoutSummary", () => {
  it("returns the game-entry summary copy for a non-empty pending loadout", () => {
    expect(describeBlitzLoadoutSummary({ pendingCount: 2, isValid: true, isEmpty: false, errors: [] })).toBe(
      "2 cosmetics ready for the next Blitz registration.",
    );
  });
});
