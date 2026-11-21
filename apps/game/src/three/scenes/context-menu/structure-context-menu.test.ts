// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { useUIStore } from "@/hooks/store/use-ui-store";
import { realmBoard } from "@/ui/features/frontier/build/build-fixture";
import type { HexEntityInfo } from "@bibliothecadao/types";
import { openStructureContextMenu } from "./structure-context-menu";
import { GAME_FAMILIES } from "../../../../../../config/source/common/native-preset-modes";
import type { GameType } from "../../../../../../config/source/common/types";

type Store = ReturnType<typeof realmBoard>["store"];

const closeGuardSlots = (store: Store) => {
  const rules = store.require("SliceRules", { game_id: 1 });
  const troop_limit_config = {
    ...rules.troop_limit_config,
    settlement_guard_slots: 0,
    city_guard_slots: 0,
    kingdom_guard_slots: 0,
    empire_guard_slots: 0,
  };
  store.applyFacts([{ model: "SliceRules", key: "0x100", value: { ...rules, troop_limit_config } }] as never);
};

const openRealmMenu = (mode: GameType) => {
  const { store } = realmBoard();
  const game = store.require("GameRegistry", { game_id: 1 });
  store.applyFacts([{ model: "GameRegistry", key: "0x3", value: { ...game, family: GAME_FAMILIES[mode] } }] as never);
  if (mode === "frontier") closeGuardSlots(store);
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
  it("does not open in Frontier, whose realm has the one order, given from its dock and the tiles beside it", () => {
    expect(openRealmMenu("frontier")).toEqual([]);
    expect(useUIStore.getState().contextMenu).toBeNull();
  });

  it("keeps Construction in the modes that build from menus", () => {
    expect(openRealmMenu("blitz")).toContain("Construction");
  });
});
