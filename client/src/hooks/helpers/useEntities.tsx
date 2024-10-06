import { type ClientComponents } from "@/dojo/createClientComponents";
import { getRealmNameById } from "@/ui/utils/realms";
import { divideByPrecision, getEntityIdFromKeys, getPosition } from "@/ui/utils/utils";
import {
  CAPACITY_CONFIG_CATEGORY_STRING_MAP,
  ContractAddress,
  EntityType,
  StructureType,
  type ID,
} from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import {
  Has,
  HasValue,
  NotValue,
  getComponentValue,
  runQuery,
  type Component,
  type ComponentValue,
  type Entity,
} from "@dojoengine/recs";
import { useMemo } from "react";
import { shortString } from "starknet";
import { useDojo } from "../context/DojoContext";
import { getResourcesUtils } from "./useResources";

export type PlayerStructure = ComponentValue<ClientComponents["Structure"]["schema"]> & {
  position: ComponentValue<ClientComponents["Position"]["schema"]>;
  name: string;
  category?: string | undefined;
};

export const useEntities = () => {
  const {
    account: { account },
    setup: {
      components: { Realm, Owner, Position, Structure },
    },
  } = useDojo();

  const { getEntityName } = getEntitiesUtils();

  const playerRealms = useEntityQuery([Has(Realm), HasValue(Owner, { address: ContractAddress(account.address) })]);
  const otherRealms = useEntityQuery([Has(Realm), NotValue(Owner, { address: ContractAddress(account.address) })]);
  const playerStructures = useEntityQuery([
    Has(Structure),
    HasValue(Owner, { address: ContractAddress(account.address) }),
  ]);

  const memoizedPlayerRealms = useMemo(() => {
    return playerRealms.map((id) => {
      const realm = getComponentValue(Realm, id);
      return { ...realm, position: getPosition(realm!.realm_id), name: getRealmNameById(realm!.realm_id) };
    });
  }, [playerRealms]);

  const memoizedOtherRealms = useMemo(() => {
    return otherRealms.map((id) => {
      const realm = getComponentValue(Realm, id);
      return { ...realm, position: getPosition(realm!.realm_id), name: getRealmNameById(realm!.realm_id) };
    });
  }, [otherRealms]);

  const memoizedPlayerStructures = useMemo(() => {
    return playerStructures
      .map((id) => {
        const structure = getComponentValue(Structure, id);
        if (!structure) return;

        const realm = getComponentValue(Realm, id);
        const position = getComponentValue(Position, id);

        const structureName = getEntityName(structure.entity_id);

        const name = realm
          ? getRealmNameById(realm.realm_id)
          : structureName
          ? `${structure?.category} ${structureName}`
          : structure.category || "";
        return { ...structure, position: position!, name };
      })
      .filter((structure): structure is PlayerStructure => structure !== undefined)
      .sort((a, b) => {
        if (a.category === StructureType[StructureType.Realm]) return -1;
        if (b.category === StructureType[StructureType.Realm]) return 1;
        return a.category.localeCompare(b.category);
      });
  }, [playerStructures]);

  return {
    playerRealms: () => memoizedPlayerRealms,
    otherRealms: () => memoizedOtherRealms,
    playerStructures: () => memoizedPlayerStructures,
  };
};

export const getPlayerStructures = () => {
  const {
    setup: {
      components: { Structure, Owner, Realm, Position },
    },
  } = useDojo();
  const { getEntityName } = getEntitiesUtils();

  const getStructures = (playerAddress: ContractAddress) => {
    const playerStructures = runQuery([Has(Structure), HasValue(Owner, { address: playerAddress })]);
    return formatStructures(Array.from(playerStructures), Structure, Realm, Position, getEntityName);
  };

  return getStructures;
};

