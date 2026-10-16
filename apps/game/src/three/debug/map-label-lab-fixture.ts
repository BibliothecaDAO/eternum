import { getRealmNameById } from "@bibliothecadao/eternum";
import { type Object3D, type Scene, Vector3 } from "three";

import { CAMP_MODEL_PATH, RiftModelPath } from "../constants/scene-constants";
import { createHyperstructureKit } from "../structures/hyperstructure-kit";
import type { WorldmapProceduralTerrain } from "../terrain/worldmap-procedural-terrain";
import { gltfLoader } from "../utils/utils";

/** What the map labels a thing as: its kind, and how the viewer stands to its owner. */
export type MapLabelKind = "realm" | "camp" | "rift" | "hyperstructure" | "army";
export type MapLabelRelation = "own" | "ally" | "enemy" | "neutral";

/** One labelled thing on the fixture map, with the facts a label or hover card may show. */
export interface MapLabelEntity {
  /** Its entity id as the contracts allocate it: the home realm's namespace above a serial (`home * 2^32 + n`). */
  entityId: number;
  kind: MapLabelKind;
  relation: MapLabelRelation;
  /** The owner's display name; null for an unowned site (bandits). */
  owner: string | null;
  /** Where its label stands: above the model's top. */
  anchor: Vector3;
  /** A realm's own name; empty for anything a player cannot name. */
  name: string;
  /** The realm whose namespace allocated it: a camp's or an army's home. */
  homeName: string;
  level: number;
  /** Guards, or an army's troops: the count and the tier. */
  troops: { count: number; tier: 1 | 2 | 3 };
  /** An army's number among its owner's armies, and its stamina. */
  army?: { number: number; stamina: number; staminaMax: number };
}

const LOCAL_RANGE = 2 ** 32;
const HEX_WIDTH = Math.sqrt(3);
const ROW_HEIGHT = 1.5;

const PLAYERS = ["Ravero", "Kestrel", "Moonhand", "Lord 3f2a", "Tamsin", "Orrin", "Vexa", "Bran"] as const;
const OWN = "djizus";

/** The label's height above each kind's ground, over its model (the production plates stand about this high). */
const LABEL_HEIGHT: Record<MapLabelKind, number> = {
  realm: 2.5,
  camp: 1.5,
  rift: 1.7,
  hyperstructure: 4.3,
  army: 1.45,
};

/**
 * The lab's map: the benchmark's 48 real realms (a dense block on two-hex spacing) and, in the hexes between them, real
 * camp, rift, hyperstructure and knight models. Three realms are the viewer's, as a Blitz player starts with three.
 */
export async function createMapLabelFixture(
  scene: Scene,
  terrain: WorldmapProceduralTerrain,
  realmPositions: readonly Vector3[],
): Promise<{ entities: MapLabelEntity[]; dispose: () => void }> {
  const realms = realmPositions.map((position, index) => realmEntity(position, index));
  // The hex south-east (or south-west) of a realm: on the next row, half a hex across.
  const beside = (index: number, side: 1 | -1) => {
    const base = realmPositions[index];
    const x = base.x + (side * HEX_WIDTH) / 2;
    const z = base.z + ROW_HEIGHT;
    return new Vector3(x, terrain.sampleSurface(x, z).height, z);
  };
  const placed: Object3D[] = [];
  const place = async (path: string | "hyperstructure", position: Vector3, scale = 1) => {
    const source =
      path === "hyperstructure" ? createHyperstructureKit().scene : (await gltfLoader.loadAsync(path)).scene;
    const model = source.clone();
    model.position.copy(position);
    model.scale.setScalar(scale);
    scene.add(model);
    placed.push(model);
  };
  // A thing's home is a realm of its owner (the namespace its id came from); an unowned one has none.
  const homeOf = (slot: number, relation: MapLabelRelation) =>
    relation === "neutral"
      ? null
      : realms[slot].relation === relation
        ? realms[slot]
        : (realms.find((realm) => realm.relation === relation) ?? null);
  const sites: MapLabelEntity[] = [];
  for (const [slot, relation] of CAMP_SLOTS) {
    const position = beside(slot, 1);
    await place(CAMP_MODEL_PATH, position);
    sites.push(siteEntity("camp", position, homeOf(slot, relation), relation, slot));
  }
  for (const slot of RIFT_SLOTS) {
    const position = beside(slot, 1);
    await place(RiftModelPath, position);
    sites.push(siteEntity("rift", position, null, "neutral", slot));
  }
  const hyperPosition = beside(HYPERSTRUCTURE_SLOT, 1);
  await place("hyperstructure", hyperPosition, 0.6);
  sites.push(hyperstructureEntity(hyperPosition));
  const knight = (await gltfLoader.loadAsync("/models/units/default_knight_lvl1.glb")).scene;
  const armies = ARMY_SLOTS.map(([slot, relation], index) => {
    const position = beside(slot, -1);
    const model = knight.clone();
    model.position.copy(position);
    model.scale.setScalar(0.6);
    scene.add(model);
    placed.push(model);
    return armyEntity(position, homeOf(slot, relation) ?? realms[slot], relation, index);
  });
  return {
    entities: [...realms, ...sites, ...armies],
    dispose: () => placed.forEach((model) => model.removeFromParent()),
  };
}

