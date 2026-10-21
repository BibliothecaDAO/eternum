import { ContractAddress, GuardSlot, ID, StructureType, Troops } from "@bibliothecadao/types";

export enum TargetType {
  Structure,
  Army,
}

export interface AttackTarget {
  info: Troops[];
  id: ID;
  targetType: TargetType;
  structureCategory: StructureType | null;
  structureLevel?: number | null;
  /** The structure's guard slots (structureGuardSlots); none for an army. */
  guardSlots?: GuardSlot[];
  hex: { x: number; y: number };
  addressOwner: ContractAddress | null;
}
