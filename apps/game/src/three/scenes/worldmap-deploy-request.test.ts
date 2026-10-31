// @vitest-environment jsdom
import { configManager } from "@bibliothecadao/eternum";
import { Direction, getNeighborHexes } from "@bibliothecadao/types";
import { describe, expect, it, vi } from "vitest";

import {
  DEPLOY_ON_MAP_EVENT,
  deployOrderPaths,
  deployShownOnMap,
  readDeployOnMap,
  showDeployOnMap,
} from "./worldmap-deploy-request";

describe("a deploy order on the map", () => {
  it("carries the sheet's order to the map, and its closing as null", () => {
    const heard: unknown[] = [];
    const hear = (event: Event) => heard.push(readDeployOnMap(event));
    window.addEventListener(DEPLOY_ON_MAP_EVENT, hear);
    showDeployOnMap({ structureId: 7, direction: Direction.WEST });
    showDeployOnMap(null);
    window.removeEventListener(DEPLOY_ON_MAP_EVENT, hear);
    expect(heard).toEqual([{ structureId: 7, direction: Direction.WEST }, null]);
  });

  it("keeps the open sheet's order for a map shown after it, until the sheet closes", () => {
    showDeployOnMap({ structureId: 7, direction: Direction.EAST });
    expect(deployShownOnMap()).toEqual({ structureId: 7, direction: Direction.EAST });
    showDeployOnMap(null);
    expect(deployShownOnMap()).toBeNull();
  });
});

describe("the tiles a shown deploy lights", () => {
  const center = 2147483646;
  vi.spyOn(configManager, "getMapCenter").mockReturnValue(center);
  const home = { col: center + 10, row: center + 20 };
  // The ring as the sheet reads it: four tiles open, one taken (an army stands there), one unexplored.
  const ring = getNeighborHexes(home.col, home.row).map(({ col, row, direction }, index) => ({
    col,
    row,
    direction,
    open: index < 4,
  }));

  it("lights a deploy order on each tile the sheet can send to, and nothing on the others", () => {
    const lit = deployOrderPaths(home, ring).getHighlightDescriptors();
    expect(lit.map(({ hex, kind }) => [hex.col + center, hex.row + center, kind])).toEqual(
      ring.slice(0, 4).map(({ col, row }) => [col, row, "create-army"]),
    );
  });

  it("lights nothing where the sheet has no open tile", () => {
    expect(
      deployOrderPaths(
        home,
        ring.map((tile) => ({ ...tile, open: false })),
      ).getHighlightDescriptors(),
    ).toEqual([]);
  });
});
