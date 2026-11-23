import type spec from "./tripo-model-material.json";

export interface TripoPbrInput {
  roughness: number;
  metalness: number;
  hasRoughnessMap: boolean;
  hasMetalnessMap: boolean;
  hasNormalMap: boolean;
  normalScaleX: number;
  normalScaleY: number;
  hasEmissiveMap: boolean;
  emissivePeak: number;
  emissiveIntensity: number;
}

export interface TripoPbrResolved {
  doubleSided: boolean;
  roughness: number;
  metalness: number;
  normalScaleX: number | null;
  normalScaleY: number | null;
  aoMapIntensity: number;
  hasEmissiveAccent: boolean;
  emissiveIntensity: number;
}

export function resolveTripoPbr(input: TripoPbrInput, materialSpec: typeof spec): TripoPbrResolved;
