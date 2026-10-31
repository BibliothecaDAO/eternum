import { Vector3, type Scene } from "three";
import { armyPathColour } from "@/three/managers/army-path-colour";
import { PathRenderer } from "@/three/managers/path-renderer";
import type { MapLabelEntity } from "@/three/debug/map-label-lab-fixture";
import type { WorldmapProceduralTerrain } from "@/three/terrain/worldmap-procedural-terrain";

/**
 * Armies' paths at Blitz density (/lab/map-labels?busy=1&paths=walk|preview), drawn by the map's own PathRenderer in
 * the armies' side colours (armyPathColour). The sixteen armies nearest the player's strongest walk at once, of every
 * side: half converge on one camp (their routes cross), the rest walk off in their own directions; the nearest enemy
 * is under the pointer. `walk`: the strongest is selected and walking. `preview`: it stands, selected, and the pointer
 * is on the camp, so its route there is previewed before the order.
 */
export type PathStudy = "walk" | "preview";
export const PATH_STUDIES: readonly PathStudy[] = ["walk", "preview"];

type Role = "selected" | "hovered" | "own" | "other";

interface StudyRoute {
  entity: MapLabelEntity;
  tiles: Vector3[];
  role: Role;
}

/** The pointy-top hex's six neighbours on the lab's grid (a hex √3 wide, rows 1.5 apart), turning clockwise. */
const STEPS = [
  new Vector3(Math.sqrt(3), 0, 0),
  new Vector3(Math.sqrt(3) / 2, 0, 1.5),
  new Vector3(-Math.sqrt(3) / 2, 0, 1.5),
  new Vector3(-Math.sqrt(3), 0, 0),
  new Vector3(-Math.sqrt(3) / 2, 0, -1.5),
  new Vector3(Math.sqrt(3) / 2, 0, -1.5),
];
const flat = (point: Vector3) => new Vector3(point.x, 0, point.z);

/** Tile by tile toward the target, each step the neighbour nearest it, until `stopWithin` of it or `most` steps. */
const walkToward = (from: Vector3, to: Vector3, most: number, stopWithin = 0.5): Vector3[] => {
  const tiles = [flat(from)];
  const goal = flat(to);
  while (tiles.length <= most && tiles[tiles.length - 1].distanceTo(goal) > stopWithin) {
    const here = tiles[tiles.length - 1];
    const next = STEPS.map((step) => here.clone().add(step)).reduce((best, candidate) =>
      candidate.distanceTo(goal) < best.distanceTo(goal) ? candidate : best,
    );
    if (next.distanceTo(goal) >= here.distanceTo(goal)) break;
    tiles.push(next);
  }
  return tiles;
};

/** A walk off in one direction, turning once halfway. */
const walkOff = (from: Vector3, heading: number, steps: number): Vector3[] => {
  const tiles = [flat(from)];
  for (let step = 0; step < steps; step += 1) {
    const turn = step < steps / 2 ? 0 : 1;
    tiles.push(tiles[tiles.length - 1].clone().add(STEPS[(heading + turn) % 6]));
  }
  return tiles;
};

/** The study's sixteen walks around the player's strongest army. */
const studyRoutes = (entities: MapLabelEntity[]): StudyRoute[] => {
  const armies = entities.filter((entity) => entity.kind === "army" && entity.army);
  const selected = armies
    .filter((army) => army.relation === "own")
    .toSorted((a, b) => b.army!.troops.count - a.army!.troops.count)[0];
  const walking = armies
    .toSorted((a, b) => a.ground.distanceTo(selected.ground) - b.ground.distanceTo(selected.ground))
    .slice(0, 16);
  const hovered = walking.find((army) => army.relation === "enemy");
  // The camp the converging half walks to: the one nearest four tiles from the selected army.
  const camp = entities
    .filter((entity) => entity.kind === "camp")
    .toSorted(
      (a, b) => Math.abs(a.ground.distanceTo(selected.ground) - 7) - Math.abs(b.ground.distanceTo(selected.ground) - 7),
    )[0];
  const roleOf = (army: MapLabelEntity): Role =>
    army === selected ? "selected" : army === hovered ? "hovered" : army.relation === "own" ? "own" : "other";
  return walking.map((army, index) => ({
    entity: army,
    role: roleOf(army),
    tiles:
      army === selected || index % 2 === 0
        ? walkToward(army.ground, camp.ground, 9, 1.8)
        : walkOff(army.ground, army.entityId % 6, 3 + (army.entityId % 4)),
  }));
};

/** Where the camera looks: the middle of every walk. */
export const studyFocus = (entities: MapLabelEntity[]): Vector3 => {
  const tiles = studyRoutes(entities).flatMap((route) => route.tiles);
  return tiles
    .reduce((sum, tile) => sum.add(tile), new Vector3())
    .divideScalar(tiles.length)
    .setY(0);
};

/** Draws the study; the returned function takes it away. */
export const drawPathStudy = (
  scene: Scene,
  terrain: WorldmapProceduralTerrain,
  entities: MapLabelEntity[],
  study: PathStudy,
): (() => void) => {
  const groundAt = (x: number, z: number) => terrain.sampleSurface(x, z).height;
  const onGround = (tiles: Vector3[]) => tiles.map((tile) => new Vector3(tile.x, groundAt(tile.x, tile.z), tile.z));
  const paths = new PathRenderer();
  paths.initialize(scene);
  for (const route of studyRoutes(entities)) {
    if (route.tiles.length < 2) continue;
    const colour = armyPathColour(
      {
        isMine: route.entity.relation === "own",
        isAlly: route.entity.relation === "ally",
        owner: { address: route.entity.owner === null ? 0n : 1n },
      },
      null,
    );
    if (route.role === "selected" && study === "preview") paths.showPreview(onGround(route.tiles), colour);
    else paths.createPath(route.entity.entityId, onGround(route.tiles), colour);
    if (route.role === "selected") paths.setSelectedPath(route.entity.entityId);
    if (route.role === "hovered") paths.setHoveredPath(route.entity.entityId);
  }
  paths.update(0);
  (window as { __pathStudy?: unknown }).__pathStudy = { study, ...paths.getStats() };
  return () => paths.dispose();
};
