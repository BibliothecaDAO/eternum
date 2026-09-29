// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { useUIStore } from "@/hooks/store/use-ui-store";
import { realmBoard } from "@/ui/features/frontier/build/build-fixture";
import type { HexEntityInfo } from "@bibliothecadao/types";
import { openStructureContextMenu } from "./structure-context-menu";

const FRONTIER_PRESET_ID = 5;
const BLITZ_PRESET_ID = 2;

/** The realm's menu in a game of the given preset: the game's registry row names it, and it picks the mode. */
const openRealmMenu = (presetId: number) => {
  const { store } = realmBoard();
  const game = store.require("GameRegistry", { game_id: 1 });
  store.applyFacts([{ model: "GameRegistry", key: "0x3", value: { ...game, preset_id: presetId } }] as never);
  openStructureContextMenu({
    event: { clientX: 0, clientY: 0 } as MouseEvent,
    structure: { id: 7, owner: 0x111n } as unknown as HexEntityInfo,
    hexCoords: { col: 30, row: 30 },
    store,
  });
  return (useUIStore.getState().contextMenu?.actions ?? []).map((action) => action.label);
};

afterEach(() => useUIStore.getState().closeContextMenu());

describe("the realm's map menu", () => {
  it("has no Construction entry in Frontier, where a tapped plot's sheet is the one way to build", () => {
    expect(openRealmMenu(FRONTIER_PRESET_ID)).not.toContain("Construction");
  });

  it("keeps Construction in the modes that build from menus", () => {
    expect(openRealmMenu(BLITZ_PRESET_ID)).toContain("Construction");
  });
});
