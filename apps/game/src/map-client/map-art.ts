import type { Object3D } from "three";

import { gltfLoader } from "@/three/utils/utils";

import { TexturePixels } from "./scene-pack";
import { appendUnitModels, type KitModel } from "./unit-models";

/** How many pixels a side a building's or a unit's texture is carried at. */
const BUILDING_TEXTURE_SIZE = 256;
const UNIT_TEXTURE_SIZE = 512;

/**
 * The game's models as the map's renderer takes them, loaded once and kept: the unit models cut to their three
 * finenesses, and each building's model as it is first asked for.
 */
export class MapArt {
  private readonly buildings = new Map<string, Promise<Object3D | null>>();

  private constructor(
    readonly textures: TexturePixels,
    /** The unit models' vertices, and the records that say where each model's parts are in them. */
    readonly unitFloats: readonly number[],
    readonly units: readonly KitModel[],
  ) {}

  static async load(): Promise<MapArt> {
    // The reader's WebGL context is what tells the model loader which compressed textures the device takes.
    const textures = await TexturePixels.open(BUILDING_TEXTURE_SIZE);
    const unitFloats: number[] = [];
    const units = await appendUnitModels(unitFloats, (map) => textures.read(map, UNIT_TEXTURE_SIZE));
    return new MapArt(textures, unitFloats, units);
  }

  /** A building's model; null, said once, for one that cannot be loaded. */
  building(path: string): Promise<Object3D | null> {
    let loading = this.buildings.get(path);
    if (!loading) {
      loading = gltfLoader.loadAsync(path).then(
        (gltf) => gltf.scene,
        (reason) => {
          console.error(`The map could not load the building model ${path}`, reason);
          return null;
        },
      );
      this.buildings.set(path, loading);
    }
    return loading;
  }

  dispose(): void {
    this.textures.dispose();
  }
}
