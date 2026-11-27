import { buildingName, BuildingType, structureName, StructureType } from "@bibliothecadao/types";
import {
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  OctahedronGeometry,
  TorusGeometry,
  Vector3,
} from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import {
  assembleKitGltf,
  beamBetween,
  cutStoneBlock,
  extrudedGable,
  type KitPart,
  piece,
} from "./realm-kit-primitives";

const REALM_SUPPORT_KIT_IDS = [
  "storeroom",
  "storehouse-2",
  "storehouse-3",
  "rations-depot",
  "crossbow-range",
  "supply-yard",
  "scouts-lodge",
  "camp",
] as const;

type RealmSupportKitId = (typeof REALM_SUPPORT_KIT_IDS)[number];

const REALM_SUPPORT_KIT_PREFIX = "procedural:realm-support:";

export const REALM_SUPPORT_PATHS = {
  storeroom: `${REALM_SUPPORT_KIT_PREFIX}storeroom`,
  "storehouse-2": `${REALM_SUPPORT_KIT_PREFIX}storehouse-2`,
  "storehouse-3": `${REALM_SUPPORT_KIT_PREFIX}storehouse-3`,
  "rations-depot": `${REALM_SUPPORT_KIT_PREFIX}rations-depot`,
  "crossbow-range": `${REALM_SUPPORT_KIT_PREFIX}crossbow-range`,
  "supply-yard": `${REALM_SUPPORT_KIT_PREFIX}supply-yard`,
  "scouts-lodge": `${REALM_SUPPORT_KIT_PREFIX}scouts-lodge`,
  camp: `${REALM_SUPPORT_KIT_PREFIX}camp`,
} as const satisfies Record<RealmSupportKitId, string>;

interface RealmSupportLabEntry {
  readonly id: RealmSupportKitId;
  readonly label: string;
  readonly group: "training" | "sites";
  readonly path: string;
}

const REALM_SUPPORT_LAB_META = {
  storeroom: { label: () => buildingName(BuildingType.Storehouse, true), group: "training" },
  "storehouse-2": { label: () => `${buildingName(BuildingType.Storehouse, true)} II`, group: "training" },
  "storehouse-3": { label: () => `${buildingName(BuildingType.Storehouse, true)} III`, group: "training" },
  "rations-depot": { label: () => buildingName(BuildingType.RationsDepot, true), group: "training" },
  "crossbow-range": { label: () => buildingName(BuildingType.ResourceCrossbowmanT1, true), group: "training" },
  "supply-yard": { label: () => buildingName(BuildingType.SupplyYard, true), group: "training" },
  "scouts-lodge": { label: () => buildingName(BuildingType.ScoutsLodge, true), group: "training" },
  camp: { label: () => structureName(StructureType.Camp), group: "sites" },
} as const satisfies Record<RealmSupportKitId, { readonly label: () => string; readonly group: "training" | "sites" }>;

export function realmSupportLabEntries(): readonly RealmSupportLabEntry[] {
  return REALM_SUPPORT_KIT_IDS.map((id) => ({
    id,
    label: REALM_SUPPORT_LAB_META[id].label(),
    group: REALM_SUPPORT_LAB_META[id].group,
    path: REALM_SUPPORT_PATHS[id],
  }));
}

interface SupportParts {
  readonly masonry: KitPart[];
  readonly glow: KitPart[];
}

const PALETTE = {
  stone: "#cfc6b4",
  stoneLight: "#e5decb",
  stoneShade: "#a59b87",
  rubble: "#857d6e",
  rubbleDark: "#655f53",
  plaster: "#e6dac2",
  plasterShade: "#d1c1a3",
  timber: "#664329",
  timberDark: "#452c1a",
  timberLight: "#8a5f3b",
  slate: "#43586e",
  slateShade: "#314254",
  slateLight: "#5a7188",
  terracotta: "#bc6236",
  terracottaShade: "#974b26",
  terracottaBright: "#d17647",
  canvas: "#efe5cf",
  canvasShade: "#d7c8a9",
  crimson: "#a63a32",
  crimsonDark: "#7d2822",
  forest: "#3c6848",
  forestDark: "#2b4d34",
  gold: "#d4a644",
  goldBright: "#e8be5a",
  silver: "#d8e0e8",
  iron: "#3d3f42",
  copper: "#b96d3b",
  crate: "#9c7246",
  crateDark: "#785330",
  sack: "#d4c39c",
  hearthDark: "#241914",
  ember: "#ff9a36",
  amberGlow: "#ffc65c",
  lanternGlow: "#ffe296",
  targetWhite: "#f2ede2",
  targetRed: "#c23b32",
  earth: "#8a7858",
  earthShade: "#6f6045",
} as const;

const BUILDERS = {
  storeroom: buildStoreroom,
  "storehouse-2": buildStorehouseTier2,
  "storehouse-3": buildStorehouseTier3,
  "rations-depot": buildRationsDepot,
  "crossbow-range": buildCrossbowRange,
  "supply-yard": buildSupplyYard,
  "scouts-lodge": buildScoutsLodge,
  camp: buildConscriptionCamp,
} as const satisfies Record<RealmSupportKitId, (parts: SupportParts) => void>;

