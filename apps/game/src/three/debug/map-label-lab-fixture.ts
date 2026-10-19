import { getHyperstructureName, getRealmNameById } from "@bibliothecadao/eternum";
import { Box3, Matrix4, type Object3D, type Scene, Vector3 } from "three";

import { CAMP_MODEL_PATH, RiftModelPath } from "../constants/scene-constants";
import { HYPERSTRUCTURE_HEIGHT } from "../structures/hyperstructure-design";
import { HyperstructureModel } from "../structures/hyperstructure-model";
import type { WorldmapProceduralTerrain } from "../terrain/worldmap-procedural-terrain";
import { gltfLoader } from "../utils/utils";

/** What the map labels a thing as: its kind, and how the viewer stands to its owner. */
export type MapLabelKind = "realm" | "camp" | "rift" | "hyperstructure" | "army";
export type MapLabelRelation = "own" | "ally" | "enemy" | "neutral";

type MapLabelTroopType = "crossbowman" | "knight" | "paladin";

/** A troop stack: a guard slot, or an army's troops. */
export interface MapLabelTroops {
  type: MapLabelTroopType;
  tier: 1 | 2 | 3;
  count: number;
}

const TROOP_TYPES: readonly MapLabelTroopType[] = ["crossbowman", "knight", "paladin"];

/** One labelled thing on the fixture map, with the facts a label or hover card may show. */
export interface MapLabelEntity {
  /** Its entity id as the contracts allocate it: the home realm's namespace above a serial (`home * 2^32 + n`). */
  entityId: number;
  kind: MapLabelKind;
  relation: MapLabelRelation;
  /** The owner's display name; null for an unowned thing. */
  owner: string | null;
  /** Where its label stands: above the model's top. */
  anchor: Vector3;
  /** The centre of the tile it stands on: hovering the tile opens its plate. */
  ground: Vector3;
  /** A realm's own name; empty for anything a player cannot name. */
  name: string;
  /** The realm that raised it (its id's namespace): where an army comes from. */
  homeName: string;
  level: number;
  /** A structure's guard slots, in slot order; empty when it stands open. */
  guards: readonly MapLabelTroops[];
  /** An army's troops and stamina. */
  army?: { troops: MapLabelTroops; stamina: number; staminaMax: number };
  /** What taking a camp or a rift gives: the points for a camp, the Essence a rift holds. */
  reward?: { amount: number; unit: string };
  /** Troops on their way to a structure of the viewer's, with the seconds until each arrives. */
  arrivals?: readonly { troops: MapLabelTroops; secondsLeft: number }[];
}

const LOCAL_RANGE = 2 ** 32;
const HEX_WIDTH = Math.sqrt(3);
const ROW_HEIGHT = 1.5;

const PLAYERS = ["Ravero", "Kestrel", "Moonhand", "Lord 3f2a", "Tamsin", "Orrin", "Vexa", "Bran"] as const;
const OWN = "djizus";

/** A realm's plate height above its ground (the realm models are placed by the benchmark, not here). */
const REALM_PLATE_HEIGHT = 2.5;
/** A plate's clearance above a placed model's top. */
const PLATE_CLEARANCE = 0.3;

/**
 * The lab's map: the benchmark's 48 real realms (a dense block on two-hex spacing) and, in the hexes between them, real
 * camp, rift, hyperstructure and knight models. Three realms are the viewer's, as a Blitz player starts with three. The
 * guards and armies spread over what a player must tell apart at a glance: whose, how strong and of what troops,
 * guarded or open.
 */
