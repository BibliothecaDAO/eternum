// @vitest-environment jsdom
import { BUILDINGS_CENTER, BuildingType, StructureType } from "@bibliothecadao/types";
import { afterEach, expect, it } from "vitest";

import { useUIStore } from "@/hooks/store/use-ui-store";

import { firstBuildPlot } from "./hexception-first-build-plot";

const { default: HexceptionScene } = await import("./hexception");

const [COL, ROW] = BUILDINGS_CENTER;
// Along the castle's row: one plot away, two away, and three away.
const NEAR = { col: COL + 1, row: ROW };
const MIDDLE = { col: COL - 2, row: ROW };
const FAR = { col: COL + 3, row: ROW };

afterEach(() => useUIStore.setState({ firstBuild: null }));

it("marks the open plot nearest the castle, whatever order the plots come in, and none when none is open", () => {
  expect(firstBuildPlot([FAR, NEAR, MIDDLE])).toEqual(NEAR);
  expect(firstBuildPlot([MIDDLE, FAR])).toEqual(MIDDLE);
  expect(firstBuildPlot([])).toBeNull();
});

it("breaks a tie between equally near plots the same way every time: the lower row, then the lower column", () => {
  const left = { col: COL - 1, row: ROW };
  const right = { col: COL + 1, row: ROW };
  expect(firstBuildPlot([right, left])).toEqual(left);
  expect(firstBuildPlot([left, right])).toEqual(left);
});

/** The realm's board with three open plots, its highlights recorded as the plots they light. */
const board = () => {
  const lit: { col: number; row: number }[][] = [];
  const scene = Object.assign(Object.create(HexceptionScene.prototype), {
    highlights: [FAR, NEAR, MIDDLE],
    buildingPreview: null,
    newRingRadius: null,
    isEntered: false,
    proceduralTerrain: { present: () => {} },
    interactiveHexManager: { renderAllHexes: () => {} },
    reconcileAllBuildingInstances: () => {},
    highlightHexManager: {
      highlightHexes: (descriptors: { hex: { col: number; row: number } }[]) =>
        lit.push(descriptors.map(({ hex }) => hex)),
    },
  });
  return { scene, litNow: () => lit.at(-1) };
};

it("lights the plot for the realm's first build once the realm is shown, and nothing once there is none", () => {
  const view = board();
  view.scene.presentGrid({}, StructureType.Realm);
  expect(view.litNow()).toEqual([]);

  useUIStore.setState({ firstBuild: BuildingType.ResourceKnightT1 });
  view.scene.presentGrid({}, StructureType.Realm);
  expect(view.litNow()).toEqual([NEAR]);
});

it("moves the mark to the next nearest plot when its plot is built on, and lights every open plot for a ghost", () => {
  useUIStore.setState({ firstBuild: BuildingType.ResourceKnightT1 });
  const view = board();
  view.scene.presentGrid({}, StructureType.Realm);
  view.scene.updateBuildingHighlight(NEAR, true);
  expect(view.litNow()).toEqual([MIDDLE]);

  // A building picked to place: every plot it may stand on, the mark among them.
  view.scene.buildingPreview = { getPreviewBuilding: () => ({ type: BuildingType.ResourceKnightT1 }) };
  view.scene.updateBuildingHighlight(NEAR, false);
  expect(view.litNow()).toEqual([FAR, MIDDLE, NEAR]);
});
