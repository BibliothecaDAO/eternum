import { TroopTier, TroopType } from "@bibliothecadao/types";
import * as THREE from "three";
import { AnimationMixer } from "three";

export interface MovementData {
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  progress: number;
  matrixIndex: number;
  currentPathIndex: number;
  floatingHeight: number;
  currentRotation: number;
  targetRotation: number;
}

export interface ArmyInstanceData {
  entityId: number;
  position: THREE.Vector3;
  scale: THREE.Vector3;
  rotation?: THREE.Euler;
  color?: THREE.Color;
  isMoving: boolean;
  path?: THREE.Vector3[];
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
}

export interface AnimatedInstancedMesh extends THREE.InstancedMesh {
  animated?: boolean;
}

export interface ModelData {
  group: THREE.Group;
  instancedMeshes: AnimatedInstancedMesh[];
  baseMeshes: THREE.Mesh[];
  mixer: AnimationMixer;
  animations: {
    idle: THREE.AnimationClip;
    moving: THREE.AnimationClip;
  };
  animationActions: Map<
    number,
    {
      idle: THREE.AnimationAction;
      moving: THREE.AnimationAction;
    }
  >;
  activeInstances: Set<number>;
  targetScales: Map<number, THREE.Vector3>;
  currentScales: Map<number, THREE.Vector3>;
}
