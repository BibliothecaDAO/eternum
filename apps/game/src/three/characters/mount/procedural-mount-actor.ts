import type { Group } from "three";

import type { ProceduralUnitImpact, ProceduralUnitReactionInput } from "../collision/procedural-impact";
import type { JoltRagdollStats } from "../jolt-ragdoll-world";
import type { ProceduralUnitConfig } from "../procedural-unit-config";
import type { QuaternionTuple, Vector3Tuple } from "../procedural-character-pose";
import type { ProceduralHorsePoseDiagnostics } from "../horse/procedural-horse-diagnostics";
import type { HorseGroundSampler } from "../horse/procedural-horse-pose";
import type { ProceduralDragonPoseDiagnostics } from "../dragon/procedural-dragon-runtime";

export type ProceduralMountKind = "dragon" | "horse";
export type ProceduralMountMode = "animated" | "ragdoll";
export type ProceduralMountTerrainSampler = HorseGroundSampler;

export interface ProceduralMountPose {
  actionOriginPosition?: Vector3Tuple;
  actionOriginRotation?: QuaternionTuple;
  phase: number;
  saddlePosition: Vector3Tuple;
  saddleRotation: QuaternionTuple;
}

export interface ProceduralMountStats extends JoltRagdollStats {
  appearanceId: string;
  appearanceLabel: string;
  assetId: string;
  assetLabel: string;
  authoredClipCount: number;
  boneCount: number;
  contactCount: number;
  kind: ProceduralMountKind;
  maximumBoneStretchRatio: number;
  minimumBendAlignment: number;
  rigAdapterId: string;
  skinnedMeshCount: number;
}

export type ProceduralMountPoseDiagnostics =
  | { horse: ProceduralHorsePoseDiagnostics; kind: "horse" }
  | { dragon: ProceduralDragonPoseDiagnostics; kind: "dragon" };

/** Mounted-creature lifecycle consumed by the rider composition. */
export interface ProceduralMountActor {
  readonly kind: ProceduralMountKind;
  readonly mode: ProceduralMountMode;
  readonly object: Group;

  applyImpact(impact: ProceduralUnitImpact): Promise<void>;
  applyImpulse(): Promise<void>;
  applyReaction(reaction: ProceduralUnitReactionInput): void;
  dispose(): void;
  getPose(): ProceduralMountPose;
  getPoseDiagnostics(): ProceduralMountPoseDiagnostics;
  getStats(): ProceduralMountStats;
  hasFiniteState(): boolean;
  reset(): void;
  setTerrainSampler(sampleTerrain?: ProceduralMountTerrainSampler): void;
  startRagdoll(): Promise<void>;
  stepOnce(): void;
  update(deltaSeconds: number): void;
  updateConfig(config: ProceduralUnitConfig): void;
}
