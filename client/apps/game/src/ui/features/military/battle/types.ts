import { ContractAddress, ID, StructureType, Troops } from "@bibliothecadao/types";

export enum TargetType {
  Structure,
  Army,
}

export interface AttackTarget {
  info: Troops[];
  id: ID;
  targetType: TargetType;
  structureCategory: StructureType | null;
  hex: { x: number; y: number };
  addressOwner: ContractAddress | null;
}
