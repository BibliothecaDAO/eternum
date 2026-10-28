// @vitest-environment jsdom
import { Direction } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";

import { DEPLOY_ON_MAP_EVENT, deployShownOnMap, readDeployOnMap, showDeployOnMap } from "./worldmap-deploy-request";

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