function parseRealmSupportKitPath(path: string): RealmSupportKitId | null {
  if (!path.startsWith(REALM_SUPPORT_KIT_PREFIX)) return null;
  const id = path.slice(REALM_SUPPORT_KIT_PREFIX.length);
  return id in BUILDERS ? (id as RealmSupportKitId) : null;
}

const FRONT_FACING_IDS = new Set<RealmSupportKitId>([
  "storeroom",
  "storehouse-2",
  "storehouse-3",
  "rations-depot",
  "supply-yard",
  "scouts-lodge",
  "camp",
]);

function createRealmSupportKit(id: RealmSupportKitId): GLTF {
  const parts: SupportParts = { masonry: [], glow: [] };
  BUILDERS[id](parts);
  return assembleKitGltf(`realm-support-${id}`, parts, FRONT_FACING_IDS.has(id) ? Math.PI : 0);
}

export function isRealmSupportKitPath(path: string): boolean {
  return parseRealmSupportKitPath(path) !== null;
}

export function resolveProceduralRealmSupportKit(path: string): GLTF | null {
  const id = parseRealmSupportKitPath(path);
  return id ? createRealmSupportKit(id) : null;
}

function buildStoreroom(parts: SupportParts): void {
  addHexPlinth(parts.masonry, 0.74, 0.055, PALETTE.stoneShade, PALETTE.rubble);
  addStoneHall(parts.masonry, {
    x: -0.06,
    y: 0.055,
    z: -0.08,
    width: 0.76,
    height: 0.36,
    depth: 0.56,
    wallColor: PALETTE.stone,
    quoinColor: PALETTE.stoneLight,
    roofColor: PALETTE.slate,
    roofHeight: 0.28,
    ridgeColor: PALETTE.timberDark,
  });
  addArchedDoor(parts.masonry, -0.06, 0.055, 0.205, 0.22, 0.24, PALETTE.timberDark, PALETTE.stoneLight);
  addHoistGantry(parts.masonry, -0.06, 0.59, 0.2, 0.26, true);
  addCrateStack(parts.masonry, 0.44, 0.055, 0.14);
  addBarrel(parts.masonry, -0.46, 0.055, 0.22, 0.065, 0.14);
  addBarrel(parts.masonry, -0.34, 0.055, 0.32, 0.062, 0.13);
  addLanternSconce(parts, 0.12, 0.28, 0.22);
}

function buildStorehouseTier2(parts: SupportParts): void {
  addHexPlinth(parts.masonry, 0.78, 0.065, PALETTE.stoneShade, PALETTE.silver);
  addStoneHall(parts.masonry, {
    x: -0.1,
    y: 0.065,
    z: -0.1,
    width: 0.82,
    height: 0.44,
    depth: 0.58,
    wallColor: PALETTE.stone,
    quoinColor: PALETTE.stoneLight,
    roofColor: PALETTE.slate,
    roofHeight: 0.32,
    ridgeColor: PALETTE.silver,
  });
  addStoneHall(parts.masonry, {
    x: 0.36,
    y: 0.065,
    z: 0.08,
    width: 0.38,
    height: 0.32,
    depth: 0.46,
    wallColor: PALETTE.plaster,
    quoinColor: PALETTE.timber,
    roofColor: PALETTE.slateLight,
    roofHeight: 0.22,
    ridgeColor: PALETTE.silver,
  });
  addArchedDoor(parts.masonry, -0.1, 0.065, 0.195, 0.24, 0.27, PALETTE.timberDark, PALETTE.silver);
  addHoistGantry(parts.masonry, -0.1, 0.71, 0.2, 0.3, true);
  addCrateStack(parts.masonry, -0.44, 0.065, 0.28);
  addBarrel(parts.masonry, 0.16, 0.065, 0.34, 0.068, 0.15);
  addBarrel(parts.masonry, 0.29, 0.065, 0.39, 0.064, 0.14);
  addTierBanner(parts.masonry, -0.1, 0.82, -0.1, 2, PALETTE.silver);
  addLanternSconce(parts, 0.09, 0.32, 0.21);
  addWindowGlow(parts, 0.36, 0.24, 0.315, 0.1, 0.1);
}

