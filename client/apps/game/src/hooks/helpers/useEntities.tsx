import { type ClientComponents } from "@/dojo/createClientComponents";
import { getRealmName, getRealmNameById } from "@/ui/utils/realms";
import { divideByPrecision, getEntityIdFromKeys } from "@/ui/utils/utils";
import {
  CAPACITY_CONFIG_CATEGORY_STRING_MAP,
  ContractAddress,
  EntityType,
  StructureType,
  type ID,
} from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { Has, HasValue, getComponentValue, type ComponentValue } from "@dojoengine/recs";
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

export type RealmWithPosition = ComponentValue<ClientComponents["Realm"]["schema"]> & {
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
  const playerRealmsQuery = useEntityQuery([Has(Realm), HasValue(Owner, { address: address })]);

  // Get all structures
  const playerStructuresQuery = useEntityQuery([
    Has(Structure),
    Has(Position),
    Has(Owner),
    HasValue(Owner, { address: address }),
  ]);

  const playerRealms = useMemo(() => {
    return playerRealmsQuery.map((id) => {
      const realm = getComponentValue(Realm, id);
      return {
        ...realm,
        position: getComponentValue(Position, id),
        name: getRealmNameById(realm!.realm_id),
        owner: getComponentValue(Owner, id),
      } as RealmWithPosition;
    });
  }, [playerRealmsQuery]);

  const playerStructures = useMemo(() => {
    return playerStructuresQuery
      .map((id) => {
        const structure = getComponentValue(Structure, id);
        if (!structure) return;

        const realm = getComponentValue(Realm, id);
        const position = getComponentValue(Position, id);

        const structureName = getEntityName(structure.entity_id);

        const name = realm ? getRealmName(realm) : structureName || structure.category || "";

        return { ...structure, position: position!, name, owner: getComponentValue(Owner, id) };
      })
      .filter((structure): structure is PlayerStructure => structure !== undefined)
      .sort((a, b) => {
        if (a.category === StructureType[StructureType.Realm]) return -1;
        if (b.category === StructureType[StructureType.Realm]) return 1;
        return a.category.localeCompare(b.category);
      });
  }, [playerStructuresQuery]);

  const getPlayerRealms = (filterFn?: (realm: RealmWithPosition) => boolean) => {
    return useMemo(() => {
      const realms = filterFn ? playerRealms.filter(filterFn) : playerRealms;
      return realms.sort((a, b) => a.name.localeCompare(b.name));
    }, [playerRealms, filterFn]);
  };

  const getPlayerStructures = (filterFn?: (structure: PlayerStructure) => boolean) => {
    return useMemo(() => {
      const structures = filterFn ? playerStructures.filter(filterFn) : playerStructures;
      return structures.sort((a, b) => a.name.localeCompare(b.name));
    }, [playerStructures, filterFn]);
  };

  return {
    playerRealms: getPlayerRealms,
    playerStructures: getPlayerStructures,
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
    if (structure?.category === StructureType[StructureType.Realm] && realm) {
      return getRealmName(realm);
    }

    if (entityName) {
      return shortString.decodeShortString(entityName.name.toString());
    }

    if (abbreviate && structure) {
      const abbreviations: Record<string, string> = {
        [StructureType[StructureType.FragmentMine]]: "FM",
        [StructureType[StructureType.Hyperstructure]]: "HS",
        [StructureType[StructureType.Bank]]: "BK",
      };

      const abbr = abbreviations[structure.category];
      if (abbr) {
        return `${abbr} ${structure.entity_id}`;
      }
    }
    return `${structure?.category} ${structure?.entity_id}`;
  };

  const getAddressName = (address: ContractAddress) => {
    const addressName = getComponentValue(AddressName, getEntityIdFromKeys([BigInt(address)]));

    return addressName ? shortString.decodeShortString(addressName.name.toString()) : undefined;
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

  return { getEntityName, getEntityInfo, getAddressName, getAddressNameFromEntity, getPlayerAddressFromEntity };
};
