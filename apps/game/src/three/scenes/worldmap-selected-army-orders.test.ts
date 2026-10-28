// @vitest-environment jsdom
import gsap from "gsap";
import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { HighlightHexManager } from "../managers/highlight-hex-manager";
import { FLAT_TERRAIN_SURFACE } from "../terrain/terrain-surface";
import { SelectedArmyOrders } from "./worldmap-selected-army-orders";

const ARMY = 7;
const PLAYER = 0x1n as never;
const MOVE_COST = 10;
const EXPLORE_COST = 30;

// A hex sits at (col, 0, row), so a drawn instance reads back as the hex it marks.
const gridSpace = {
  positionForHex: (hex: { col: number; row: number }) => new THREE.Vector3(hex.col, 0, hex.row),
  positionForHexInto: (col: number, row: number, out: THREE.Vector3) => out.set(col, 0, row),
  hexForPosition: (point: { x: number; z: number }) => ({ col: point.x, row: point.z }),
};

/** An idle army at (0, 0) regaining a stamina point every two minutes: moves run east, explores open north and south. */
const createRefillingArmy = (startStamina: number) => {
  let seconds = 0;
  const stamina = () => startStamina + Math.floor(seconds / 120);
  const reach = () => ({
    stamina: stamina(),
    travelSteps: Math.floor(stamina() / MOVE_COST),
    canExplore: stamina() >= EXPLORE_COST,
  });
  const orders = () => {
    const { travelSteps, canExplore } = reach();
    const moves = Array.from({ length: travelSteps }, (_, step) => order(step + 1, 0, "move", "route"));
    const explores = canExplore ? [order(0, 1, "explore", "frontier"), order(0, -1, "explore", "frontier")] : [];
    return [...moves, ...explores];
  };
  return { reach, orders, waitSeconds: (elapsed: number) => (seconds += elapsed) };
};

const order = (col: number, row: number, actionType: string, kind: "route" | "frontier") => ({
  hex: { col, row },
  actionType,
  kind,
  isEndpoint: kind === "frontier",
  isSharedRoute: false,
  pathDepth: 1,
});

const drawnHexes = (scene: THREE.Scene) => {
  const routeLayer = scene.children.find(
    (child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh && child.renderOrder === 5,
  )!;
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  return Array.from({ length: routeLayer.count }, (_, index) => {
    routeLayer.getMatrixAt(index, matrix);
    matrix.decompose(position, new THREE.Quaternion(), scale);
    return `${position.x},${position.z}@${scale.x.toFixed(2)}`;
  }).sort();
};

let animationClock = gsap.ticker.time;
const finishRollIn = () => gsap.updateRoot((animationClock += 10));

describe("SelectedArmyOrders on a selected army", () => {
  it("adds the hexes a stamina refill pays for, in place, at the head that crosses the cost", () => {
    const scene = new THREE.Scene();
    const highlights = new HighlightHexManager(scene, FLAT_TERRAIN_SURFACE, gridSpace);
    const army = createRefillingArmy(22);
    const orders = new SelectedArmyOrders({
      reach: army.reach,
      offerOrders: () => highlights.highlightHexes(army.orders() as never),
    });
    const confirmedHead = () => {
      army.waitSeconds(1);
      orders.followConfirmedHead(ARMY, PLAYER);
    };

    orders.offer(ARMY, PLAYER);
    finishRollIn();
    expect(drawnHexes(scene)).toEqual(["1,0@0.92", "2,0@0.92"]);

    for (let head = 0; head < 959; head++) confirmedHead();
    expect(drawnHexes(scene)).toEqual(["1,0@0.92", "2,0@0.92"]);

    confirmedHead();
    expect(drawnHexes(scene)).toEqual(["0,-1@0.01", "0,1@0.01", "1,0@0.92", "2,0@0.92", "3,0@0.01"]);

    finishRollIn();
    expect(drawnHexes(scene)).toEqual(["0,-1@0.98", "0,1@0.98", "1,0@0.92", "2,0@0.92", "3,0@0.92"]);
  });
});
