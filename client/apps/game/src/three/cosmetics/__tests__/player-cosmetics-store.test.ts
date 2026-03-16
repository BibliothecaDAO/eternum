import { beforeEach, describe, expect, it, vi } from "vitest";

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
    });
  });
});
