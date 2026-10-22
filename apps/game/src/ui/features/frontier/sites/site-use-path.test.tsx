import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const { world } = vi.hoisted(() => ({
  world: { projection: null as null | import("@bibliothecadao/eternum/game-sync").WorldSpatialProjection },
}));

vi.mock("@/audio/unit-command-audio", () => ({ playUnitCommandSound: () => {} }));
vi.mock("@/sync/active-game-client", async (original) => ({
  ...(await original<typeof import("@/sync/active-game-client")>()),
  requireActiveGameClient: () => ({
    waitForAction: () => Promise.resolve({ hash: "0x1", block: 9, status: "SUCCEEDED" }),
  }),
}));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({
  useCurrentDefaultTick: () => 350,
  useNowSeconds: () => 350,
  useBlockTimestamp: () => ({ currentArmiesTick: 3, armiesTickTimeRemaining: 60 }),
}));
vi.mock("@/hooks/helpers/use-query", () => ({ useQuery: () => ({ isMapView: true }) }));
// The tiles the HUD reads at a selected hex, from the same projection the planner's indexes come from.
vi.mock("@/hooks/use-world-spatial-tiles", () => ({
  useWorldSpatialTiles: (hexes: Array<{ col: number; row: number }>) =>
    hexes.flatMap((hex) => world.projection?.getTileAtHex({ ...hex, alt: false }) ?? []),
}));

import { GameProvider } from "@/hooks/context/game-context";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { orderOnTap } from "@/three/scenes/worldmap-order-request";
import { orderTip } from "@/ui/features/frontier/hud/order-tip";
import {
  ActionPaths,
  ActionType,
  buildArmyPathIndexes,
  findArmyPaths,
  setBlockTimestampSource,
} from "@bibliothecadao/eternum";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";
import { ContractAddress } from "@bibliothecadao/types";

import { MapSiteCard, useSelectedMapSite } from "./map-site-card";
import { ARMY_TILE, FAR_SHRINE_TILE, SHRINE_TILE, sitesBeside, WELL_TILE } from "./site-fixture";
import { sendSiteUse, siteUseFacts, usableSiteAt } from "./use-site";

const NOW = 350;
type Tile = typeof SHRINE_TILE;

afterEach(() => {
  useUIStore.getState().selectOnMap(null);
  useAccountStore.setState({ account: null });
  world.projection?.dispose();
  world.projection = null;
  setBlockTimestampSource(null);
});

/**
 * The player's path on the map, from the real fact store through the planner the world map runs: the player selects
 * their army, the map plans its orders from the projected world (armyPaths), and each site is then hovered, tapped and
 * right-clicked as the scene answers those gestures. The chain's answer to a use is the tile emptied.
 */
const playerOnTheMap = (stamina: bigint) => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const { store, vacate } = sitesBeside(stamina);
  const projection = new WorldSpatialProjection({ store });
  projection.start();
  world.projection = projection;
  const interact = vi.fn(async ({ coord }: { coord: { alt: boolean; x: number; y: number } }) => {
    vacate({ col: coord.x, row: coord.y });
    return { transaction_hash: "0x1" };
  });
  const setup = { store, systemCalls: { interact_site: interact } } as unknown as GameClientSetup;
  const signer = { address: "0x111" } as never;
  useAccountStore.setState({ account: signer });

  const plan = () => {
    const paths = findArmyPaths({ setup } as never, {
      explorerId: 201,
      ...buildArmyPathIndexes({ setup, projection } as never),
      currentDefaultTick: NOW,
      playerAddress: ContractAddress(0x111n),
    });
    act(() => useUIStore.getState().updateEntityActionActionPaths(paths.getPaths()));
    return paths;
  };
  // The player taps their army: the map selects it and offers its orders.
  act(() => useUIStore.getState().selectOnMap({ kind: "army", entityId: 201, tile: "own" }));
  let paths = plan();

  const pathTo = (tile: Tile) => paths.get(ActionPaths.posKey(tile));
  return {
    store,
    interact,
    pathTo,
    replan: () => (paths = plan()),
    /** The line under the pointer at the tile, as the scene names it (nameOrderAt). */
    hover: (tile: Tile) => {
      const path = pathTo(tile);
      const site = path && ActionPaths.getActionType(path) === ActionType.UseSite ? usableSiteAt(store, tile) : null;
      const army = store.get("ExplorerTroops", { game_id: 1, explorer_id: 201 });
      return orderTip({
        path,
        exploreStamina: 30,
        food: { wheat: 0, fish: 0 },
        explored: true,
        refusal: paths.getRefusals().get(ActionPaths.posKey(tile)),
        staminaWait: undefined,
        site: site ? siteUseFacts(store, site, army, NOW) : undefined,
      });
    },
    /** A right-click on the tile with the army selected: the scene runs its order there (actAtHex → onSiteUse). */
    rightClick: async (tile: Tile) => {
      const path = pathTo(tile);
      expect(path && ActionPaths.getActionType(path)).toBe(ActionType.UseSite);
      // The order's own target, as the scene reads it: the site comes from the path, not from the pointer.
      const target = path![path!.length - 1].hex;
      const site = usableSiteAt(store, { col: target.col, row: target.row, alt: false });
      await sendSiteUse({ systemCalls: setup.systemCalls, signer, explorerId: 201, site: site! });
    },
    /** A tap on the tile with the army selected: the scene's tap rule, then the HUD's card for the selection. */
    tap: (tile: Tile) => {
      const order = orderOnTap({ path: pathTo(tile), armySelected: true, site: usableSiteAt(store, tile) !== null });
      // The scene's site-card answer keeps the army as the card's actor (openTargetCardForSelectedArmy).
      if (order === "site-card")
        act(() =>
          useUIStore.getState().selectOnMap({ kind: "army", entityId: 201, tile: { col: tile.col, row: tile.row } }),
        );
      return { order, card: renderSelectedSite(setup) };
    },
  };
};