/** Camps by the realm they sit beside (south-east of it): the viewer's, other players', and unowned ones. */
const CAMP_SLOTS: readonly (readonly [number, MapLabelRelation])[] = [
  [18, "own"],
  [9, "enemy"],
  [12, "enemy"],
  [26, "enemy"],
  [29, "neutral"],
  [36, "neutral"],
  [41, "ally"],
];
const RIFT_SLOTS = [3, 33] as const;
const HYPERSTRUCTURE_SLOT = 19;
/** Armies by the realm they stand beside (south-west of it): three of the viewer's around their realms, the rest at war. */
const ARMY_SLOTS: readonly (readonly [number, MapLabelRelation])[] = [
  [18, "own"],
  [20, "own"],
  [10, "own"],
  [11, "enemy"],
  [19, "enemy"],
  [27, "enemy"],
  [28, "ally"],
  [35, "enemy"],
];

const OWN_REALMS = new Set([18, 19, 20]);
const ALLY_REALMS = new Set([28, 41]);

const realmEntity = (position: Vector3, index: number): MapLabelEntity => {
  const relation: MapLabelRelation = OWN_REALMS.has(index) ? "own" : ALLY_REALMS.has(index) ? "ally" : "enemy";
  const realmId = 1 + ((index * 167) % 8000);
  return {
    entityId: index + 1,
    kind: "realm",
    relation,
    owner: relation === "own" ? OWN : PLAYERS[index % PLAYERS.length],
    anchor: position.clone().setY(position.y + LABEL_HEIGHT.realm),
    name: getRealmNameById(realmId),
    homeName: getRealmNameById(realmId),
    level: index % 4,
    troops: { count: 400 + ((index * 137) % 1600), tier: (1 + (index % 3)) as 1 | 2 | 3 },
  };
};

const siteEntity = (
  kind: "camp" | "rift",
  position: Vector3,
  home: MapLabelEntity | null,
  relation: MapLabelRelation,
  slot: number,
): MapLabelEntity => ({
  // An unowned site is the world's: allocated in the administrative namespace, zero, after the realms' setup ids.
  entityId: home ? home.entityId * LOCAL_RANGE + 3 + slot : 100 + slot,
  kind,
  relation,
  owner: home?.owner ?? null,
  anchor: position.clone().setY(position.y + LABEL_HEIGHT[kind]),
  name: "",
  homeName: home?.name ?? "",
  level: 0,
  troops: { count: 120 + slot * 40, tier: kind === "rift" ? 2 : 1 },
});

const hyperstructureEntity = (position: Vector3): MapLabelEntity => ({
  entityId: 7 * LOCAL_RANGE + 1,
  kind: "hyperstructure",
  relation: "neutral",
  owner: null,
  anchor: position.clone().setY(position.y + LABEL_HEIGHT.hyperstructure),
  name: "Hyperstructure",
  homeName: "",
  level: 0,
  troops: { count: 3000, tier: 3 },
});

const armyEntity = (
  position: Vector3,
  home: MapLabelEntity,
  relation: MapLabelRelation,
  index: number,
): MapLabelEntity => ({
  entityId: home.entityId * LOCAL_RANGE + 10 + index,
  kind: "army",
  relation,
  owner: home.owner,
  anchor: position.clone().setY(position.y + LABEL_HEIGHT.army),
  name: "",
  homeName: home.name,
  level: 0,
  troops: { count: 600 + index * 410, tier: (1 + (index % 3)) as 1 | 2 | 3 },
  army: { number: index + 1, stamina: 40 + ((index * 23) % 80), staminaMax: 120 },
});
