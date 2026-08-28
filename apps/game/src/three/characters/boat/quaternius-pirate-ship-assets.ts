import { Group, Mesh } from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";

import { disposeSkinnedSceneTemplates } from "../skinned-asset-resources";

export interface LoadedQuaterniusPirateShipAsset {
  animations: readonly unknown[];
  label: string;
  scene: Group;
  url: string;
}

export const QUATERNIUS_PIRATE_SHIP_ASSET = {
  id: "quaternius-pirate-ship-large",
  label: "Quaternius Pirate Ship Large",
  sourceForward: "-x",
  targetLength: 3.6,
  url: "/models/boats/quaternius-pirate/ship-large.glb",
  waterlineY: 0,
  yawRadians: Math.PI / 2,
} as const;

export const QUATERNIUS_PIRATE_SHIP_MUZZLES = {
  port: [
    [-0.52, 0.34, -0.82],
    [-0.55, 0.34, -0.32],
    [-0.56, 0.34, 0.18],
    [-0.52, 0.34, 0.68],
    [-0.45, 0.74, -0.46],
    [-0.45, 0.74, 0.33],
  ],
  starboard: [
    [0.52, 0.34, -0.82],
    [0.55, 0.34, -0.32],
    [0.56, 0.34, 0.18],
    [0.52, 0.34, 0.68],
    [0.45, 0.74, -0.46],
    [0.45, 0.74, 0.33],
  ],
} as const satisfies Readonly<Record<"port" | "starboard", readonly (readonly [number, number, number])[]>>;

export class QuaterniusPirateShipLibrary {
  private disposed = false;

  private constructor(private readonly gltf: GLTF) {}

  public static async load(): Promise<QuaterniusPirateShipLibrary> {
    const gltf = await new GLTFLoader().loadAsync(QUATERNIUS_PIRATE_SHIP_ASSET.url);
    try {
      validateQuaterniusPirateShip(gltf);
      return new QuaterniusPirateShipLibrary(gltf);
    } catch (error) {
      disposeSkinnedSceneTemplates([gltf.scene]);
      throw error;
    }
  }

  public instantiate(): LoadedQuaterniusPirateShipAsset {
    if (this.disposed) throw new Error("Cannot instantiate a disposed Quaternius pirate ship library");
    return {
      animations: this.gltf.animations,
      label: QUATERNIUS_PIRATE_SHIP_ASSET.label,
      scene: this.gltf.scene.clone(true),
      url: QUATERNIUS_PIRATE_SHIP_ASSET.url,
    };
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    disposeSkinnedSceneTemplates([this.gltf.scene]);
  }
}

function validateQuaterniusPirateShip(gltf: GLTF): void {
  let meshCount = 0;
  gltf.scene.traverse((object) => {
    if (object instanceof Mesh) meshCount += 1;
  });
  if (meshCount === 0) throw new Error("Quaternius pirate ship does not contain a render mesh");
  if (gltf.animations.length !== 0) {
    throw new Error("Quaternius pirate ship unexpectedly contains authored animation clips");
  }
}
