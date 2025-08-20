import { TroopTier, TroopType } from "@bibliothecadao/types";
import { 
  Vector3, 
  Euler, 
  Color, 
  InstancedMesh, 
  Group, 
  Mesh, 
  AnimationMixer, 
  AnimationClip, 
  AnimationAction 
} from "three";

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

export interface ArmyInstanceData {
  entityId: number;
  position: Vector3;
  scale: Vector3;
  rotation?: Euler;
  color?: Color;
  isMoving: boolean;
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
  instancedMeshes: AnimatedInstancedMesh[];
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
}
