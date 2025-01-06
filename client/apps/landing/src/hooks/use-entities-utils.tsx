import { ID, StructureType } from "@bibliothecadao/eternum";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { shortString } from "starknet";
import { useDojo } from "./context/DojoContext";

export const useEntitiesUtils = () => {
  const {
    setup: {
      components: { EntityName, Structure },
    },
  } = useDojo();

  const getEntityName = (entityId: ID, abbreviate: boolean = false) => {
    const entityName = getComponentValue(EntityName, getEntityIdFromKeys([BigInt(entityId)]));
    const structure = getComponentValue(Structure, getEntityIdFromKeys([BigInt(entityId)]));

    if (structure?.category === StructureType[StructureType.Realm]) {
      // if realm is needed at some point we can add it here
      return "realm";
    } else if (entityName) {
      return shortString.decodeShortString(entityName.name.toString());
    } else {
      if (abbreviate) {
        if (structure?.category === StructureType[StructureType.FragmentMine]) {
          return `FM ${structure.entity_id}`;
        } else if (structure?.category === StructureType[StructureType.Hyperstructure]) {
          return `HS ${structure.entity_id}`;
        } else if (structure?.category === StructureType[StructureType.Bank]) {
          return `BK ${structure.entity_id}`;
        }
      }
      return `${structure?.category} ${structure?.entity_id}`;
    }
  };

  return { getEntityName };
};
