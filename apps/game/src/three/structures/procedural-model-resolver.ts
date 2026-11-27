import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { isRealmBuildingKitPath, resolveRealmBuildingKit } from "./realm-building-kit";
import { isProceduralRealmKitPath, resolveProceduralRealmKit } from "./realm-kit";
import { isRuinKitPath, resolveProceduralRuinKit } from "./ruin-kit";

export function isProceduralModelPath(path: string): boolean {
  return isProceduralRealmKitPath(path) || isRuinKitPath(path) || isRealmBuildingKitPath(path);
}

export function resolveProceduralModel(path: string): GLTF | null {
  return resolveProceduralRuinKit(path) ?? resolveProceduralRealmKit(path) ?? resolveRealmBuildingKit(path);
}
