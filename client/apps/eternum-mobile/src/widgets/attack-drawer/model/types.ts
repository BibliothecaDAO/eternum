import { ContractAddress, ID, StructureType, Troops } from "@bibliothecadao/types";

export enum TargetType {
  Structure,
  Army,
}

export type AttackTarget = {
  info: Troops[];
  id: ID;
  targetType: TargetType;
  structureCategory: StructureType | null;
  hex: { x: number; y: number };
  addressOwner: ContractAddress | null;
};

export interface AttackDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attackerEntityId: ID;
  targetHex: { x: number; y: number };
}

export interface AttackDrawerData {
  attackerEntityId: ID | null;
  targetHex: { x: number; y: number } | null;
}