function buildStorehouseTier3(parts: SupportParts): void {
  addHexPlinth(parts.masonry, 0.8, 0.075, PALETTE.stoneShade, PALETTE.gold);
  addStoneHall(parts.masonry, {
    x: 0,
    y: 0.075,
    z: -0.12,
    width: 0.94,
    height: 0.46,
    depth: 0.58,
    wallColor: PALETTE.stoneLight,
    quoinColor: PALETTE.stoneShade,
    roofColor: PALETTE.slate,
    roofHeight: 0.3,
    ridgeColor: PALETTE.goldBright,
  });
  addStoneHall(parts.masonry, {
    x: -0.02,
    y: 0.535,
    z: -0.12,
    width: 0.5,
    height: 0.26,
    depth: 0.38,
    wallColor: PALETTE.plaster,
    quoinColor: PALETTE.gold,
    roofColor: PALETTE.slateShade,
    roofHeight: 0.22,
    ridgeColor: PALETTE.goldBright,
  });
  for (const side of [-0.48, 0.48]) {
    parts.masonry.push(piece(cutStoneBlock(0.11, 0.42, 0.14), PALETTE.stoneShade, side, 0.285, 0.16));
    parts.masonry.push(piece(cutStoneBlock(0.11, 0.42, 0.14), PALETTE.stoneShade, side, 0.285, -0.4));
  }
  addArchedDoor(parts.masonry, -0.22, 0.075, 0.175, 0.22, 0.28, PALETTE.timberDark, PALETTE.gold);
  addArchedDoor(parts.masonry, 0.22, 0.075, 0.175, 0.22, 0.28, PALETTE.timberDark, PALETTE.gold);
  addHoistGantry(parts.masonry, 0, 0.88, 0.08, 0.3, true);
  addCrateStack(parts.masonry, -0.46, 0.075, 0.3);
  addCrateStack(parts.masonry, 0.42, 0.075, 0.28);
  addBarrel(parts.masonry, 0.02, 0.075, 0.36, 0.068, 0.15);
  addTierBanner(parts.masonry, -0.02, 1.01, -0.12, 3, PALETTE.goldBright);
  addWindowGlow(parts, -0.14, 0.66, 0.076, 0.08, 0.1);
  addWindowGlow(parts, 0.1, 0.66, 0.076, 0.08, 0.1);
  addLanternSconce(parts, 0, 0.34, 0.19);
}

function buildRationsDepot(parts: SupportParts): void {
  addHexPlinth(parts.masonry, 0.75, 0.055, PALETTE.stoneShade, PALETTE.rubble);
  addStoneHall(parts.masonry, {
    x: -0.04,
    y: 0.055,
    z: -0.12,
    width: 0.78,
    height: 0.35,
    depth: 0.5,
    wallColor: PALETTE.plaster,
    quoinColor: PALETTE.stoneShade,
    roofColor: PALETTE.terracotta,
    roofHeight: 0.28,
    ridgeColor: PALETTE.terracottaBright,
  });
  addArchedDoor(parts.masonry, -0.06, 0.055, 0.135, 0.2, 0.24, PALETTE.timberDark, PALETTE.stoneLight);
  addStripedAwning(parts.masonry, -0.04, 0.32, 0.25, 0.64, 0.24);
  addBakehouseOven(parts, 0.42, 0.055, -0.16);
  addBarrel(parts.masonry, -0.34, 0.055, 0.3, 0.068, 0.15);
  addBarrel(parts.masonry, -0.2, 0.055, 0.34, 0.064, 0.14);
  addGrainSack(parts.masonry, 0.14, 0.055, 0.31, 0.085);
  addGrainSack(parts.masonry, 0.27, 0.055, 0.26, 0.078);
  addGrainSack(parts.masonry, 0.21, 0.135, 0.29, 0.068);
  addAmphora(parts.masonry, -0.44, 0.055, 0.16);
  addAmphora(parts.masonry, 0.42, 0.055, 0.22);
  addBarrel(parts.masonry, -0.3, 0.055, -0.44, 0.06, 0.13);
  addGrainSack(parts.masonry, -0.14, 0.055, -0.43, 0.075);
  addWindowGlow(parts, -0.26, 0.25, 0.136, 0.09, 0.09);
  addWindowGlow(parts, -0.16, 0.26, -0.376, 0.1, 0.09);
}

function buildCrossbowRange(parts: SupportParts): void {
  addHexPlinth(parts.masonry, 0.76, 0.045, PALETTE.earth, PALETTE.rubbleDark);
  parts.masonry.push(piece(new BoxGeometry(0.86, 0.04, 0.32), PALETTE.timberDark, 0, 0.065, -0.34));
  for (const px of [-0.39, 0, 0.39]) {
    parts.masonry.push(piece(new BoxGeometry(0.055, 0.44, 0.055), PALETTE.timber, px, 0.28, -0.46));
    parts.masonry.push(piece(new BoxGeometry(0.055, 0.36, 0.055), PALETTE.timber, px, 0.24, -0.21));
  }
  const leanRoof = new BoxGeometry(0.96, 0.048, 0.42);
  leanRoof.rotateX(0.28);
  parts.masonry.push(piece(leanRoof, PALETTE.slate, 0, 0.485, -0.34));
  parts.masonry.push(piece(new BoxGeometry(0.94, 0.042, 0.045), PALETTE.timberLight, 0, 0.53, -0.48));
  parts.masonry.push(piece(new BoxGeometry(0.76, 0.036, 0.11), PALETTE.timberLight, 0, 0.21, -0.22));
  addCrossbowProp(parts.masonry, -0.2, 0.24, -0.22);
  addCrossbowProp(parts.masonry, 0.18, 0.24, -0.22);
  addBarrel(parts.masonry, 0.45, 0.045, -0.18, 0.052, 0.14);

  for (const side of [-0.49, 0.49]) {
    parts.masonry.push(piece(new BoxGeometry(0.045, 0.16, 0.045), PALETTE.timber, side, 0.125, -0.05));
    parts.masonry.push(piece(new BoxGeometry(0.045, 0.16, 0.045), PALETTE.timber, side, 0.125, 0.2));
    parts.masonry.push(piece(new BoxGeometry(0.032, 0.032, 0.62), PALETTE.timberLight, side, 0.175, 0.04));
  }

  parts.masonry.push(piece(cutStoneBlock(0.94, 0.36, 0.16), PALETTE.stoneShade, 0, 0.225, 0.46));
  parts.masonry.push(piece(new BoxGeometry(0.98, 0.045, 0.19), PALETTE.stoneLight, 0, 0.41, 0.46));
  for (const tx of [-0.28, 0, 0.28]) {
    addArcheryTarget(parts.masonry, tx, 0.045, 0.33);
  }
  addLanternSconce(parts, -0.39, 0.35, -0.18);
}

