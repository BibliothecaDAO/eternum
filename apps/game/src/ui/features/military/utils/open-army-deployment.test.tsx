// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { LeftView } from "@/types";
import { realmBoard } from "@/ui/features/frontier/build/build-fixture";
import { Direction } from "@bibliothecadao/types";
import { ARMY_DEPLOYMENT_SURFACE_ID, openArmyDeployment } from "./open-army-deployment";

const FRONTIER_PRESET_ID = 5;
const BLITZ_PRESET_ID = 2;
const TILE = { anchor: { left: 10, right: 10, top: 10, bottom: 10 } };

/** A game of the given preset: the game's registry row names it, and it picks the mode. */
const playGame = (presetId: number) => {
  const { store } = realmBoard();
  const game = store.require("GameRegistry", { game_id: 1 });
  store.applyFacts([{ model: "GameRegistry", key: "0x3", value: { ...game, preset_id: presetId } }] as never);
};

const opened = () => ({
  picker: usePopoverStore.getState().openId === ARMY_DEPLOYMENT_SURFACE_ID,
  view: useUIStore.getState().leftNavigationView,
  toward: useUIStore.getState().pendingMilitaryAction?.direction,
});

afterEach(() => {
  usePopoverStore.getState().close();
  useUIStore.getState().setPendingMilitaryAction(null);
  useUIStore.getState().setLeftNavigationView(LeftView.None);
});

describe("an order to deploy an army", () => {
  it("opens Frontier's own sheet aimed at the ordered tile, never the shared picker", () => {
    playGame(FRONTIER_PRESET_ID);
    openArmyDeployment({ structureId: 7, isExplorer: true, direction: Direction.WEST }, TILE);
    expect(opened()).toEqual({ picker: false, view: LeftView.MilitaryView, toward: Direction.WEST });
  });

  it("hangs the shared picker where the order was given in the modes that share the HUD", () => {
    playGame(BLITZ_PRESET_ID);
    openArmyDeployment({ structureId: 7, isExplorer: true, direction: Direction.WEST }, TILE);
    expect(opened()).toEqual({ picker: true, view: LeftView.None, toward: undefined });
  });

  it("opens the HUD's deploy workspace for an order with no place on screen", () => {
    playGame(BLITZ_PRESET_ID);
    openArmyDeployment({ structureId: 7, isExplorer: false });
    expect(opened()).toEqual({ picker: false, view: LeftView.MilitaryView, toward: undefined });
  });
});
