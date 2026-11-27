import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { isProceduralOutpostKitPath, resolveProceduralOutpostKit } from "./outpost-kit";
import { isRealmBuildingKitPath, resolveRealmBuildingKit } from "./realm-building-kit";
import { isProceduralRealmKitPath, resolveProceduralRealmKit } from "./realm-kit";
import { isRealmSupportKitPath, resolveProceduralRealmSupportKit } from "./realm-support-kit";
import { isRuinKitPath, resolveProceduralRuinKit } from "./ruin-kit";
import { isWellShrineKitPath, resolveProceduralWellShrineKit } from "./well-shrine-kit";

export function isProceduralModelPath(path: string): boolean {
  return (
    isProceduralRealmKitPath(path) ||
    isRuinKitPath(path) ||
    isRealmBuildingKitPath(path) ||
    isRealmSupportKitPath(path) ||
    isWellShrineKitPath(path) ||
    isProceduralOutpostKitPath(path)
  );
}

export function resolveProceduralModel(path: string): GLTF | null {
  return (
    resolveProceduralRuinKit(path) ??
    resolveProceduralRealmKit(path) ??
    resolveRealmBuildingKit(path) ??
    resolveProceduralRealmSupportKit(path) ??
    resolveProceduralWellShrineKit(path) ??
    resolveProceduralOutpostKit(path)
  );
}
