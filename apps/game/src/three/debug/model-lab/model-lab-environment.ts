import { NEUTRAL_BIOME_CLIMATE } from "@bibliothecadao/eternum";
import { BiomeType } from "@bibliothecadao/types";
import { AmbientLight, DirectionalLight, Fog, HemisphereLight, Scene, Vector3 } from "three";
import { WorldAtmosphereController } from "../../effects/world-atmosphere-controller";
import { configureWorldSunShadows } from "../../effects/world-sun-shadows";
import { ProceduralTerrain } from "../../terrain/procedural-terrain";
import { terrainHexToWorld } from "../../terrain/terrain-coordinates";
import type { TerrainCellInput, TerrainPageRequest } from "../../terrain/terrain-types";
import type { ModelLabSettings } from "./model-lab-settings";

export const MODEL_LAB_BIOMES = {
  grassland: { label: "Grassland coast", biome: BiomeType.Grassland },
  forest: { label: "Temperate forest", biome: BiomeType.TemperateDeciduousForest },
  desert: { label: "Desert coast", biome: BiomeType.SubtropicalDesert },
  snow: { label: "Snow coast", biome: BiomeType.Snow },
  tropical: { label: "Tropical forest", biome: BiomeType.TropicalRainForest },
} as const;

export function createModelLabTerrainRequest(settings: Pick<ModelLabSettings, "biome" | "family">): TerrainPageRequest {
  const cells: TerrainCellInput[] = [];
  const halo: TerrainCellInput[] = [];
  for (let row = -14; row <= 14; row++) {
    for (let col = -14; col <= 14; col++) {
      const naval = settings.family === "ships";
      const biome =
        naval && row < 3
          ? row < -3
            ? BiomeType.DeepOcean
            : BiomeType.Ocean
          : naval && row < 5
            ? BiomeType.Beach
            : MODEL_LAB_BIOMES[settings.biome].biome;
      const cell = { col, row, biome, previewBiome: biome, explored: true, occupied: false };
      (Math.abs(row) <= 12 && Math.abs(col) <= 12 ? cells : halo).push(cell);
    }
  }
  return {
    cells,
    halo,
    climate: { ...NEUTRAL_BIOME_CLIMATE, elevation_seed: 137, moisture_seed: 991 },
    mapCenter: 0,
    pageKey: `model-lab:${settings.family === "ships" ? "coast" : "land"}:${settings.biome}`,
    roadSegments: [],
    settlementAnchors: [],
  };
}

export class ModelLabEnvironment {
  readonly terrain = new ProceduralTerrain();
  private readonly atmosphere: WorldAtmosphereController;
  private readonly sun = new DirectionalLight();
  private readonly ambient = new AmbientLight();
  private readonly hemisphere = new HemisphereLight();
  private assets: Promise<void> | null = null;
  private signature = "";
  private generation = 0;
  private disposed = false;

  constructor(scene: Scene) {
    configureWorldSunShadows(this.sun, true, 2048);
    scene.add(this.terrain.object3d, this.sun, this.sun.target, this.ambient, this.hemisphere);
    this.atmosphere = new WorldAtmosphereController(scene, this.sun, this.hemisphere, this.ambient, new Fog(0x819997));
    this.terrain.setQualityTier("detail");
    this.terrain.setGroundTextureDetailEnabled(true);
  }

  async update(settings: ModelLabSettings): Promise<void> {
    const signature = `${settings.family === "ships"}:${settings.biome}`;
    const generation = ++this.generation;
    if (signature === this.signature) return;
    this.assets ??= Promise.all([this.terrain.loadProps(), this.terrain.loadGroundTextures()]).then(() => undefined);
    await this.assets;
    if (this.disposed || generation !== this.generation) return;
    const page = await this.terrain.preparePageAsync(createModelLabTerrainRequest(settings));
    if (this.disposed || generation !== this.generation) return;
    const fog = await this.terrain.prepareFogMaskAsync([page]);
    if (this.disposed || generation !== this.generation) return;
    this.terrain.present([page], fog);
    // Filter vegetation without marking cells occupied: occupancy also disturbs the ground texture.
    this.terrain.refreshPropOccupancy((col, row) => {
      const { x, z } = terrainHexToWorld(col, row);
      return Math.abs(x) < 8 && (settings.family === "ships" ? z < 9 : Math.abs(z) < 4);
    });
    this.signature = signature;
  }

  frame(delta: number, target: Vector3, lighting: ModelLabSettings["lighting"]): void {
    this.terrain.update(delta);
    this.atmosphere.update(lighting === "sunset" ? 65 : 42, target, { snap: true, environment: "world" });
  }

  dispose(): void {
    this.disposed = true;
    this.generation++;
    this.terrain.dispose();
    this.terrain.object3d.removeFromParent();
    this.atmosphere.dispose();
    this.sun.shadow.dispose();
    [this.sun, this.sun.target, this.ambient, this.hemisphere].forEach((light) => light.removeFromParent());
  }
}
