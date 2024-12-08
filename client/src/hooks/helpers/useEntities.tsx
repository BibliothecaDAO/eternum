import { type ClientComponents } from "@/dojo/createClientComponents";
import { getRealmNameById } from "@/ui/utils/realms";
import { divideByPrecision, getEntityIdFromKeys } from "@/ui/utils/utils";
import {
  CAPACITY_CONFIG_CATEGORY_STRING_MAP,
  ContractAddress,
  EntityType,
  StructureType,
  type ID,
} from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { Has, getComponentValue, type Component, type ComponentValue, type Entity } from "@dojoengine/recs";
import { useMemo } from "react";
import { shortString } from "starknet";
import { useDojo } from "../context/DojoContext";
import useUIStore from "../store/useUIStore";
import { useResourcesUtils } from "./useResources";

export type PlayerStructure = ComponentValue<ClientComponents["Structure"]["schema"]> & {
  position: ComponentValue<ClientComponents["Position"]["schema"]>;
  name: string;
  category?: string | undefined;
  owner: ComponentValue<ClientComponents["Owner"]["schema"]>;
};

type RealmWithPosition = ComponentValue<ClientComponents["Realm"]["schema"]> & {
  position: ComponentValue<ClientComponents["Position"]["schema"]>;
  name: string;
  owner: ComponentValue<ClientComponents["Owner"]["schema"]>;
};

export const useEntities = () => {
  const {
    account: { account },
    setup: {
      components: { Realm, Owner, Position, Structure },
    },
  } = useDojo();

  const isSpectatorMode = useUIStore((state) => state.isSpectatorMode);
  const address = isSpectatorMode ? ContractAddress("0x0") : ContractAddress(account.address);

  const { getEntityName } = useEntitiesUtils();

  // Get all realms
  const allRealms = useEntityQuery([Has(Realm)]);

  const filterPlayerRealms = useMemo(() => {
    return allRealms.filter((id) => {
      const owner = getComponentValue(Owner, id);
      return owner && ContractAddress(owner.address) === ContractAddress(address);
    });
  }, [allRealms, address]);

  const filterOtherRealms = useMemo(() => {
    return allRealms.filter((id) => {
      const owner = getComponentValue(Owner, id);
      return owner && ContractAddress(owner.address) !== ContractAddress(address);
    });
  }, [allRealms, address]);

  // Get all structures
  const allStructures = useEntityQuery([Has(Structure), Has(Owner)]);

  const filterPlayerStructures = useMemo(() => {
    return allStructures.filter((id) => {
      const owner = getComponentValue(Owner, id);
      return owner && ContractAddress(owner.address) === ContractAddress(address);
    });
  }, [allStructures, address]);

  const filterOtherStructures = useMemo(() => {
    return allStructures.filter((id) => {
      const owner = getComponentValue(Owner, id);
      return owner && ContractAddress(owner.address) !== ContractAddress(address);
    });
  }, [allStructures, address]);

  const playerRealms = useMemo(() => {
    return filterPlayerRealms.map((id) => {
      const realm = getComponentValue(Realm, id);
      return {
        ...realm,
        position: getComponentValue(Position, id),
        name: getRealmNameById(realm!.realm_id),
        owner: getComponentValue(Owner, id),
      } as RealmWithPosition;
    });
  }, [filterPlayerRealms]);

  const otherRealms = useMemo(() => {
    return filterOtherRealms.map((id) => {
      const realm = getComponentValue(Realm, id);
      return {
        ...realm,
        position: getComponentValue(Position, id),
        name: getRealmNameById(realm!.realm_id),
        owner: getComponentValue(Owner, id),
      } as RealmWithPosition;
    });
  }, [filterOtherRealms]);

  const playerStructures = useMemo(() => {
    return filterPlayerStructures
      .map((id) => {
        const structure = getComponentValue(Structure, id);
        if (!structure) return;

        const realm = getComponentValue(Realm, id);
        const position = getComponentValue(Position, id);

        const structureName = getEntityName(structure.entity_id);

        const name = realm
          ? getRealmNameById(realm.realm_id)
          : structureName
            ? `${structureName}`
            : structure.category || "";
        return { ...structure, position: position!, name, owner: getComponentValue(Owner, id) };
      })
      .filter((structure): structure is PlayerStructure => structure !== undefined)
      .sort((a, b) => {
        if (a.category === StructureType[StructureType.Realm]) return -1;
        if (b.category === StructureType[StructureType.Realm]) return 1;
        return a.category.localeCompare(b.category);
      });
  }, [filterPlayerStructures]);

  const otherStructures = useMemo(() => {
    return filterOtherStructures
      .map((id) => {
        const structure = getComponentValue(Structure, id);
        if (!structure || structure.category === StructureType[StructureType.Realm]) return;

        const position = getComponentValue(Position, id);

        const structureName = getEntityName(structure.entity_id);

        const name = structureName ? `${structure?.category} ${structureName}` : structure.category || "";
        return { ...structure, position: position!, name, owner: getComponentValue(Owner, id) };
      })
      .filter((structure): structure is PlayerStructure => structure !== undefined)
      .sort((a, b) => a.category.localeCompare(b.category));
  }, [filterOtherStructures]);

  const getPlayerRealms = (filterFn?: (realm: RealmWithPosition) => boolean) => {
    return useMemo(() => {
      const realms = filterFn ? playerRealms.filter(filterFn) : playerRealms;
      return realms.sort((a, b) => a.name.localeCompare(b.name));
    }, [playerRealms, filterFn]);
  };

  const getOtherRealms = (filterFn?: (realm: RealmWithPosition) => boolean) => {
    return useMemo(() => {
      return filterFn ? otherRealms.filter(filterFn) : otherRealms;
    }, [otherRealms, filterFn]);
  };

  const getPlayerStructures = (filterFn?: (structure: PlayerStructure) => boolean) => {
    return useMemo(() => {
      const structures = filterFn ? playerStructures.filter(filterFn) : playerStructures;
      return structures.sort((a, b) => a.name.localeCompare(b.name));
    }, [playerStructures, filterFn]);
  };

  const getOtherStructures = (filterFn?: (structure: PlayerStructure) => boolean) => {
    return useMemo(() => {
      return filterFn ? otherStructures.filter(filterFn) : otherStructures;
    }, [otherStructures, filterFn]);
  };

  return {
    playerRealms: getPlayerRealms,
    otherRealms: getOtherRealms,
    playerStructures: getPlayerStructures,
    otherStructures: getOtherStructures,
  };
};