function buildSupplyYard(parts: SupportParts): void {
  addHexPlinth(parts.masonry, 0.78, 0.05, PALETTE.stoneShade, PALETTE.rubble);
  addLowYardFence(parts.masonry, 0.72, 0.05);
  addSupplyCart(parts.masonry, -0.2, 0.05, 0.14, 0.22);
  addTimberAndIngotStacks(parts.masonry, 0.34, 0.05, 0.18);
  addCargoCrane(parts.masonry, 0.32, 0.05, -0.24);
  addQuartermasterShelter(parts, -0.32, 0.05, -0.32);
  addCrateStack(parts.masonry, 0.06, 0.05, -0.36);
}

function buildScoutsLodge(parts: SupportParts): void {
  addHexPlinth(parts.masonry, 0.74, 0.055, PALETTE.rubble, PALETTE.earthShade);
  parts.masonry.push(piece(new BoxGeometry(0.56, 0.045, 0.22), PALETTE.timber, -0.12, 0.075, 0.26));
  addStoneHall(parts.masonry, {
    x: -0.14,
    y: 0.055,
    z: -0.06,
    width: 0.6,
    height: 0.34,
    depth: 0.48,
    wallColor: PALETTE.timberLight,
    quoinColor: PALETTE.timberDark,
    roofColor: PALETTE.slateShade,
    roofHeight: 0.38,
    ridgeColor: PALETTE.timberDark,
  });
  addArchedDoor(parts.masonry, -0.14, 0.055, 0.185, 0.17, 0.23, PALETTE.timberDark, PALETTE.timber);
  addLookoutPerch(parts, 0.36, 0.055, -0.12);
  addBannerMast(parts.masonry, 0.44, 0.055, 0.28, 0.78, PALETTE.forest, PALETTE.goldBright);
  addCrateStack(parts.masonry, -0.46, 0.055, 0.24);
  addWindowGlow(parts, -0.14, 0.5, 0.17, 0.09, 0.09);
  addWindowGlow(parts, -0.33, 0.24, 0.186, 0.08, 0.08);
}

function buildConscriptionCamp(parts: SupportParts): void {
  addHexPlinth(parts.masonry, 0.78, 0.042, PALETTE.earth, PALETTE.earthShade);
  addPalisadeArc(parts.masonry, 0.71, 0.042);
  addPitchedTent(parts.masonry, 0, 0.042, -0.34, 0.48, 0.38, 0.36, PALETTE.canvas, PALETTE.crimson, 0);
  addPitchedTent(parts.masonry, -0.42, 0.042, 0.12, 0.36, 0.28, 0.3, PALETTE.canvasShade, PALETTE.timber, 0.52);
  addPitchedTent(parts.masonry, 0.42, 0.042, 0.12, 0.36, 0.28, 0.3, PALETTE.canvasShade, PALETTE.timber, -0.52);
  addMusterBrazier(parts, 0, 0.042, 0.12);
  addBannerMast(parts.masonry, 0.28, 0.042, -0.26, 0.84, PALETTE.crimson, PALETTE.goldBright);
  addWeaponRack(parts.masonry, -0.28, 0.042, 0.42);
}

function addHexPlinth(parts: KitPart[], radius: number, height: number, topColor: string, rimColor: string): void {
  parts.push(piece(new CylinderGeometry(radius, radius * 1.03, height, 6), rimColor, 0, height / 2, 0));
  parts.push(piece(new CylinderGeometry(radius * 0.94, radius * 0.96, 0.016, 6), topColor, 0, height + 0.005, 0));
}

