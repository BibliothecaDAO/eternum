// @vitest-environment jsdom
import { configManager } from "@bibliothecadao/eternum";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { attachMapSelectionPositions } from "@/hooks/store/map-selection";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { disposeGameSyncSession, installActiveGameClient, startRealmVisit } from "@/sync/active-game-client";

/** The player's realm 1 and the realm 2 they visit, each on its Frontier site (contract hexes). */
const HOME = { id: 1, owner: 0x111n, site: { x: 97_316_650, y: 850 } };
const VISITED = { id: 2, owner: 0x222n, site: { x: 150_827_150, y: 850 } };
const REALMS = [HOME, VISITED];

const game = vi.hoisted(() => ({
  store: null as unknown as import("@bibliothecadao/eternum/game-client").NativeFactStore,
}));
vi.mock("@/hooks/context/game-context", () => ({ useGame: () => ({ setup: { store: game.store } }) }));
vi.mock("@/hooks/helpers/use-native-facts", () => ({ useNativeFacts: () => ({ store: game.store, revision: 0 }) }));
vi.mock("@/config/game-modes/use-game-mode-config", () => ({
  useGameModeConfig: () => ({
    id: "frontier",
    structure: {
      getEntityInfo: (id: number) => ({ position: [HOME, VISITED].find((realm) => realm.id === id)!.site }),
    },
  }),
}));
// The header's other parts, which the view switch does not read.
vi.mock("@/hooks/helpers/use-compact-hud", () => ({ useCompactLane: () => null }));
vi.mock("@/audio/hooks/useUISound", () => ({ useUISound: () => () => {} }));
vi.mock("@/ui/features/world", () => ({ SecondaryMenuItems: () => null }));
vi.mock("@/ui/features/world/containers/top-header/identity-chip", () => ({ IdentityChip: () => null }));
vi.mock("@/ui/features/world/containers/top-header/game-clock", () => ({ GameClock: () => null }));
vi.mock("@/ui/features/world/containers/top-header/attention-pill", () => ({ AttentionPill: () => null }));

const { TopHeader } = await import("./top-header");

const started: (() => void)[] = [];
const visitedStream = vi.fn();

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.spyOn(configManager, "getMapCenter").mockReturnValue(0);
  vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
  useAccountStore.setState({ account: { address: "0x111" } as never });
  // The game's facts: each realm's row and its owner.
  game.store = new NativeFactStore();
  const get = game.store.get.bind(game.store);
  vi.spyOn(game.store, "get").mockImplementation(((model: string, key: { entity_id?: number }) => {
    const realm = REALMS.find((one) => one.id === Number(key.entity_id));
    return model === "Structure" && realm
      ? { entity_id: BigInt(realm.id), owner: realm.owner }
      : get(model as never, key as never);
  }) as never);
  installActiveGameClient({
    setup: { store: game.store },
    connect() {},
    disconnect() {},
    dispose() {},
    visit: visitedStream,
  } as never);
  visitedStream.mockClear();
});
afterEach(() => {
  started.splice(0).forEach((stop) => stop());
  disposeGameSyncSession();
  useAccountStore.setState({ account: null });
  vi.restoreAllMocks();
});

/**
 * The player visiting realm 2 from the Season, after playing their own realm 1: the visit's realm view, opened as the
 * visit opens it (watched), with the map placing the realms the stream still carries.
 */
const visitingRealm2 = (streamed: typeof REALMS) => {
  window.history.replaceState({}, "", `/g/0xa1/1/hex?col=${VISITED.site.x}&row=${VISITED.site.y}`);
  useUIStore.setState({ structureEntityId: HOME.id, lastControlledStructureEntityId: HOME.id, isSpectating: false });
  startRealmVisit({ player: "0x222", structureId: VISITED.id, opensOn: "realm" });
  useUIStore.getState().setStructureEntityId(VISITED.id, { spectator: true });
  useUIStore.getState().selectOnMap({ kind: "structure", entityId: VISITED.id });
  started.push(
    attachMapSelectionPositions({
      army: () => undefined,
      structure: (id) => {
        const realm = streamed.find((one) => one.id === id);
        return realm && { col: realm.site.x, row: realm.site.y, alt: false };
      },
    }),
  );
  visitedStream.mockClear();
};

const pressWorld = async () => {
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => root.render(<TopHeader clock={<span />} />));
  started.push(() => act(() => root.unmount()));
  const world = [...host.querySelectorAll("button")].find((button) => button.textContent === "World");
  await act(async () => world!.click());
};

describe("World from a visited realm's view", () => {
  it.each([
    { streamed: REALMS, case: "while the player's own realm is still streamed" },
    { streamed: [VISITED], case: "once the player's own realm is no longer streamed" },
  ])("opens the map on the visited realm, selected, and the visit goes on, $case", async ({ streamed }) => {
    visitingRealm2(streamed);

    await pressWorld();

    expect(window.location.pathname).toBe("/g/0xa1/1/map");
    expect(window.location.search).toBe(`?col=${VISITED.site.x}&row=${VISITED.site.y}`);
    expect(useUIStore.getState().mapSelection).toEqual({ kind: "structure", entityId: VISITED.id });
    expect(useUIStore.getState().selectedHex).toEqual({ col: VISITED.site.x, row: VISITED.site.y });
    expect(useUIStore.getState().isSpectating).toBe(true);
    expect(visitedStream).not.toHaveBeenCalled();
  });
});
