// @vitest-environment node

import {
  BuildingType,
  createClientComponents,
  defineContractComponents,
  type SystemCalls,
} from "@bibliothecadao/types";
import { createWorld } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { describe, expect, it } from "vitest";
import { TileManager } from "./tile-manager";

describe("TileManager optimistic building reads", () => {
  it("includes an override-only building before an authoritative component exists", () => {
    const world = createWorld();
    const components = createClientComponents({
      contractComponents: defineContractComponents(world, "s1_eternum"),
    });
    const tileManager = new TileManager(components, {} as SystemCalls, { col: 100, row: 200 });
    const entity = getEntityIdFromKeys([100n, 200n, 10n, 9n]);

    components.Building.addOverride("optimistic-building", {
      entity,
      value: {
        game_id: 0,
        alt: false,
        outer_col: 100,
        outer_row: 200,
        inner_col: 10,
        inner_row: 9,
        category: BuildingType.WorkersHut,
        bonus_percent: 0,
        entity_id: 77,
        outer_entity_id: 77,
        paused: false,
      },
    });

    expect(tileManager.existingBuildings()).toEqual([
      expect.objectContaining({
        col: 10,
        row: 9,
        category: BuildingType.WorkersHut,
        paused: false,
      }),
    ]);
  });
});
