import { afterEach, describe, expect, it, vi } from "vitest";

const ui = {
  structureEntityId: 0,
  isSpectating: false,
  worldMapReturnPosition: null as Position | null,
  setStructureEntityId(id: number, options: { spectator: boolean; worldMapPosition?: Position }) {
    ui.structureEntityId = id;
    ui.isSpectating = options.spectator;
    if (options.worldMapPosition) ui.worldMapReturnPosition = options.worldMapPosition;
  },
};

vi.mock("@/hooks/store/use-ui-store", () => ({ useUIStore: { getState: () => ui } }));
const spectateSession = vi.fn(() => false);
vi.mock("@/utils/spectator-session", () => ({ isExplicitSpectateSession: () => spectateSession() }));
// The signed-in player as the session and the guardian name them: none until a test signs one in.
const signedIn = { player: null as string | null, listeners: new Set<() => void>() };
const signIn = (player: string | null) => {
  signedIn.player = player;
  signedIn.listeners.forEach((listener) => listener());
};
vi.mock("@/shell/herald", () => ({
  readRealmsPlayer: () => signedIn.player,
  followRealmsPlayer: (listener: () => void) => {
    signedIn.listeners.add(listener);
    return () => signedIn.listeners.delete(listener);
  },
}));
vi.mock("@bibliothecadao/eternum", async (importOriginal) => ({
  Position: (await importOriginal<typeof import("@bibliothecadao/eternum")>()).Position,
  // The real map centre: a site's contract hex and the hex the map shows differ by it.
  configManager: { getActiveGameId: () => 1, getMapCenter: () => 2147483646 },
  structureMapPosition: (_store: unknown, structure: { entity_id: number }) => ({
    x: structure.entity_id,
    y: 8850,
  }),
}));

