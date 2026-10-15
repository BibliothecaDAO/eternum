import { describe, expect, it, vi } from "vitest";

const ui = {
  structureEntityId: 0,
  isSpectating: false,
  setStructureEntityId(id: number, options: { spectator: boolean }) {
    ui.structureEntityId = id;
    ui.isSpectating = options.spectator;
  },
};

vi.mock("@/hooks/store/use-ui-store", () => ({ useUIStore: { getState: () => ui } }));
const spectateSession = vi.fn(() => false);
vi.mock("@/utils/spectator-session", () => ({ isExplicitSpectateSession: () => spectateSession() }));
vi.mock("@bibliothecadao/eternum", async (importOriginal) => ({
  Position: (await importOriginal<typeof import("@bibliothecadao/eternum")>()).Position,
  configManager: { getActiveGameId: () => 1, getMapCenter: () => 0 },
  structureMapPosition: (_store: unknown, structure: { entity_id: number }) => ({
    x: structure.entity_id,
    y: 8850,
  }),
}));

// The route's hex needs the map's centre from a synchronized config; here it is the contract position as it stands.
vi.mock("@/play/navigation/play-route", () => ({
  mapRouteHex: (position: { getContract: () => { x: number; y: number } }) => {
    const { x, y } = position.getContract();
    return { col: x, row: y };
  },
}));

const { followInitialStructure } = await import("./initial-structure");
const { whenEntryDestinationSettled } = await import("@/game-entry/entry-destination");
const { useAccountStore } = await import("@/hooks/store/use-account-store");
const setAccount = (account: { address: string } | null) => useAccountStore.setState({ account: account as never });

const PLAYER = "0x7d79";
const structure = (entity_id: number, owner: string) => ({
  entity_id,
  owner: BigInt(owner),
  base: { category: 1 },
});

type Scope = { actor?: string; visit?: string; expedition?: object };

const factStore = () => {
  let rows: ReturnType<typeof structure>[] = [];
  let scope: Scope | undefined;
  const listeners = new Set<() => void>();
  return {
    inGame: () => rows.values(),
    subscriptionScope: () => (scope ? { known: scope } : { unknown: "INCOMPLETE_SNAPSHOT" }),
    /** Herald's scope for a selection has applied, with what it brought. */
    applyScope: (next: Scope, brought: ReturnType<typeof structure>[] = rows) => {
      rows = brought;
      scope = next;
      listeners.forEach((listener) => listener());
    },
    structuresOwnedBy: (_gameId: number, owner: bigint) => rows.filter((row) => row.owner === owner).values(),
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    land: (next: ReturnType<typeof structure>[]) => {
      rows = next;
      listeners.forEach((listener) => listener());
    },
  };
};

describe("initial structure", () => {
  it("selects the player's realm when the snapshot lands after boot", () => {
    Object.assign(ui, { structureEntityId: 0, isSpectating: false });
    setAccount({ address: PLAYER });
    const store = factStore();
    const stop = followInitialStructure({ store } as never);
    expect(ui.structureEntityId).toBe(0);

    store.land([structure(5, "0x99"), structure(2790, PLAYER)]);

    expect(ui).toMatchObject({ structureEntityId: 2790, isSpectating: false });
    stop();
  });

  it("moves from the spectator fallback to the player's realm when the account arrives", () => {
    Object.assign(ui, { structureEntityId: 0, isSpectating: false });
    setAccount(null);
    const store = factStore();
    const stop = followInitialStructure({ store } as never);
    store.land([structure(5, "0x99"), structure(2790, PLAYER)]);
    expect(ui).toMatchObject({ structureEntityId: 5, isSpectating: true });

    setAccount({ address: PLAYER });

    expect(ui).toMatchObject({ structureEntityId: 2790, isSpectating: false });
    stop();
  });

  it("keeps a session entered to spectate off the signed-in player's realm", () => {
    Object.assign(ui, { structureEntityId: 0, isSpectating: false });
    spectateSession.mockReturnValue(true);
    setAccount({ address: PLAYER });
    const store = factStore();
    const stop = followInitialStructure({ store } as never);
    store.land([structure(5, "0x99"), structure(2790, PLAYER)]);

    expect(ui).toMatchObject({ structureEntityId: 5, isSpectating: true });
    stop();
    spectateSession.mockReturnValue(false);
  });

  describe("the map's entry destination", () => {
    const settled = async () => {
      let destination: unknown = "waiting";
      void whenEntryDestinationSettled().then((value) => (destination = value));
      await Promise.resolve();
      return destination;
    };
    const siteOf = (entityId: number) => ({ col: entityId, row: 8850 });

    it("is the player's realm once their own scope brings it", async () => {
      Object.assign(ui, { structureEntityId: 0, isSpectating: false });
      setAccount({ address: PLAYER });
      const store = factStore();
      const stop = followInitialStructure({ store } as never);
      // The spectator snapshot's scope applies first, with no realm in a Frontier season.
      store.applyScope({ expedition: {} }, []);
      expect(await settled()).toBe("waiting");

      store.applyScope({ actor: PLAYER, expedition: {} }, [structure(2790, PLAYER)]);

      expect(await settled()).toEqual(siteOf(2790));
      stop();
    });

    it("is none once the player's own scope applied without a realm to open", async () => {
      Object.assign(ui, { structureEntityId: 0, isSpectating: false });
      setAccount({ address: PLAYER });
      const store = factStore();
      const stop = followInitialStructure({ store } as never);

      store.applyScope({ actor: PLAYER, expedition: {} }, []);

      expect(await settled()).toBeNull();
      stop();
    });

    it("waits, for a Frontier spectator, for the realm the leader's visit brings", async () => {
      Object.assign(ui, { structureEntityId: 0, isSpectating: false });
      setAccount(null);
      const store = factStore();
      const stop = followInitialStructure({ store } as never);
      store.applyScope({ expedition: {} }, []);
      expect(await settled()).toBe("waiting");

      store.applyScope({ visit: "0x99", expedition: {} }, [structure(5, "0x99")]);

      expect(await settled()).toEqual(siteOf(5));
      stop();
    });
  });
});
