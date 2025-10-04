import {
  getStructureTypeName,
  getEntityNameFromLocalStorage,
  getRealmNameById,
  getAddressName,
  isMilitaryResource,
} from "@bibliothecadao/eternum";
import type { Structure } from "@bibliothecadao/types";
import { ResourcesIds, StructureType } from "@bibliothecadao/types";

import type { EntityIdFormat, TransferEntityOption } from "./transfer-types";

export const isTransferAllowed = (
  sourceCategory: StructureType,
  destinationCategory: StructureType,
  resourceId: ResourcesIds,
): boolean => {
  if (isMilitaryResource(resourceId)) {
    return sourceCategory === StructureType.Realm && destinationCategory === StructureType.Realm;
  }
  return true;
};

export const mapStructureToEntity = (structure: Structure): EntityIdFormat => ({
  entityId: structure.entityId,
  realmId: structure.structure.metadata.realm_id,
  category: structure.structure.base.category,
  owner: structure.structure.owner,
});

export const withEntityDisplayData = (
  entity: EntityIdFormat,
  components: unknown,
  isBlitz: boolean,
): TransferEntityOption => {
  const entityName =
    getEntityNameFromLocalStorage(entity.entityId) ||
    (entity.realmId ? getRealmNameById(entity.realmId) : `${getStructureTypeName(entity.category, isBlitz)} ${entity.entityId}`);

  return {
    ...entity,
    name: entityName,
    accountName: getAddressName(entity.owner, components),
  };
};