/** The selection sheet's site branch, as the Frontier HUD draws it: the selected tile's site card. */
const renderSelectedSite = (setup: GameClientSetup) => {
  const SiteSheet = () => {
    const site = useSelectedMapSite();
    return site ? <MapSiteCard selected={site} onClose={() => {}} /> : null;
  };
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() =>
    root.render(
      <GameProvider value={setup} account={{ address: "0x111", account: { address: "0x111" } } as never}>
        <SiteSheet />
      </GameProvider>,
    ),
  );
  return {
    label: host.querySelector("[data-kit-sheet]")?.getAttribute("aria-label") ?? null,
    use: () => [...host.querySelectorAll("button")].find((button) => button.textContent === "Use"),
    unmount: () => act(() => root.unmount()),
  };
};

const armyTile = (store: ReturnType<typeof sitesBeside>["store"]) => {
  const at = store.entityOccupancy(1, 201);
  return at && { col: at.col, row: at.row, alt: at.alt };
};

describe("an army beside a Shrine or a Well, from the player's map", () => {
  it.each([
    { name: "Shrine", tile: SHRINE_TILE, gives: "+200 XP" },
    { name: "Well", tile: WELL_TILE, gives: "+60 stamina" },
  ])(
    "right-click uses the $name where the army stands, after the hover says what it gives",
    async ({ tile, gives }) => {
      const player = playerOnTheMap(30n);

      expect(player.pathTo(tile)).toEqual([
        { hex: { col: ARMY_TILE.col, row: ARMY_TILE.row }, actionType: ActionType.Move },
        { hex: { col: tile.col, row: tile.row }, actionType: ActionType.UseSite, staminaCost: 0 },
      ]);
      expect(player.hover(tile)).toEqual({ line: "Use", cost: gives });

      await player.rightClick(tile);
      expect(player.interact).toHaveBeenCalledTimes(1);
      expect(player.interact).toHaveBeenCalledWith(
        expect.objectContaining({ explorer_id: 201, coord: { alt: false, x: tile.col, y: tile.row } }),
      );
      // One step, no move: the army is where it stood. The spent site leaves plain ground, which a move would enter
      // once the realm feeds it (this realm has no food, which the use never needed).
      expect(armyTile(player.store)).toEqual(ARMY_TILE);
      player.replan();
      expect(player.pathTo(tile)).toBeUndefined();
      expect(player.hover(tile)).toEqual({ line: "Not enough food for the army", cost: null });
    },
  );

  it.each([
    { name: "Shrine", tile: SHRINE_TILE, label: "Shrine" },
    { name: "Well", tile: WELL_TILE, label: "Well" },
  ])("a tap opens the $name's card with the army kept, whose Use sends the same order", async ({ tile, label }) => {
    const player = playerOnTheMap(30n);

    const { order, card } = player.tap(tile);
    expect(order).toBe("site-card");
    expect(card.label).toBe(label);
    expect(useUIStore.getState().entityActions.selectedEntityId).toBe(201);
    expect(card.use()?.disabled).toBe(false);

    await act(async () => card.use()!.click());
    expect(player.interact).toHaveBeenCalledWith(
      expect.objectContaining({ explorer_id: 201, coord: { alt: false, x: tile.col, y: tile.row } }),
    );
    expect(armyTile(player.store)).toEqual(ARMY_TILE);
    card.unmount();
  });

  it("warns on a Well at a full bar, whose stamina would be wasted, and still offers its Use", () => {
    const player = playerOnTheMap(150n);
    expect(player.hover(WELL_TILE)).toEqual({ line: "Use", cost: "Stamina full: the well would be wasted" });
    expect(player.hover(SHRINE_TILE)).toEqual({ line: "Use", cost: "+200 XP" });
  });

  it("says to move next to a site beyond the army's step, and its card offers the way there instead of Use", () => {
    const player = playerOnTheMap(30n);
    expect(player.pathTo(FAR_SHRINE_TILE)).toBeUndefined();
    expect(player.hover(FAR_SHRINE_TILE)).toEqual({ line: "Too far: move next to it", cost: null });

    const { order, card } = player.tap(FAR_SHRINE_TILE);
    expect(order).toBe("site-card");
    expect(card.label).toBe("Shrine");
    expect(useUIStore.getState().entityActions.selectedEntityId).toBe(201);
    expect(card.use()).toBeUndefined();
    card.unmount();
    expect(player.interact).not.toHaveBeenCalled();
  });
});