function addStoneHall(
  parts: KitPart[],
  opts: {
    x: number;
    y: number;
    z: number;
    width: number;
    height: number;
    depth: number;
    wallColor: string;
    quoinColor: string;
    roofColor: string;
    roofHeight: number;
    ridgeColor: string;
  },
): void {
  const { x, y, z, width, height, depth, wallColor, quoinColor, roofColor, roofHeight, ridgeColor } = opts;
  parts.push(piece(cutStoneBlock(width, height, depth), wallColor, x, y + height / 2, z));
  for (const sx of [-width / 2, width / 2]) {
    for (const sz of [-depth / 2, depth / 2]) {
      parts.push(piece(new BoxGeometry(0.055, height + 0.01, 0.055), quoinColor, x + sx, y + height / 2, z + sz));
    }
  }
  parts.push(piece(new BoxGeometry(width + 0.04, 0.04, depth + 0.04), PALETTE.timber, x, y + height, z));
  parts.push(piece(new BoxGeometry(width + 0.03, 0.032, depth + 0.03), PALETTE.timberDark, x, y + height * 0.52, z));
  for (const sz of [-(depth / 2 + 0.008), depth / 2 + 0.008]) {
    parts.push(piece(new BoxGeometry(0.036, height, 0.02), PALETTE.timber, x, y + height / 2, z + sz));
  }
  const gable = extrudedGable(width + 0.1, roofHeight, depth + 0.08);
  parts.push(piece(gable, roofColor, x, y + height + 0.01, z));
  parts.push(piece(new BoxGeometry(0.05, 0.045, depth + 0.12), ridgeColor, x, y + height + roofHeight + 0.015, z));
  for (const sz of [-(depth / 2 + 0.04), depth / 2 + 0.04]) {
    parts.push(piece(new ConeGeometry(0.032, 0.075, 4), ridgeColor, x, y + height + roofHeight + 0.065, z + sz));
  }
}

function addArchedDoor(
  parts: KitPart[],
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  doorColor: string,
  frameColor: string,
): void {
  parts.push(piece(new BoxGeometry(width + 0.05, height + 0.035, 0.036), frameColor, x, y + height / 2 + 0.01, z));
  parts.push(piece(new BoxGeometry(width, height, 0.044), doorColor, x, y + height / 2, z + 0.006));
  const arch = new CylinderGeometry(width / 2, width / 2, 0.046, 10);
  arch.rotateX(Math.PI / 2);
  parts.push(piece(arch, doorColor, x, y + height, z + 0.006));
}

function addHoistGantry(parts: KitPart[], x: number, y: number, z: number, reach: number, withCrate: boolean): void {
  parts.push(piece(new BoxGeometry(0.055, 0.055, reach), PALETTE.timber, x, y, z + reach / 2));
  parts.push(
    piece(
      beamBetween(new Vector3(x, y - 0.14, z + 0.02), new Vector3(x, y - 0.01, z + reach * 0.72), 0.032),
      PALETTE.timberDark,
    ),
  );
  const pulley = new CylinderGeometry(0.032, 0.032, 0.022, 10);
  pulley.rotateZ(Math.PI / 2);
  parts.push(piece(pulley, PALETTE.iron, x, y - 0.03, z + reach - 0.03));
  if (withCrate) {
    parts.push(piece(new CylinderGeometry(0.009, 0.009, 0.16, 6), PALETTE.sack, x, y - 0.11, z + reach - 0.03));
    parts.push(piece(new BoxGeometry(0.11, 0.11, 0.11), PALETTE.crate, x, y - 0.22, z + reach - 0.03));
  }
}

function addCrateStack(parts: KitPart[], x: number, y: number, z: number): void {
  parts.push(piece(new BoxGeometry(0.14, 0.12, 0.14), PALETTE.crate, x, y + 0.06, z, 0.12));
  parts.push(piece(new BoxGeometry(0.13, 0.11, 0.13), PALETTE.crateDark, x + 0.12, y + 0.055, z + 0.05, -0.2));
  parts.push(piece(new BoxGeometry(0.11, 0.1, 0.11), PALETTE.crate, x + 0.05, y + 0.165, z + 0.02, 0.35));
}

function addBarrel(parts: KitPart[], x: number, y: number, z: number, radius: number, height: number): void {
  parts.push(
    piece(new CylinderGeometry(radius * 0.88, radius * 0.92, height, 10), PALETTE.timberLight, x, y + height / 2, z),
  );
  parts.push(piece(new CylinderGeometry(radius, radius, height * 0.16, 10), PALETTE.iron, x, y + height * 0.28, z));
  parts.push(piece(new CylinderGeometry(radius, radius, height * 0.16, 10), PALETTE.iron, x, y + height * 0.72, z));
}

function addGrainSack(parts: KitPart[], x: number, y: number, z: number, radius: number): void {
  const sack = new IcosahedronGeometry(radius, 1);
  sack.scale(1, 0.78, 0.88);
  parts.push(piece(sack, PALETTE.sack, x, y + radius * 0.65, z));
}

function addAmphora(parts: KitPart[], x: number, y: number, z: number): void {
  parts.push(piece(new CylinderGeometry(0.036, 0.028, 0.09, 8), PALETTE.terracottaBright, x, y + 0.045, z));
  parts.push(piece(new CylinderGeometry(0.022, 0.036, 0.05, 8), PALETTE.terracotta, x, y + 0.115, z));
  parts.push(piece(new TorusGeometry(0.024, 0.007, 6, 10), PALETTE.terracottaBright, x, y + 0.14, z));
}

