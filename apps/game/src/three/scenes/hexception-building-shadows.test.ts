// @vitest-environment jsdom
import gsap from "gsap";
import { Group, Scene } from "three";
import { expect, it } from "vitest";

import { ShadowRefreshPolicy } from "@/three/shadow-refresh-policy";

const { default: HexceptionScene } = await import("./hexception");

/**
 * The realm board as its buildings come and go, with the scene's own shadow refresh policy: the sun's shadow map is
 * drawn only when that policy says so.
 */
const realmBoard = () => {
  const shadows = new ShadowRefreshPolicy();
  const board = Object.assign(Object.create(HexceptionScene.prototype), {
    scene: new Scene(),
    shadowRefreshPolicy: shadows,
    buildingInstances: new Map<string, Group>(),
    pendingBuildingKeys: new Set<string>(),
    wonderAuras: new Map(),
    buildingMixers: new Map(),
    labels: [],
  }) as {
    scene: Scene;
    buildingInstances: Map<string, Group>;
    enterBuilding: (instance: Group, entrance: "grow" | "overshoot") => void;
    removeBuilding: (col: number, row: number) => void;
  };
  // The policy starts dirty for the board's first frame; that first drawing has been made.
  shadows.consumeRefresh(1000);
  return { board, shadowMapRedrawn: () => shadows.consumeRefresh(1000) };
};
const finishEntrances = () => gsap.globalTimeline.getChildren().forEach((tween) => tween.progress(1));

// Owner, 28 October 2026: "now lighting is good but shadows are weird ??"; buildings cast almost no shadow.
it("draws a building's shadow once it stands at full size, not while it grows", () => {
  for (const entrance of ["grow", "overshoot"] as const) {
    const { board, shadowMapRedrawn } = realmBoard();
    const building = new Group();
    building.scale.set(0.01, 0.01, 0.01);
    board.scene.add(building);

    board.enterBuilding(building, entrance);
    expect(shadowMapRedrawn()).toBe(false);

    finishEntrances();
    expect(building.scale.toArray()).toEqual([1, 1, 1]);
    expect(shadowMapRedrawn()).toBe(true);
  }
});

it("draws the shadows again when a building leaves the board, the castle included", () => {
  const { board, shadowMapRedrawn } = realmBoard();
  const castle = new Group();
  board.scene.add(castle);
  board.buildingInstances.set("10,10", castle);

  board.removeBuilding(10, 10);

  expect(board.scene.children).not.toContain(castle);
  expect(shadowMapRedrawn()).toBe(true);
});
