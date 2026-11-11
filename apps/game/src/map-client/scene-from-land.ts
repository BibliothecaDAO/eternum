import { configManager, getStructureInfoFromTileOccupier, NEUTRAL_BIOME_CLIMATE } from "@bibliothecadao/eternum";
import { StructureType } from "@bibliothecadao/types";
import { Color } from "three";

import { getGameModeConfig } from "@/config/game-modes";
import { realmModelIndex } from "@/three/structures/realm-design";
import { TerrainField } from "@/three/terrain/terrain-field";
import { prepareTerrainPage } from "@/three/terrain/terrain-page-builder";
import { TERRAIN_BIOME_DESCRIPTORS } from "@/three/terrain/terrain-palette";
import type { TerrainPageRequest } from "@/three/terrain/terrain-types";
import { worldHexToWorld } from "@/three/world-origin";

import type { Hex, Land } from "./land-from-facts";
import type { MapArt } from "./map-art";
import { placedAt, ScenePack, type PackedLight, type PackedScene, type Placement } from "./scene-pack";

/** A structure as the map draws it: the hex it stands on and what the tile says stands there. */
export interface MapStructure {
  entityId: number | null;
  hex: Hex;
  occupierType: number;
}

/** Something else that stands on a hex: a spire, a site, a chest, with the model it is drawn as. */
export interface MapLandmark {
  hex: Hex;
  path: string;
}

/** The key light of an afternoon, and the sky's and the ground's own, as a matt surface receives them. */
const LIGHT: Omit<PackedLight, "centre"> = {
  toward: [-7.9, 13, 9.7],
  colour: [0.98, 0.9, 0.76],
  sky: [0.38, 0.44, 0.54],
  ground: [0.24, 0.21, 0.18],
};
const WHITE = [1, 1, 1] as const;
const STANDS_AS_IT_IS: Placement = placedAt([0, 0, 0], 0, 1, WHITE);
/** How far over its ground a building stands, as on today's map. */
const BUILDING_LIFT = 0.025;

/**
 * The land round the camera as the map's renderer takes it: the game's own terrain for the explored tiles, each
 * structure's, spire's, site's and chest's model on its hex, the unit models and every hex. The renderer makes the land's props itself.
 */
export async function packLand(
  art: MapArt,
  land: Land,
  structures: readonly MapStructure[],
  landmarks: readonly MapLandmark[],
): Promise<PackedScene> {
  const pack = new ScenePack(art.textures, art.unitFloats);
  const request = terrainRequest(land);
  const page = prepareTerrainPage(request);
  const stands = [STANDS_AS_IT_IS];
  pack.addPlainMesh("ground", { ...page.buffers, colours: page.buffers.colors }, stands, false);
  if (page.waterBuffers) {
    pack.addPlainMesh("water", { ...page.waterBuffers, colours: page.waterBuffers.colors }, stands, false);
  }
  const standing = [
    ...structures.flatMap((structure) => {
      const path = structureModelPath(structure);
      return path ? [{ hex: structure.hex, path }] : [];
    }),
    ...landmarks,
  ];
  await addStanding(pack, art, standing, new TerrainField(request));
  const built = new Set([...structures, ...landmarks].map(({ hex }) => `${hex.col},${hex.row}`));
  const middle = centreOf(land);
  return pack.finish({
    light: { ...LIGHT, centre: [middle.x, 0, middle.z] },
    hexes: land.hexes.map((hex) => ({
      ...worldHexToWorld(hex.col, hex.row),
      biome: hex.biome,
      colour: new Color(TERRAIN_BIOME_DESCRIPTORS[hex.biome].primary).toArray() as [number, number, number],
      explored: hex.explored,
      built: built.has(`${hex.col},${hex.row}`),
    })),
    units: art.units,
  });
}

function terrainRequest(land: Land): TerrainPageRequest {
  return {
    cells: land.cells.map((cell) => ({ ...cell, explored: true, previewBiome: cell.biome })),
    climate: configManager.getBiomeClimateConfig() ?? NEUTRAL_BIOME_CLIMATE,
    halo: [],
    mapCenter: configManager.getMapCenter(),
    pageKey: "map-client",
    roadSegments: [],
    settlementAnchors: [],
    strictBiomeParity: false,
    subdivisions: 2,
  };
}

/** Each model on its hex, at the ground's height there. */
async function addStanding(
  pack: ScenePack,
  art: MapArt,
  standing: readonly MapLandmark[],
  ground: TerrainField,
): Promise<void> {
  const byModel = new Map<string, Placement[]>();
  for (const { hex, path } of standing) {
    const { x, z } = worldHexToWorld(hex.col, hex.row);
    const site: [number, number, number] = [x, ground.sampleSurface(x, z).height + BUILDING_LIFT, z];
    byModel.set(path, [...(byModel.get(path) ?? []), placedAt(site, 0, 1, WHITE)]);
  }
  for (const [path, placements] of byModel) {
    const model = await art.building(path);
    if (model) await pack.addModel("solid", model, placements);
  }
}

/**
 * The model the game's mode gives a structure of that kind and level. None for a tile that holds no structure the
 * client knows, and none for the hyperstructure, which the game builds in code and this map does not draw yet.
 */
function structureModelPath({ entityId, occupierType }: MapStructure): string | null {
  const info = getStructureInfoFromTileOccupier(occupierType);
  if (!info || info.type === StructureType.Hyperstructure) return null;
  const paths = getGameModeConfig().assets.structureModelPaths[info.type];
  const index =
    info.type === StructureType.Realm ? realmModelIndex(info.level, info.hasWonder, entityId ?? 0) : info.stage;
  return paths[Math.min(index, paths.length - 1)] ?? null;
}

function centreOf(land: Land): { x: number; z: number } {
  const explored = land.hexes.filter((hex) => hex.explored);
  const sum = explored.reduce(
    (total, hex) => {
      const at = worldHexToWorld(hex.col, hex.row);
      return { x: total.x + at.x, z: total.z + at.z };
    },
    { x: 0, z: 0 },
  );
  const count = Math.max(explored.length, 1);
  return { x: sum.x / count, z: sum.z / count };
}
