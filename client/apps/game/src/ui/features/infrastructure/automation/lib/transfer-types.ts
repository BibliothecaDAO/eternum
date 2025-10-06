import type { ContractAddress, ID, ResourcesIds, StructureType } from "@bibliothecadao/types";

export interface EntityIdFormat {
  entityId: ID;
  realmId: ID;
  category: StructureType;
  owner: ContractAddress;
}

export interface TransferEntityOption extends EntityIdFormat {
  name: string;
  accountName?: string;
}

export interface SelectedEntity {
  name: string;
  entityId: ID;
  category: StructureType;
}

export interface SelectedResource {
  resourceId: ResourcesIds;
  amount: number;
}

export interface EntityTypeOption {
  value: string;
  label: string;
}

export interface ResourceBalance {
  id: ResourcesIds;
  trait: string;
  balance: number;
}