function addStripedAwning(parts: KitPart[], x: number, y: number, z: number, width: number, depth: number): void {
  const stripes = 5;
  const stripeW = width / stripes;
  for (let index = 0; index < stripes; index++) {
    const sx = x - width / 2 + stripeW * (index + 0.5);
    const panel = new BoxGeometry(stripeW - 0.004, 0.022, depth);
    panel.rotateX(0.32);
    parts.push(piece(panel, index % 2 === 0 ? PALETTE.canvas : PALETTE.terracotta, sx, y, z));
  }
  for (const px of [x - width / 2 + 0.03, x + width / 2 - 0.03]) {
    parts.push(
      piece(new BoxGeometry(0.032, y - 0.08, 0.032), PALETTE.timber, px, (y + 0.055) / 2 - 0.04, z + depth / 2 - 0.02),
    );
  }
}

function addBakehouseOven(parts: SupportParts, x: number, y: number, z: number): void {
  parts.masonry.push(piece(new CylinderGeometry(0.18, 0.21, 0.22, 10), PALETTE.stone, x, y + 0.11, z));
  const dome = new IcosahedronGeometry(0.18, 1);
  dome.scale(1, 0.72, 1);
  parts.masonry.push(piece(dome, PALETTE.terracottaShade, x, y + 0.24, z));
  parts.masonry.push(piece(new BoxGeometry(0.11, 0.44, 0.11), PALETTE.stoneShade, x + 0.04, y + 0.42, z - 0.04));
  parts.masonry.push(piece(new BoxGeometry(0.145, 0.04, 0.145), PALETTE.stoneLight, x + 0.04, y + 0.65, z - 0.04));
  parts.glow.push(piece(new BoxGeometry(0.09, 0.09, 0.04), PALETTE.ember, x, y + 0.12, z + 0.175));
}

function addCrossbowProp(parts: KitPart[], x: number, y: number, z: number): void {
  parts.push(piece(new BoxGeometry(0.024, 0.024, 0.14), PALETTE.timberDark, x, y, z));
  parts.push(piece(new BoxGeometry(0.14, 0.018, 0.02), PALETTE.iron, x, y + 0.008, z + 0.04));
}

function addArcheryTarget(parts: KitPart[], x: number, y: number, z: number): void {
  parts.push(
    piece(beamBetween(new Vector3(x - 0.07, y, z - 0.05), new Vector3(x, y + 0.28, z + 0.02), 0.024), PALETTE.timber),
  );
  parts.push(
    piece(beamBetween(new Vector3(x + 0.07, y, z - 0.05), new Vector3(x, y + 0.28, z + 0.02), 0.024), PALETTE.timber),
  );
  parts.push(
    piece(beamBetween(new Vector3(x, y, z + 0.09), new Vector3(x, y + 0.26, z + 0.02), 0.024), PALETTE.timberDark),
  );

  const outer = new CylinderGeometry(0.105, 0.105, 0.032, 14);
  outer.rotateX(Math.PI / 2);
  parts.push(piece(outer, PALETTE.targetWhite, x, y + 0.19, z - 0.015));

  const ring = new CylinderGeometry(0.068, 0.068, 0.036, 12);
  ring.rotateX(Math.PI / 2);
  parts.push(piece(ring, PALETTE.targetRed, x, y + 0.19, z - 0.016));

  const bullseye = new CylinderGeometry(0.03, 0.03, 0.04, 10);
  bullseye.rotateX(Math.PI / 2);
  parts.push(piece(bullseye, PALETTE.goldBright, x, y + 0.19, z - 0.017));
}

function addLowYardFence(parts: KitPart[], radius: number, y: number): void {
  for (let side = 0; side < 6; side++) {
    if (side === 0) continue;
    const a0 = (side * Math.PI) / 3;
    const a1 = ((side + 1) * Math.PI) / 3;
    const p0 = new Vector3(Math.sin(a0) * radius, y + 0.12, Math.cos(a0) * radius);
    const p1 = new Vector3(Math.sin(a1) * radius, y + 0.12, Math.cos(a1) * radius);
    parts.push(piece(new BoxGeometry(0.065, 0.2, 0.065), PALETTE.stoneLight, p0.x, y + 0.1, p0.z));
    parts.push(piece(beamBetween(p0, p1, 0.036), PALETTE.timber));
    parts.push(piece(beamBetween(p0.clone().setY(y + 0.06), p1.clone().setY(y + 0.06), 0.036), PALETTE.timberDark));
  }
  const leftGate = new Vector3(Math.sin(0) * radius, y + 0.14, Math.cos(0) * radius);
  parts.push(piece(new BoxGeometry(0.08, 0.26, 0.08), PALETTE.stoneLight, leftGate.x, y + 0.13, leftGate.z));
}

function addSupplyCart(parts: KitPart[], x: number, y: number, z: number, yaw: number): void {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const place = (geometry: BufferGeometry, color: string, lx: number, ly: number, lz: number) =>
    parts.push(piece(geometry, color, x + lx * cos + lz * sin, y + ly, z - lx * sin + lz * cos, yaw));

  place(new BoxGeometry(0.28, 0.045, 0.42), PALETTE.timber, 0, 0.12, 0);
  for (const sx of [-0.135, 0.135]) {
    place(new BoxGeometry(0.026, 0.11, 0.42), PALETTE.timberLight, sx, 0.18, 0);
  }
  place(new BoxGeometry(0.28, 0.11, 0.026), PALETTE.timberLight, 0, 0.18, -0.2);
  for (const sx of [-0.16, 0.16]) {
    for (const sz of [-0.12, 0.12]) {
      const wheel = new CylinderGeometry(0.09, 0.09, 0.032, 12);
      wheel.rotateZ(Math.PI / 2);
      place(wheel, PALETTE.timberDark, sx, 0.09, sz);
    }
  }
  place(new BoxGeometry(0.16, 0.12, 0.16), PALETTE.crate, 0, 0.2, -0.06);
  place(new BoxGeometry(0.18, 0.1, 0.14), PALETTE.sack, 0, 0.19, 0.1);
}