export async function createMapLabelFixture(
  scene: Scene,
  terrain: WorldmapProceduralTerrain,
  realmPositions: readonly Vector3[],
  { busy = false }: { busy?: boolean } = {},
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
  // Places a model and returns where its plate stands: just above the model's own top.
  const place = async (path: string, position: Vector3, scale = 1) => {
    const model = (await gltfLoader.loadAsync(path)).scene.clone();
    model.position.copy(position);
    model.scale.setScalar(scale);
    scene.add(model);
    placed.push(model);
    return position.clone().setY(new Box3().setFromObject(model).max.y + PLATE_CLEARANCE);
  };
  // A thing's home is a realm of its owner (the namespace its id came from); an unowned one has none.
  const homeOf = (slot: number, relation: MapLabelRelation) =>
    relation === "neutral"
      ? null
      : realms[slot].relation === relation
        ? realms[slot]
        : (realms.find((realm) => realm.relation === relation) ?? null);
  // The hex west of a realm, on its own row: beside the army south-west of it.
  const west = (index: number) => {
    const base = realmPositions[index];
    const x = base.x - HEX_WIDTH;
    return new Vector3(x, terrain.sampleSurface(x, base.z).height, base.z);
  };
  const sites: MapLabelEntity[] = [];
  for (const camp of CAMPS) {
    const ground = camp.west ? west(camp.slot) : beside(camp.slot, 1);
    const anchor = await place(CAMP_MODEL_PATH, ground);
    sites.push({ ...siteEntity("camp", anchor, homeOf(camp.slot, camp.relation), camp), ground });
  }
  for (const rift of RIFTS) {
    const ground = beside(rift.slot, 1);
    const anchor = await place(RiftModelPath, ground);
    sites.push({ ...siteEntity("rift", anchor, null, rift), ground });
  }
  // Hyperstructures are the production model's instances: each its own design, completed.
  const towers = new HyperstructureModel(HYPERSTRUCTURES.length);
  scene.add(towers.group);
  for (const [index, hyperstructure] of HYPERSTRUCTURES.entries()) {
    const position = beside(hyperstructure.slot, 1);
    const entity = hyperstructureEntity(
      position.clone().setY(position.y + HYPERSTRUCTURE_HEIGHT + PLATE_CLEARANCE),
      homeOf(hyperstructure.slot, hyperstructure.relation),
      hyperstructure,
    );
    towers.setMatrixAt(index, new Matrix4().makeTranslation(position.x, position.y, position.z));
    towers.setConstructionAt(index, { entityId: entity.entityId, progress: 100, completed: true });
    sites.push({ ...entity, ground: position });
  }
  towers.setCount(HYPERSTRUCTURES.length);
  const armies: MapLabelEntity[] = [];
  for (const [index, army] of [...ARMIES, ...(busy ? busyArmies() : [])].entries()) {
    const ground = beside(army.slot, -1);
    const anchor = await place("/models/units/default_knight_lvl1.glb", ground, 0.6);
    armies.push({ ...armyEntity(anchor, homeOf(army.slot, army.relation) ?? realms[army.slot], army, index), ground });
  }
  return {
    entities: [...realms, ...sites, ...armies],
    dispose: () => {
      placed.forEach((model) => model.removeFromParent());
      towers.group.removeFromParent();
      towers.dispose();
    },
  };
}

type Placement = { slot: number; relation: MapLabelRelation };

/**
 * Camps beside realms (south-east of them): the viewer's, other players', an ally's, and bandit camps. One stands west
 * of the viewer's realm 20, on the tile beside its army: the owner's crowded pair (map labels 2026-10-19).
 */
const CAMPS: readonly (Placement & { guard: MapLabelTroops; west?: true })[] = [
  { slot: 20, relation: "neutral", guard: { type: "paladin", tier: 1, count: 500 }, west: true },
  { slot: 18, relation: "own", guard: { type: "crossbowman", tier: 1, count: 300 } },
  { slot: 9, relation: "enemy", guard: { type: "crossbowman", tier: 3, count: 400 } },
  { slot: 12, relation: "enemy", guard: { type: "crossbowman", tier: 2, count: 350 } },
  { slot: 26, relation: "enemy", guard: { type: "paladin", tier: 1, count: 500 } },
  { slot: 29, relation: "neutral", guard: { type: "paladin", tier: 1, count: 250 } },
  { slot: 36, relation: "neutral", guard: { type: "crossbowman", tier: 2, count: 1100 } },
  { slot: 41, relation: "ally", guard: { type: "paladin", tier: 1, count: 450 } },
];
/** Rifts: unowned and guarded; a rift yields essence. */
const RIFTS: readonly (Placement & { guard: MapLabelTroops })[] = [
  { slot: 3, relation: "neutral", guard: { type: "crossbowman", tier: 2, count: 300 } },
  { slot: 33, relation: "neutral", guard: { type: "crossbowman", tier: 3, count: 500 } },
];
/** Two hyperstructures: one an enemy holds behind four guard slots, one unclaimed and open. */
const HYPERSTRUCTURES: readonly (Placement & { guards: MapLabelTroops[] })[] = [
  {
    slot: 21,
    relation: "enemy",
    guards: [
      { type: "crossbowman", tier: 1, count: 900 },
      { type: "knight", tier: 2, count: 500 },
      { type: "paladin", tier: 3, count: 300 },
      { type: "paladin", tier: 3, count: 300 },
    ],
  },
  { slot: 37, relation: "neutral", guards: [] },
];
/** Armies beside realms (south-west of them). The viewer's strongest is 2,700 strong (T2 900 or T3 300). */
const ARMIES: readonly (Placement & { troops: MapLabelTroops; stamina: number })[] = [
  { slot: 18, relation: "own", troops: { type: "crossbowman", tier: 2, count: 900 }, stamina: 96 },
  { slot: 20, relation: "own", troops: { type: "knight", tier: 1, count: 1400 }, stamina: 40 },
  { slot: 10, relation: "own", troops: { type: "paladin", tier: 3, count: 300 }, stamina: 118 },
  { slot: 11, relation: "enemy", troops: { type: "crossbowman", tier: 3, count: 600 }, stamina: 77 },
  { slot: 19, relation: "enemy", troops: { type: "knight", tier: 2, count: 950 }, stamina: 120 },
  { slot: 27, relation: "enemy", troops: { type: "paladin", tier: 1, count: 800 }, stamina: 30 },
  { slot: 28, relation: "ally", troops: { type: "crossbowman", tier: 2, count: 700 }, stamina: 60 },
  { slot: 35, relation: "enemy", troops: { type: "knight", tier: 2, count: 400 }, stamina: 110 },
];

