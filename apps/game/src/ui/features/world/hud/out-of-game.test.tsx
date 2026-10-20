import { act } from "react";
import { createRoot } from "react-dom/client";
import { configManager } from "@bibliothecadao/eternum";
import { type GameClientSetup, NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { ContractAddress, StructureType } from "@bibliothecadao/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The desktop column's own panels draw stand-ins: this test is about the line over them, and which of them it is over.
vi.mock("./holdings", () => ({ useHoldings: () => ({}), HoldingsList: () => <p>Holdings list</p> }));
vi.mock("./realm-card", () => ({ RealmCard: () => null }));
vi.mock("./minimap", () => ({ HudMinimap: () => null }));
vi.mock("@/ui/features/world/containers/spectator-standings", () => ({ SpectatorStandingsBody: () => <p>Ranking</p> }));
// Whether the HUD plays or watches: the spectating flag here, the game never over.
vi.mock("@/utils/can-issue-orders", () => ({
  canIssueOrders: (state: { isSpectating: boolean }) => !state.isSpectating,
}));
vi.mock("@/ui/features/world/containers/top-header/game-clock", () => ({ useGameFinished: () => false }));

import { GameProvider } from "@/hooks/context/game-context";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { readFactView } from "@/sync/fact-views";
import { LeftColumn } from "./desktop-hud";
import { OUT_OF_GAME, outOfGameView } from "./out-of-game";

const PLAYER = ContractAddress("0x111");
const RIVAL = "0x222";

const structure = (entityId: number, category: StructureType, owner: string) => ({
  model: "Structure",
  key: `0x${entityId.toString(16)}`,
  value: {
    game_id: 1,
    entity_id: entityId,
    owner,
    base: {
      category,
      level: 0,
      created_at: "0x1",
      troop_max_guard_count: 0,
      troop_max_explorer_count: 3,
      starting_troops_granted: false,
    },
    resources_packed: "0x0",
    metadata: { realm_id: 0, village_realm: 0, mine_kind: 0, deepest_depth: 0, has_wonder: false, order: 0 },
  },
});

const entry = { model: "PlayerEntry", key: "0xe1", value: { game_id: 1, owner: "0x111", player: "0x111" } };
const REALM = 7;
const TOWER = 50;

/** A Blitz the player entered, its facts all in: a realm and a Hyperstructure of theirs. */
const enteredGame = () => {
  const store = new NativeFactStore();
  store.setSnapshot({ gameId: 1, complete: true, actor: "0x111", timestamp: 350 });
  store.applyFacts([
    entry,
    structure(REALM, StructureType.Realm, "0x111"),
    structure(TOWER, StructureType.Hyperstructure, "0x111"),
  ] as never);
  return store;
};

const takeRealm = (store: NativeFactStore) => store.applyFacts([structure(REALM, StructureType.Realm, RIVAL)] as never);

describe("out of the game", () => {
  beforeEach(() => configManager.setActiveGame(1, 1));

  it("is a player who entered and lost the last realm, though a Hyperstructure of theirs remains", () => {
    const store = enteredGame();
    expect(readFactView(store, outOfGameView, PLAYER)).toBe(false);
    takeRealm(store);
    expect([...store.structuresOwnedBy(1, PLAYER)].map((row) => row.entity_id)).toEqual([BigInt(TOWER)]);
    expect(readFactView(store, outOfGameView, PLAYER)).toBe(true);
  });

  it("is never a spectator, nor an account that never entered the game", () => {
    const store = enteredGame();
    takeRealm(store);
    expect(readFactView(store, outOfGameView, null)).toBe(false);
    store.applyFacts([{ ...entry, value: null }] as never);
    expect(readFactView(store, outOfGameView, PLAYER)).toBe(false);
  });

  it("is not said before the player's own facts are known", () => {
    const store = enteredGame();
    takeRealm(store);
    store.setSnapshot({ gameId: 1, complete: false, actor: "0x111", timestamp: 350 });
    expect(readFactView(store, outOfGameView, PLAYER)).toBe(false);
    store.setSnapshot({ gameId: 1, complete: true, actor: "0x111", timestamp: 350 });
    expect(readFactView(store, outOfGameView, PLAYER)).toBe(true);
  });
});

describe("the desktop column", () => {
  const signer = { address: "0x111" };
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    configManager.setActiveGame(1, 1);
    host = document.createElement("div");
    root = createRoot(host);
    useAccountStore.getState().setGameplayAccount(signer as never, signer.address);
    useUIStore.setState({ isSpectating: false });
  });
  afterEach(() => {
    act(() => root.unmount());
    useAccountStore.getState().setGameplayAccount(null, null);
    useUIStore.setState({ isSpectating: false });
  });

  const render = (store: NativeFactStore) => {
    return act(() =>
      root.render(
        <GameProvider value={{ store } as unknown as GameClientSetup} account={signer as never}>
          <LeftColumn />
        </GameProvider>,
      ),
    );
  };

  it("tells the player the last realm fell, over the holdings left and then over the standings they watch", () => {
    const store = enteredGame();
    render(store);
    expect(host.textContent).toBe("Holdings list");

    act(() => takeRealm(store));
    expect(host.textContent).toBe(`${OUT_OF_GAME}Holdings list`);

    act(() => useUIStore.setState({ isSpectating: true }));
    expect(host.textContent).toBe(`${OUT_OF_GAME}StandingsRanking`);
  });

  it("says nothing of it to a spectator who never entered", () => {
    const store = enteredGame();
    store.applyFacts([{ ...entry, value: null }] as never);
    takeRealm(store);
    useUIStore.setState({ isSpectating: true });
    render(store);
    expect(host.textContent).toBe("StandingsRanking");
  });
});
