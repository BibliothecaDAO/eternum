import { isTileOccupierUsableSite } from "@bibliothecadao/eternum";
import { TileOccupier } from "@bibliothecadao/types";
import { expect, it } from "vitest";

import { mapSiteOf } from "./map-sites";

it("draws, marks and cards exactly the occupiers the action planner lets an army use", () => {
  const occupiers = Object.values(TileOccupier).filter((value): value is number => typeof value === "number");
  for (const occupier of occupiers) expect(mapSiteOf(occupier) !== null, `occupier ${occupier}`).toBe(isTileOccupierUsableSite(occupier));
  expect(occupiers.filter(isTileOccupierUsableSite).length).toBeGreaterThan(0);
});