export const getEntitiesUtils = () => {
  const {
    account: { account },
    setup: {
      components: {
        EntityName,
        ArrivalTime,
        EntityOwner,
        Movable,
        CapacityCategory,
        CapacityConfig,
        Position,
        Army,
        AddressName,
        Owner,
        Realm,
        Structure,
      },
    },
  } = useDojo();

  const { getResourcesFromBalance } = getResourcesUtils();

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
    return getStructureName(entityName, structure, realm, abbreviate);
  };

  const getAddressNameFromEntity = (entityId: ID) => {
    const address = getPlayerAddressFromEntity(entityId);
    if (!address) return;

    const addressName = getComponentValue(AddressName, getEntityIdFromKeys([BigInt(address)]));

    return addressName ? shortString.decodeShortString(addressName.name.toString()) : undefined;
  };

  const getPlayerAddressFromEntity = (entityId: ID) => {
    const entityOwner = getComponentValue(EntityOwner, getEntityIdFromKeys([BigInt(entityId)]));
    return entityOwner?.entity_owner_id
      ? getComponentValue(Owner, getEntityIdFromKeys([BigInt(entityOwner.entity_owner_id)]))?.address
      : undefined;
  };

  return { getEntityName, getEntityInfo, getAddressNameFromEntity, getPlayerAddressFromEntity };
};

export const useGetAllPlayers = () => {
  const {
    account: { account },
    setup: {
      components: { Owner, Realm },
    },
  } = useDojo();

  const { getAddressNameFromEntity } = getEntitiesUtils();

  const playersEntityIds = runQuery([
    Has(Owner),
    Has(Realm),
    NotValue(Owner, { address: ContractAddress(account.address) }),
  ]);

  const getPlayers = () => {
    const players = getAddressNameFromEntityIds(Array.from(playersEntityIds), Owner, getAddressNameFromEntity);

    const uniquePlayers = Array.from(new Map(players.map((player) => [player.address, player])).values());

    return uniquePlayers;
  };

  return getPlayers;
};

export const getAddressNameFromEntityIds = (
  entityId: Entity[],
  Owner: Component<ClientComponents["Owner"]["schema"]>,
  getAddressNameFromEntity: (entityId: ID) => string | undefined,
) => {
  return Array.from(entityId)
    .map((id) => {
      const owner = getComponentValue(Owner, id);
      if (!owner) return;

      const addressName = getAddressNameFromEntity(owner?.entity_id);
      if (!addressName) return;
      return { ...owner, addressName };
    })
    .filter(
      (owner): owner is ComponentValue<ClientComponents["Owner"]["schema"]> & { addressName: string } =>
        owner !== undefined,
    );
};

const formatStructures = (
  structures: Entity[],
  Structure: Component<ClientComponents["Structure"]["schema"]>,
  Realm: Component<ClientComponents["Realm"]["schema"]>,
  Position: Component<ClientComponents["Position"]["schema"]>,
  getEntityName: (entityId: ID) => string | undefined,
) => {
  return structures
    .map((id) => {
      const structure = getComponentValue(Structure, id);
      if (!structure) return;

      const realm = getComponentValue(Realm, id);
      const position = getComponentValue(Position, id);

      const structureName = getEntityName(structure.entity_id);

      const name = realm
        ? getRealmNameById(realm.realm_id)
        : structureName
        ? `${structure?.category} ${structureName}`
        : structure.category || "";
      return { ...structure, position: position!, name };
    })
    .filter((structure): structure is PlayerStructure => structure !== undefined)
    .sort((a, b) => (b.category || "").localeCompare(a.category || ""));
};

const getStructureName = (
  entityName: ComponentValue<ClientComponents["EntityName"]["schema"]> | undefined,
  structure: ComponentValue<ClientComponents["Structure"]["schema"]> | undefined,
  realm: ComponentValue<ClientComponents["Realm"]["schema"]> | undefined,
  abbreviate: boolean = false,
) => {
  if (!structure) return "Unknown";

  let name = "";
  if (structure.category === StructureType[StructureType.Realm]) {
    name = getRealmNameById(realm!.realm_id);
  } else if (entityName) {
    name = shortString.decodeShortString(entityName.name.toString());
  } else {
    name = `${structure.category} ${structure.entity_id}`;

    if (abbreviate) {
      if (structure.category === StructureType[StructureType.FragmentMine]) {
        name = `FM ${structure.entity_id}`;
      } else if (structure.category === StructureType[StructureType.Hyperstructure]) {
        name = `HS ${structure.entity_id}`;
      } else if (structure.category === StructureType[StructureType.Bank]) {
        name = `BK ${structure.entity_id}`;
      }
    }
  }

  return name;
};