/**
 * A busy Blitz: an army beside every realm that has none yet, so the block holds what a full lobby fields in one view
 * (48 realms and about as many armies, with the camps, rifts and hyperstructures between them).
 */
const busyArmies = (): (Placement & { troops: MapLabelTroops; stamina: number })[] => {
  const taken = new Set(ARMIES.map((army) => army.slot));
  return Array.from({ length: 48 }, (_, slot) => slot)
    .filter((slot) => !taken.has(slot))
    .map((slot) => ({
      slot,
      relation: (["enemy", "enemy", "ally", "enemy"] as const)[slot % 4],
      troops: { type: TROOP_TYPES[slot % 3], tier: (1 + (slot % 3)) as 1 | 2 | 3, count: 200 + ((slot * 211) % 1800) },
      stamina: 20 + ((slot * 37) % 100),
    }));
};

const OWN_REALMS = new Set([18, 19, 20]);
const ALLY_REALMS = new Set([28, 41]);

/** A realm's guard slots: one per level (a level-0 settlement holds one), some realms left open. */
const realmGuards = (index: number): MapLabelTroops[] =>
  index % 7 === 3
    ? []
    : Array.from({ length: 1 + (index % 4) }, (_, slot) => ({
        type: TROOP_TYPES[(index + slot) % 3],
        tier: (1 + ((index + slot) % 3)) as 1 | 2 | 3,
        count: 150 + ((index * 137 + slot * 61) % 700),
      }));

const realmEntity = (position: Vector3, index: number): MapLabelEntity => {
  const name = getRealmNameById(1 + ((index * 167) % 8000));
  const relation: MapLabelRelation = OWN_REALMS.has(index) ? "own" : ALLY_REALMS.has(index) ? "ally" : "enemy";
  return {
    entityId: index + 1,
    kind: "realm",
    relation,
    owner: relation === "own" ? OWN : PLAYERS[index % PLAYERS.length],
    anchor: position.clone().setY(position.y + REALM_PLATE_HEIGHT),
    ground: position,
    name,
    homeName: name,
    level: index % 4,
    guards: realmGuards(index),
    arrivals: relation === "own" ? REINFORCEMENTS : [],
  };
};

/** Reinforcements on their way to each of the viewer's realms. */
const REINFORCEMENTS = [
  { troops: { type: "paladin", tier: 2, count: 300 }, secondsLeft: 754 },
  { troops: { type: "knight", tier: 1, count: 1200 }, secondsLeft: 2_480 },
] as const;

const siteEntity = (
  kind: "camp" | "rift",
  anchor: Vector3,
  home: MapLabelEntity | null,
  site: Placement & { guard: MapLabelTroops },
): Omit<MapLabelEntity, "ground"> => ({
  // An unowned site is the world's: allocated in the administrative namespace, zero, after the realms' setup ids.
  entityId: home ? home.entityId * LOCAL_RANGE + 3 + site.slot : 100 + site.slot,
  kind,
  relation: site.relation,
  owner: home?.owner ?? null,
  anchor,
  name: "",
  homeName: home?.name ?? "",
  level: 0,
  guards: [site.guard],
  // As a Blitz world holds them: a rift's Essence and a camp's Labor, each filling over time.
  reward:
    kind === "rift"
      ? { amount: 1_200 + ((site.slot * 977) % 9_000), unit: "Essence" }
      : { amount: 300 + ((site.slot * 331) % 2_000), unit: "Labor" },
});

const hyperstructureEntity = (
  anchor: Vector3,
  home: MapLabelEntity | null,
  hyperstructure: Placement & { guards: MapLabelTroops[] },
): Omit<MapLabelEntity, "ground"> => ({
  entityId: home ? home.entityId * LOCAL_RANGE + 40 + hyperstructure.slot : 200 + hyperstructure.slot,
  kind: "hyperstructure",
  relation: hyperstructure.relation,
  owner: home?.owner ?? null,
  anchor,
  name: getHyperstructureName({
    entity_id: home ? home.entityId * LOCAL_RANGE + 40 + hyperstructure.slot : 200 + hyperstructure.slot,
  } as never),
  homeName: home?.name ?? "",
  level: 0,
  guards: hyperstructure.guards,
});

const armyEntity = (
  anchor: Vector3,
  home: MapLabelEntity,
  army: Placement & { troops: MapLabelTroops; stamina: number },
  index: number,
): Omit<MapLabelEntity, "ground"> => ({
  entityId: home.entityId * LOCAL_RANGE + 10 + index,
  kind: "army",
  relation: army.relation,
  owner: home.owner,
  anchor,
  name: "",
  homeName: home.name,
  level: 0,
  guards: [],
  army: { troops: army.troops, stamina: army.stamina, staminaMax: 120 },
});
