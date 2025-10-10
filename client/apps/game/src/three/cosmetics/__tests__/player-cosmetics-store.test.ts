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
    expect(result?.selection.tokens).toEqual(["0x1", "0x2", "0x3"]);

    const snapshot = playerCosmeticsStore.getSnapshot("0x123");
    expect(snapshot?.selection.tokens).toEqual(["0x1", "0x2", "0x3"]);
  });
});
