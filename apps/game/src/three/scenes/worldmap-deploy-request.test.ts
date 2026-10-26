// @vitest-environment jsdom
import type { ActionHighlightDescriptor } from "@bibliothecadao/eternum";
import { Direction } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";

import { DEPLOY_ON_MAP_EVENT, markDeployTile, readDeployOnMap, showDeployOnMap } from "./worldmap-deploy-request";

const lit = (col: number, row: number, kind: ActionHighlightDescriptor["kind"] = "create-army") =>
  ({
    hex: { col, row },
    actionType: "create_army",
    kind,
    isEndpoint: true,
    isSharedRoute: false,
    pathDepth: 1,
  }) as ActionHighlightDescriptor;

describe("a deploy order on the map", () => {
  it("keeps the order's tile bright and shows the realm's other open tiles as outlines", () => {
    const marked = markDeployTile([lit(1, 0), lit(0, 1), lit(-1, 0)], { col: 0, row: 1 });
    expect(marked.map((descriptor) => descriptor.isEndpoint)).toEqual([false, true, false]);
  });

  it("leaves every lit tile as it is with no tile named, and never touches another order's tiles", () => {
    expect(markDeployTile([lit(1, 0), lit(0, 1)], null).map((descriptor) => descriptor.isEndpoint)).toEqual([
      true,
      true,
    ]);
    expect(markDeployTile([lit(4, 4, "frontier")], { col: 0, row: 1 })[0].isEndpoint).toBe(true);
  });

  it("carries the sheet's order to the map, and its closing as null", () => {
    const heard: unknown[] = [];
    const hear = (event: Event) => heard.push(readDeployOnMap(event));
    window.addEventListener(DEPLOY_ON_MAP_EVENT, hear);
    showDeployOnMap({ structureId: 7, direction: Direction.WEST });
    showDeployOnMap(null);
    window.removeEventListener(DEPLOY_ON_MAP_EVENT, hear);
    expect(heard).toEqual([{ structureId: 7, direction: Direction.WEST }, null]);
  });
});