function addTimberAndIngotStacks(parts: KitPart[], x: number, y: number, z: number): void {
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3 - row; col++) {
      const log = new CylinderGeometry(0.036, 0.036, 0.34, 8);
      log.rotateX(Math.PI / 2);
      parts.push(piece(log, PALETTE.timberLight, x + (col - (2 - row) / 2) * 0.075, y + 0.036 + row * 0.064, z));
    }
  }
  for (let index = 0; index < 3; index++) {
    parts.push(
      piece(new BoxGeometry(0.06, 0.035, 0.14), PALETTE.copper, x - 0.06 + index * 0.065, y + 0.018, z + 0.24),
    );
  }
  parts.push(piece(new BoxGeometry(0.06, 0.035, 0.14), PALETTE.gold, x, y + 0.053, z + 0.24));
}

function addCargoCrane(parts: KitPart[], x: number, y: number, z: number): void {
  parts.push(piece(new CylinderGeometry(0.1, 0.12, 0.12, 8), PALETTE.stoneShade, x, y + 0.06, z));
  parts.push(piece(new BoxGeometry(0.075, 0.78, 0.075), PALETTE.timber, x, y + 0.45, z));
  parts.push(
    piece(
      beamBetween(new Vector3(x + 0.12, y + 0.56, z), new Vector3(x - 0.34, y + 0.86, z + 0.18), 0.048),
      PALETTE.timberLight,
    ),
  );
  parts.push(
    piece(beamBetween(new Vector3(x, y + 0.52, z), new Vector3(x - 0.2, y + 0.76, z + 0.1), 0.034), PALETTE.timberDark),
  );
  parts.push(piece(new BoxGeometry(0.11, 0.11, 0.11), PALETTE.stoneLight, x + 0.14, y + 0.53, z));
  parts.push(piece(new CylinderGeometry(0.009, 0.009, 0.26, 6), PALETTE.sack, x - 0.32, y + 0.71, z + 0.17));
  parts.push(piece(new BoxGeometry(0.12, 0.11, 0.12), PALETTE.crate, x - 0.32, y + 0.54, z + 0.17));
}

function addQuartermasterShelter(parts: SupportParts, x: number, y: number, z: number): void {
  for (const sx of [-0.16, 0.16]) {
    for (const sz of [-0.12, 0.12]) {
      parts.masonry.push(piece(new BoxGeometry(0.04, 0.34, 0.04), PALETTE.timber, x + sx, y + 0.17, z + sz));
    }
  }
  const roof = new BoxGeometry(0.42, 0.038, 0.34);
  roof.rotateX(0.18);
  parts.masonry.push(piece(roof, PALETTE.canvas, x, y + 0.35, z));
  parts.masonry.push(piece(new BoxGeometry(0.26, 0.13, 0.14), PALETTE.timberDark, x, y + 0.065, z));
  addLanternSconce(parts, x + 0.16, y + 0.26, z + 0.14);
}

function addLookoutPerch(parts: SupportParts, x: number, y: number, z: number): void {
  for (const sx of [-0.1, 0.1]) {
    for (const sz of [-0.1, 0.1]) {
      parts.masonry.push(piece(new BoxGeometry(0.042, 0.74, 0.042), PALETTE.timberDark, x + sx, y + 0.37, z + sz));
    }
  }
  parts.masonry.push(piece(new BoxGeometry(0.32, 0.045, 0.32), PALETTE.timber, x, y + 0.74, z));
  for (const side of [-0.145, 0.145]) {
    parts.masonry.push(piece(new BoxGeometry(0.32, 0.09, 0.028), PALETTE.timberLight, x, y + 0.81, z + side));
    parts.masonry.push(piece(new BoxGeometry(0.028, 0.09, 0.32), PALETTE.timberLight, x + side, y + 0.81, z));
  }
  for (let rung = 0; rung < 5; rung++) {
    parts.masonry.push(
      piece(new BoxGeometry(0.14, 0.02, 0.02), PALETTE.timberLight, x, y + 0.14 + rung * 0.12, z + 0.11),
    );
  }
  parts.masonry.push(piece(new BoxGeometry(0.032, 0.24, 0.032), PALETTE.timberDark, x + 0.12, y + 0.96, z + 0.12));
  parts.masonry.push(piece(new BoxGeometry(0.14, 0.024, 0.024), PALETTE.iron, x + 0.18, y + 1.06, z + 0.12));
  parts.glow.push(piece(new OctahedronGeometry(0.046, 0), PALETTE.lanternGlow, x + 0.22, y + 0.99, z + 0.12));
}

