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
  structureMapPosition: (_store: unknown, structure: { base: { coord_x: number; coord_y: number } }) => ({
    x: structure.base.coord_x,
    y: structure.base.coord_y,
  }),
}));

const { followInitialStructure } = await import("./initial-structure");
const { useAccountStore } = await import("@/hooks/store/use-account-store");
const setAccount = (account: { address: string } | null) => useAccountStore.setState({ account: account as never });

const PLAYER = "0x7d79";
const structure = (entity_id: number, owner: string) => ({
  entity_id,
  owner: BigInt(owner),
  base: { coord_x: entity_id, coord_y: 8850, category: 1 },
});

const factStore = () => {
  let rows: ReturnType<typeof structure>[] = [];
  const listeners = new Set<() => void>();
  return {
    inGame: () => rows.values(),
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
});
