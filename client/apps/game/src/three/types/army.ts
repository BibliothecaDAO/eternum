import { TroopTier, TroopType } from "@bibliothecadao/types";
import {
  Vector3,
  Euler,
  Color,
  CatmullRomCurve3,
  InstancedMesh,
  Group,
  Mesh,
  AnimationMixer,
  AnimationClip,
  AnimationAction,
} from "three";
import { EasingType } from "../utils/easing";

export interface MovementData {
  startPos: Vector3;
  endPos: Vector3;
  progress: number;
  matrixIndex: number;
  currentPathIndex: number;
  floatingHeight: number;
  currentRotation: number;
  targetRotation: number;
}

export interface SplineMovementData {
  spline: CatmullRomCurve3;
  totalLength: number;
  journeyProgress: number;
  matrixIndex: number;
  floatingHeight: number;
  currentRotation: number;
  easingType: EasingType;
  // Anticipation + Overshoot
  anticipationTimer: number;
  settlementTimer: number;
  isAnticipating: boolean;
  isSettling: boolean;
  finalTangent: Vector3 | null;
  // Terrain speed
  currentSpeedMultiplier: number;
  // Rhythmic bob + arrival slam
  elapsedTime: number;
  arrivalSlamTimer: number;
  isArrivalSlamming: boolean;
}

export interface ArmyInstanceData {
  entityId: number;
  position: Vector3;
  scale: Vector3;
  rotation?: Euler;
  color?: Color;
  isMoving: boolean;
  matrixIndex?: number;
  path?: Vector3[];
  category?: TroopType;
  tier?: TroopTier;
}

export enum ModelType {
  Boat = "boat",
  Knight1 = "knight1",
  Knight2 = "knight2",
  Knight3 = "knight3",
  Crossbowman1 = "crossbowman1",
  Crossbowman2 = "crossbowman2",
  Crossbowman3 = "crossbowman3",
  Paladin1 = "paladin1",
  Paladin2 = "paladin2",
  Paladin3 = "paladin3",
  AgentApix = "apix",
  AgentElisa = "elisa",
  AgentIstarai = "istarai",
  AgentYP = "ypanther",
}

export interface AnimatedInstancedMesh extends InstancedMesh {
  animated?: boolean;
}

export interface ModelData {
  group: Group;
  sourceScene: Object3D;
  instancedMeshes: AnimatedInstancedMesh[];
  contactShadowMesh?: InstancedMesh;
  contactShadowScale?: number;
  baseMeshes: Mesh[];
  mixer: AnimationMixer;
  animations: {
    idle: AnimationClip;
    moving: AnimationClip;
  };
  animationActions: Map<
    number,
    {
      idle: AnimationAction;
      moving: AnimationAction;
    }
  >;
  activeInstances: Set<number>;
  targetScales: Map<number, Vector3>;
  currentScales: Map<number, Vector3>;
  lastAnimationUpdate: number;
  animationUpdateInterval: number;
}
