import { beforeEach, describe, expect, it, vi } from "vitest";

const { readSpectateFromWindowMock, writeSpectateToCurrentUrlMock } = vi.hoisted(() => ({
  readSpectateFromWindowMock: vi.fn(() => false),
  writeSpectateToCurrentUrlMock: vi.fn(),
}));

vi.mock("@/utils/spectate-url", () => ({
  readSpectateFromWindow: readSpectateFromWindowMock,
  writeSpectateToCurrentUrl: writeSpectateToCurrentUrlMock,
}));

import { createRealmStoreSlice, type RealmStore } from "./use-realm-store";

type RealmStoreState = RealmStore & Record<string, unknown>;

describe("createRealmStoreSlice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readSpectateFromWindowMock.mockReturnValue(false);
  });

  it("exits spectator mode when selecting an owned structure", () => {
    const state = {} as RealmStoreState;
    const set = (updater: Partial<RealmStoreState> | ((prev: RealmStoreState) => Partial<RealmStoreState>)) => {
      const next = typeof updater === "function" ? updater(state) : updater;
      Object.assign(state, next);
    };

    Object.assign(state, createRealmStoreSlice(set));
    state.playerStructures = [{ entityId: 10 }] as any;
    state.structureEntityId = 55 as any;
    state.lastControlledStructureEntityId = 55 as any;
    state.isSpectating = true;

    state.setStructureEntityId(10 as any);

    expect(state.isSpectating).toBe(false);
    expect(state.structureEntityId).toBe(10);
    expect(state.lastControlledStructureEntityId).toBe(10);
    expect(writeSpectateToCurrentUrlMock).toHaveBeenCalledWith(false);
  });
});