const { followInitialStructure } = await import("./initial-structure");
// Position reads the centre from the package's own config: the same real centre as above.
const actual = await vi.importActual<typeof import("@bibliothecadao/eternum")>("@bibliothecadao/eternum");
vi.spyOn(actual.configManager, "getMapCenter").mockReturnValue(2147483646);
const { cameraHexOf } = await import("@/three/scenes/worldmap-camera-target");
type Position = import("@bibliothecadao/eternum").Position;
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
    get: (_model: string, key: { entity_id: number }) => rows.find((row) => row.entity_id === key.entity_id),
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

  it("makes a spectator fallback that is the player's own realm theirs once the account arrives", () => {
    Object.assign(ui, { structureEntityId: 0, isSpectating: false, worldMapReturnPosition: null });
    setAccount(null);
    const store = factStore();
    const stop = followInitialStructure({ store } as never);
    store.land([structure(2790, PLAYER)]);
    expect(ui).toMatchObject({ structureEntityId: 2790, isSpectating: true });

    setAccount({ address: PLAYER });

    expect(ui).toMatchObject({ structureEntityId: 2790, isSpectating: false });
    stop();
  });

  it("keeps a player on the realm they visit as its facts land and their account changes", () => {
    Object.assign(ui, { structureEntityId: 0, isSpectating: false });
    setAccount({ address: PLAYER });
    const store = factStore();
    const stop = followInitialStructure({ store } as never);
    store.land([structure(5, "0x99"), structure(2790, PLAYER)]);
    // The season board's Visit opens the neighbour's realm as a spectator's (useGoToStructure).
    ui.setStructureEntityId(5, { spectator: true });

    store.applyScope({ actor: PLAYER, visit: "0x99", expedition: {} });
    setAccount({ address: PLAYER });

    expect(ui).toMatchObject({ structureEntityId: 5, isSpectating: true });
    stop();
  });

  it("makes the player's own realm, opened before their account arrived, theirs once it does", () => {
    // As a page loaded on the realm's board opens it, before the account is restored.
    Object.assign(ui, { structureEntityId: 2790, isSpectating: true, worldMapReturnPosition: null });
    setAccount(null);
    const store = factStore();
    const stop = followInitialStructure({ store } as never);
    store.land([structure(5, "0x99"), structure(2790, PLAYER)]);
    expect(ui).toMatchObject({ structureEntityId: 2790, isSpectating: true });

    setAccount({ address: PLAYER });

    expect(ui).toMatchObject({ structureEntityId: 2790, isSpectating: false });
    stop();
  });

  it("keeps a session entered to spectate a spectator, with an account held and no player signed in", () => {
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

  describe("a signed-in player watching a game they played (Results, See the end map; live-qa-night P3-10)", () => {
    let stopFollowing = () => {};
    const enterToSpectate = () => {
      Object.assign(ui, { structureEntityId: 0, isSpectating: false });
      spectateSession.mockReturnValue(true);
      setAccount(null);
      const store = factStore();
      stopFollowing = followInitialStructure({ store } as never);
      return { store };
    };
    afterEach(() => {
      stopFollowing();
      signIn(null);
      spectateSession.mockReturnValue(false);
    });

    it("opens on their own realm, still a spectator", () => {
      signIn(PLAYER);
      const { store } = enterToSpectate();
      store.land([structure(5, "0x99"), structure(2790, PLAYER)]);

      expect(ui).toMatchObject({ structureEntityId: 2790, isSpectating: true });
    });

    it("moves the first realm it opened to their own once the session names them", () => {
      const { store } = enterToSpectate();
      store.land([structure(5, "0x99"), structure(2790, PLAYER)]);
      expect(ui).toMatchObject({ structureEntityId: 5, isSpectating: true });

      signIn(PLAYER);

      expect(ui).toMatchObject({ structureEntityId: 2790, isSpectating: true });
    });

    it("keeps a realm they chose", () => {
      const { store } = enterToSpectate();
      store.land([structure(5, "0x99"), structure(9, "0x98"), structure(2790, PLAYER)]);
      ui.setStructureEntityId(9, { spectator: true });

      signIn(PLAYER);

      expect(ui).toMatchObject({ structureEntityId: 9, isSpectating: true });
    });

    it("opens on the first realm for a player with none here", () => {
      signIn("0x5555");
      const { store } = enterToSpectate();
      store.land([structure(5, "0x99"), structure(2790, PLAYER)]);

      expect(ui).toMatchObject({ structureEntityId: 5, isSpectating: true });
    });
  });

  describe("the map's entry destination", () => {
    const settled = async () => {
      let destination: unknown = "waiting";
      void whenEntryDestinationSettled().then((value) => (destination = value));
      await Promise.resolve();
      return destination;
    };
    // The realm's site as the camera takes it: its contract hex (structureMapPosition) minus the map centre.
    const siteOf = (entityId: number) => ({ col: entityId - 2147483646, row: 8850 - 2147483646 });
    const shown = (destination: unknown) => cameraHexOf(destination as Position);

    it("is the player's realm once their own scope brings it", async () => {
      Object.assign(ui, { structureEntityId: 0, isSpectating: false });
      setAccount({ address: PLAYER });
      const store = factStore();
      const stop = followInitialStructure({ store } as never);
      // The spectator snapshot's scope applies first, with no realm in a Frontier season.
      store.applyScope({ expedition: {} }, []);
      expect(await settled()).toBe("waiting");

      store.applyScope({ actor: PLAYER, expedition: {} }, [structure(2790, PLAYER)]);

      expect(shown(await settled())).toEqual(siteOf(2790));
      stop();
    });

    it("is the realm selected before its facts arrived, which keeps its selection and takes its map position", async () => {
      // As the lab's fixture selects realm 2790 before the game's boot reads it.
      Object.assign(ui, { structureEntityId: 2790, isSpectating: false, worldMapReturnPosition: null });
      setAccount({ address: PLAYER });
      const store = factStore();
      const stop = followInitialStructure({ store } as never);
      expect(await settled()).toBe("waiting");

      store.land([structure(5, "0x99"), structure(2790, PLAYER)]);

      expect(ui.structureEntityId).toBe(2790);
      expect(shown(ui.worldMapReturnPosition)).toEqual(siteOf(2790));
      expect(shown(await settled())).toEqual(siteOf(2790));
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

      expect(shown(await settled())).toEqual(siteOf(5));
      stop();
    });
  });
});
