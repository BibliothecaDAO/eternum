import { getNeighborHexes } from "@bibliothecadao/types";
import { expect, it } from "vitest";
import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";

import { exploreScenario } from "./explore-scenario";

it("stands the spire's army on revealed land with fog beside it", () => {
  const { store } = exploreScenario();
  const army = store.entityOccupancy(1, SPIRE_ARMY)!;
  const revealed = (hex: { col: number; row: number }) =>
    Boolean(store.get("TileOpt", { game_id: 1, alt: false, col: hex.col, row: hex.row }));
  expect(revealed(army)).toBe(true);
  expect(getNeighborHexes(army.col, army.row).some((hex) => !revealed(hex))).toBe(true);
});
