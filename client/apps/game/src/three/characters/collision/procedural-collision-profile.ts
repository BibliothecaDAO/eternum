import type { ProceduralUnitKind } from "../procedural-unit-config";

export interface ProceduralCollisionBudget {
  maxActivePresentationBodies: number;
  maxActiveRagdolls: number;
  maxPairResolutions: number;
}

export interface ProceduralCollisionProxy {
  forwardOffset: number;
  lateralOffset: number;
  radius: number;
}

export interface ProceduralCollisionProfile {
  mass: number;
  maxVisualOffset: number;
  proxies: readonly ProceduralCollisionProxy[];
  restitution: number;
  returnHalfLifeSeconds: number;
  tangentialDamping: number;
}

const FOOT_PROFILES: Readonly<
  Record<"archer" | "crossbowman" | "knight", Omit<ProceduralCollisionProfile, "proxies">>
> = {
  archer: createBodyProfile(0.9, 0.18, 0.04, 0.18, 0.3),
  crossbowman: createBodyProfile(1, 0.18, 0.035, 0.19, 0.3),
  knight: createBodyProfile(1.25, 0.18, 0.03, 0.2, 0.28),
};

export function createProceduralCollisionProfile(kind: ProceduralUnitKind, worldScale = 1): ProceduralCollisionProfile {
  const scale = normalizeScale(worldScale);
  if (kind === "boat") {
    return {
      ...createBodyProfile(12, 0.16, 0.015, 0.32, 0.16),
      maxVisualOffset: 0.16 * scale,
      proxies: [
        { forwardOffset: -0.78 * scale, lateralOffset: 0, radius: 0.48 * scale },
        { forwardOffset: 0, lateralOffset: 0, radius: 0.54 * scale },
        { forwardOffset: 0.78 * scale, lateralOffset: 0, radius: 0.48 * scale },
      ],
    };
  }
  if (kind === "horse") {
    return {
      ...createBodyProfile(4.5, 0.2, 0.02, 0.24, 0.2),
      maxVisualOffset: 0.2 * scale,
      proxies: createMountedProxies(scale, 0.34, 0.35),
    };
  }
  if (kind === "paladin") {
    return {
      ...createBodyProfile(5.5, 0.2, 0.02, 0.26, 0.18),
      maxVisualOffset: 0.2 * scale,
      proxies: createMountedProxies(scale, 0.38, 0.36),
    };
  }
  return {
    ...FOOT_PROFILES[kind],
    maxVisualOffset: FOOT_PROFILES[kind].maxVisualOffset * scale,
    proxies: [{ forwardOffset: 0, lateralOffset: 0, radius: 0.32 * scale }],
  };
}

export function createProceduralCollisionBudget(mode: "battery" | "benchmark" | "quality"): ProceduralCollisionBudget {
  if (mode === "battery") {
    return { maxActivePresentationBodies: 64, maxActiveRagdolls: 4, maxPairResolutions: 512 };
  }
  if (mode === "benchmark") {
    return { maxActivePresentationBodies: 100, maxActiveRagdolls: 8, maxPairResolutions: 2_048 };
  }
  return { maxActivePresentationBodies: 128, maxActiveRagdolls: 8, maxPairResolutions: 1_024 };
}

function createBodyProfile(
  mass: number,
  maxVisualOffset: number,
  restitution: number,
  returnHalfLifeSeconds: number,
  tangentialDamping: number,
): Omit<ProceduralCollisionProfile, "proxies"> {
  return { mass, maxVisualOffset, restitution, returnHalfLifeSeconds, tangentialDamping };
}

function createMountedProxies(
  scale: number,
  radius: number,
  forwardOffset: number,
): readonly ProceduralCollisionProxy[] {
  return [
    { forwardOffset: -forwardOffset * scale, lateralOffset: 0, radius: radius * scale },
    { forwardOffset: forwardOffset * scale, lateralOffset: 0, radius: radius * scale },
  ];
}

function normalizeScale(value: number): number {
  return Number.isFinite(value) ? Math.min(4, Math.max(0.05, Math.abs(value))) : 1;
}
