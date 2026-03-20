import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

vi.mock("@starknet-react/core", () => ({
  useAccount: () => ({
    address: "0x123",
  }),
}));

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

import { playerCosmeticsStore } from "@/three/cosmetics/player-cosmetics-store";
import { useCosmeticLoadoutStore } from "./use-cosmetic-loadout-store";

describe("useCosmeticLoadoutStore hook", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    // React 18 checks this flag before suppressing act() environment warnings.
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    playerCosmeticsStore.clear();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("does not trigger an infinite render loop for object selectors", async () => {
    playerCosmeticsStore.setPendingBlitzLoadout("cosmetics:slot", "0x123", {
      tokenIds: ["0xabc"],
      selectedBySlot: {
        armor: {
          tokenId: "0xabc",
          cosmeticIds: ["army:Knight:T3:legacy"],
        },
      },
    });

    const Harness = () => {
      const state = useCosmeticLoadoutStore(
        (value) => ({
          pendingCount: value.pendingCount,
          isEmpty: value.isEmpty,
          isValid: value.isValid,
          clearAll: value.clearAll,
        }),
        { scopeKey: "cosmetics:slot" },
      );

      return <div>{`${state.pendingCount}:${state.isEmpty}:${state.isValid}`}</div>;
    };

    await act(async () => {
      root.render(<Harness />);
    });

    expect(container.textContent).toBe("1:false:true");
  });
});