function addPalisadeArc(parts: KitPart[], radius: number, y: number): void {
  for (let index = 0; index < 11; index++) {
    const angle = -Math.PI * 0.62 + (index / 10) * Math.PI * 1.24;
    const sx = Math.sin(angle) * radius;
    const sz = -Math.cos(angle) * radius;
    const stakeH = 0.26 + (index % 2) * 0.05;
    parts.push(piece(new CylinderGeometry(0.018, 0.034, stakeH, 6), PALETTE.timber, sx, y + stakeH / 2, sz));
  }
}

function addPitchedTent(
  parts: KitPart[],
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  depth: number,
  canvasColor: string,
  trimColor: string,
  yaw: number,
): void {
  parts.push(piece(extrudedGable(width, height, depth), canvasColor, x, y, z, yaw));
  parts.push(piece(new BoxGeometry(0.045, 0.04, depth + 0.05), trimColor, x, y + height, z, yaw));
  parts.push(
    piece(
      new BoxGeometry(width * 0.36, height * 0.56, 0.035),
      PALETTE.hearthDark,
      x,
      y + height * 0.28,
      z + depth / 2,
      yaw,
    ),
  );
  parts.push(piece(new ConeGeometry(0.026, 0.065, 4), PALETTE.gold, x, y + height + 0.045, z, yaw));
}

function addMusterBrazier(parts: SupportParts, x: number, y: number, z: number): void {
  parts.masonry.push(piece(new CylinderGeometry(0.15, 0.18, 0.05, 8), PALETTE.rubbleDark, x, y + 0.025, z));
  parts.masonry.push(piece(new CylinderGeometry(0.12, 0.075, 0.11, 8), PALETTE.iron, x, y + 0.105, z));
  parts.glow.push(piece(new OctahedronGeometry(0.078, 0), PALETTE.ember, x, y + 0.2, z));
  parts.glow.push(piece(new OctahedronGeometry(0.048, 0), PALETTE.amberGlow, x, y + 0.26, z));
}

function addWeaponRack(parts: KitPart[], x: number, y: number, z: number): void {
  for (const sx of [-0.12, 0.12]) {
    parts.push(piece(new BoxGeometry(0.032, 0.24, 0.032), PALETTE.timber, x + sx, y + 0.12, z));
  }
  parts.push(piece(new BoxGeometry(0.28, 0.028, 0.03), PALETTE.timberLight, x, y + 0.19, z));
  for (const sx of [-0.07, 0, 0.07]) {
    parts.push(piece(new CylinderGeometry(0.009, 0.009, 0.34, 6), PALETTE.timberDark, x + sx, y + 0.17, z));
    parts.push(piece(new ConeGeometry(0.018, 0.055, 4), PALETTE.silver, x + sx, y + 0.36, z));
  }
}

function addTierBanner(parts: KitPart[], x: number, y: number, z: number, tier: 2 | 3, clothColor: string): void {
  parts.push(piece(new CylinderGeometry(0.014, 0.018, 0.36, 6), PALETTE.timberDark, x, y + 0.18, z));
  parts.push(piece(new BoxGeometry(0.24, 0.14, 0.018), clothColor, x + 0.12, y + 0.27, z));
  for (let stripe = 0; stripe < tier; stripe++) {
    parts.push(
      piece(
        new BoxGeometry(0.02, 0.085, 0.024),
        PALETTE.hearthDark,
        x + 0.12 + (stripe - (tier - 1) / 2) * 0.055,
        y + 0.27,
        z,
      ),
    );
  }
}

function addBannerMast(
  parts: KitPart[],
  x: number,
  y: number,
  z: number,
  height: number,
  clothColor: string,
  trimColor: string,
): void {
  parts.push(piece(new CylinderGeometry(0.018, 0.024, height, 6), PALETTE.timberDark, x, y + height / 2, z));
  parts.push(piece(new BoxGeometry(0.18, 0.02, 0.02), PALETTE.timber, x, y + height - 0.04, z));
  parts.push(piece(new BoxGeometry(0.15, 0.28, 0.018), clothColor, x, y + height - 0.19, z));
  parts.push(piece(new BoxGeometry(0.15, 0.036, 0.022), trimColor, x, y + height - 0.31, z));
  parts.push(piece(new ConeGeometry(0.028, 0.065, 4), trimColor, x, y + height + 0.03, z));
}

function addLanternSconce(parts: SupportParts, x: number, y: number, z: number): void {
  parts.masonry.push(piece(new BoxGeometry(0.022, 0.022, 0.06), PALETTE.iron, x, y + 0.04, z));
  parts.glow.push(piece(new OctahedronGeometry(0.032, 0), PALETTE.lanternGlow, x, y, z + 0.02));
}

function addWindowGlow(parts: SupportParts, x: number, y: number, z: number, width: number, height: number): void {
  parts.masonry.push(piece(new BoxGeometry(width + 0.03, height + 0.03, 0.024), PALETTE.timberDark, x, y, z));
  parts.glow.push(piece(new BoxGeometry(width, height, 0.028), PALETTE.amberGlow, x, y, z + 0.004));
}