export const useEntitiesUtils = () => {
  const {
    account: { account },
    setup: {
      components: {
        Army,
        EntityName,
        ArrivalTime,
        EntityOwner,
        Movable,
        CapacityCategory,
        CapacityConfig,
        Position,
        AddressName,
        Owner,
        Realm,
        Structure,
      },
    },
  } = useDojo();

  const { getResourcesFromBalance } = useResourcesUtils();

  const getEntityInfo = (entityId: ID) => {
    const entityIdBigInt = BigInt(entityId);
    const arrivalTime = getComponentValue(ArrivalTime, getEntityIdFromKeys([entityIdBigInt]));
    const movable = getComponentValue(Movable, getEntityIdFromKeys([entityIdBigInt]));

    const entityCapacityCategory = getComponentValue(CapacityCategory, getEntityIdFromKeys([entityIdBigInt]))
      ?.category as unknown as string;
    const capacityCategoryId = CAPACITY_CONFIG_CATEGORY_STRING_MAP[entityCapacityCategory] || 0n;
    const capacity = getComponentValue(CapacityConfig, getEntityIdFromKeys([BigInt(capacityCategoryId)]));

    const entityOwner = getComponentValue(EntityOwner, getEntityIdFromKeys([entityIdBigInt]));
    const owner = getComponentValue(Owner, getEntityIdFromKeys([BigInt(entityOwner?.entity_owner_id || 0)]));

    const name = getEntityName(entityId);

    const structure = getComponentValue(Structure, getEntityIdFromKeys([entityIdBigInt]));

    const resources = getResourcesFromBalance(entityId);
    const army = getComponentValue(Army, getEntityIdFromKeys([entityIdBigInt]));
    const rawIntermediateDestination = movable
      ? { x: movable.intermediate_coord_x, y: movable.intermediate_coord_y }
      : undefined;
    const intermediateDestination = rawIntermediateDestination
      ? { x: rawIntermediateDestination.x, y: rawIntermediateDestination.y }
      : undefined;

    const position = getComponentValue(Position, getEntityIdFromKeys([entityIdBigInt]));

    const homePosition = entityOwner
      ? getComponentValue(Position, getEntityIdFromKeys([BigInt(entityOwner?.entity_owner_id || 0)]))
      : undefined;

    return {
      entityId,
      arrivalTime: arrivalTime?.arrives_at,
      blocked: Boolean(movable?.blocked),
      capacity: divideByPrecision(Number(capacity?.weight_gram) || 0),
      intermediateDestination,
      position: position ? { x: position.x, y: position.y } : undefined,
      homePosition: homePosition ? { x: homePosition.x, y: homePosition.y } : undefined,
      owner: owner?.address,
      isMine: ContractAddress(owner?.address || 0n) === ContractAddress(account.address),
      isRoundTrip: movable?.round_trip || false,
      resources,
      entityType: army ? EntityType.TROOP : EntityType.DONKEY,
      structureCategory: structure?.category,
      structure,
      name,
    };
  };

  const getEntityName = (entityId: ID, abbreviate: boolean = false) => {
    const entityName = getComponentValue(EntityName, getEntityIdFromKeys([BigInt(entityId)]));
    const realm = getComponentValue(Realm, getEntityIdFromKeys([BigInt(entityId)]));
    const structure = getComponentValue(Structure, getEntityIdFromKeys([BigInt(entityId)]));

    if (structure?.category === StructureType[StructureType.Realm]) {
      return getRealmNameById(realm?.realm_id || 0);
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

  const getAddressNameFromEntity = (entityId: ID) => {
    const address = getPlayerAddressFromEntity(entityId);
    if (!address) return;

    const addressName = getComponentValue(AddressName, getEntityIdFromKeys([BigInt(address)]));

    return addressName ? shortString.decodeShortString(addressName.name.toString()) : undefined;
  };

  const getPlayerAddressFromEntity = (entityId: ID): ContractAddress | undefined => {
    const entityOwner = getComponentValue(EntityOwner, getEntityIdFromKeys([BigInt(entityId)]));
    return entityOwner?.entity_owner_id
      ? getComponentValue(Owner, getEntityIdFromKeys([BigInt(entityOwner.entity_owner_id)]))?.address
      : undefined;
  };

  return { getEntityName, getEntityInfo, getAddressNameFromEntity, getPlayerAddressFromEntity };
};
