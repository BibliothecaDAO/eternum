import { type ClientComponents } from "@/dojo/createClientComponents";
import { getArmyTotalCapacity } from "@/dojo/modelManager/utils/ArmyMovementUtils";
import {
  CapacityConfigCategory,
  ContractAddress,
  EternumGlobalConfig,
  type ID,
  type Position,
} from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import {
  Has,
  HasValue,
  Not,
  NotValue,
  getComponentValue,
  runQuery,
  type Component,
  type ComponentValue,
  type Entity,
} from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useMemo } from "react";
import { shortString } from "starknet";
import { useDojo } from "../context/DojoContext";
import { type PlayerStructure } from "./useEntities";

export type ArmyInfo = ComponentValue<ClientComponents["Army"]["schema"]> & {
  name: string;
  isMine: boolean;
  isMercenary: boolean;
  isHome: boolean;
  offset: Position;
  health: ComponentValue<ClientComponents["Health"]["schema"]>;
  position: ComponentValue<ClientComponents["Position"]["schema"]>;
  quantity: ComponentValue<ClientComponents["Quantity"]["schema"]>;
  owner: ComponentValue<ClientComponents["Owner"]["schema"]>;
  entityOwner: ComponentValue<ClientComponents["EntityOwner"]["schema"]>;
  protectee: ComponentValue<ClientComponents["Protectee"]["schema"]> | undefined;
  movable: ComponentValue<ClientComponents["Movable"]["schema"]> | undefined;
  totalCapacity: bigint;
  weight: bigint;
  arrivalTime: ComponentValue<ClientComponents["ArrivalTime"]["schema"]> | undefined;
  stamina: ComponentValue<ClientComponents["Stamina"]["schema"]> | undefined;
  realm: ComponentValue<ClientComponents["Realm"]["schema"]> | undefined;
  homePosition: ComponentValue<ClientComponents["Position"]["schema"]> | undefined;
};

const formatArmies = (
  armies: Entity[],
  playerAddress: string,
  Army: Component<ClientComponents["Army"]["schema"]>,
  Protectee: Component<ClientComponents["Protectee"]["schema"]>,
  Name: Component<ClientComponents["EntityName"]["schema"]>,
  Health: Component<ClientComponents["Health"]["schema"]>,
  Quantity: Component<ClientComponents["Quantity"]["schema"]>,
  Movable: Component<ClientComponents["Movable"]["schema"]>,
  CapacityConfig: Component<ClientComponents["CapacityConfig"]["schema"]>,
  Weight: Component<ClientComponents["Weight"]["schema"]>,
  ArrivalTime: Component<ClientComponents["ArrivalTime"]["schema"]>,
  Position: Component<ClientComponents["Position"]["schema"]>,
  EntityOwner: Component<ClientComponents["EntityOwner"]["schema"]>,
  Owner: Component<ClientComponents["Owner"]["schema"]>,
  Realm: Component<ClientComponents["Realm"]["schema"]>,
  Stamina: Component<ClientComponents["Stamina"]["schema"]>,
  Structure: Component<ClientComponents["Structure"]["schema"]>,
): ArmyInfo[] => {
  return armies
    .map((armyEntityId) => {
      const army = getComponentValue(Army, armyEntityId);
      if (!army) return undefined;

      const position = getComponentValue(Position, armyEntityId);
      if (!position) return undefined;

      const entityOwner = getComponentValue(EntityOwner, armyEntityId);
      if (!entityOwner) return undefined;

      const owner = getComponentValue(Owner, getEntityIdFromKeys([BigInt(entityOwner.entity_owner_id)]));

      let health = structuredClone(getComponentValue(Health, armyEntityId));
      if (health) {
        health.current = health.current / BigInt(EternumGlobalConfig.resources.resourcePrecision);
        health.lifetime = health.lifetime / BigInt(EternumGlobalConfig.resources.resourcePrecision);
      } else {
        health = {
          entity_id: army.entity_id,
          current: 0n,
          lifetime: 0n,
        };
      }
      const protectee = getComponentValue(Protectee, armyEntityId);

      let quantity = structuredClone(getComponentValue(Quantity, armyEntityId));
      if (quantity) {
        quantity.value = BigInt(quantity.value) / BigInt(EternumGlobalConfig.resources.resourcePrecision);
      } else {
        quantity = {
          entity_id: army.entity_id,
          value: 0n,
        };
      }

      const movable = getComponentValue(Movable, armyEntityId);

      const armyCapacityConfigEntityId = getEntityIdFromKeys([BigInt(CapacityConfigCategory.Army)]);
      const capacity = getComponentValue(CapacityConfig, armyCapacityConfigEntityId);
      const totalCapacity = capacity ? getArmyTotalCapacity(army, capacity) : 0n;

      const weightComponentValue = getComponentValue(Weight, armyEntityId);
      const weight = weightComponentValue
        ? weightComponentValue.value / BigInt(EternumGlobalConfig.resources.resourcePrecision)
        : 0n;

      const arrivalTime = getComponentValue(ArrivalTime, armyEntityId);
      const stamina = getComponentValue(Stamina, armyEntityId);
      const name = getComponentValue(Name, armyEntityId);
      const realm = entityOwner && getComponentValue(Realm, getEntityIdFromKeys([BigInt(entityOwner.entity_owner_id)]));
      const homePosition = realm && getComponentValue(Position, getEntityIdFromKeys([BigInt(realm.entity_id)]));

      const structure = getComponentValue(Structure, getEntityIdFromKeys([BigInt(entityOwner.entity_owner_id)]));

      const structurePosition =
        structure && getComponentValue(Position, getEntityIdFromKeys([BigInt(structure.entity_id)]));

      const isMine = (owner?.address || 0n) === ContractAddress(playerAddress);
      const isMercenary = owner === undefined;

      const isHome = structurePosition && position.x === structurePosition.x && position.y === structurePosition.y;

      return {
        ...army,
        protectee,
        health,
        movable,
        quantity,
        totalCapacity,
        weight,
        arrivalTime,
        position,
        entityOwner,
        stamina,
        owner,
        realm,
        homePosition,
        isMine,
        isMercenary,
        isHome,
        name: name
          ? shortString.decodeShortString(name.name.toString())
          : `${protectee ? "🛡️" : "🗡️"}` + `Army ${army.entity_id}`,
      };
    })
    .filter((army): army is ArmyInfo => army !== undefined);
};

export const useArmiesByEntityOwner = ({ entity_owner_entity_id }: { entity_owner_entity_id: ID }) => {
  const {
    setup: {
      components: {
        Position,
        EntityOwner,
        Owner,
        Health,
        Quantity,
        Movable,
        CapacityConfig,
        Weight,
        ArrivalTime,
        Realm,
        Army,
        Protectee,
        EntityName,
        Stamina,
        Structure,
      },
    },
    account: { account },
  } = useDojo();

  const armies = useEntityQuery([Has(Army), HasValue(EntityOwner, { entity_owner_id: entity_owner_entity_id })]);

  const entityArmies = useMemo(() => {
    return formatArmies(
      armies,
      account.address,
      Army,
      Protectee,
      EntityName,
      Health,
      Quantity,
      Movable,
      CapacityConfig,
      Weight,
      ArrivalTime,
      Position,
      EntityOwner,
      Owner,
      Realm,
      Stamina,
      Structure,
    );
  }, [armies]);

  return {
    entityArmies,
  };
};

export const useArmiesByEntityOwnerWithPositionAndQuantity = ({
  entity_owner_entity_id,
}: {
  entity_owner_entity_id: ID;
}) => {
  const {
    setup: {
      components: {
        Position,
        EntityOwner,
        Owner,
        Health,
        Quantity,
        Movable,
        CapacityConfig,
        Weight,
        ArrivalTime,
        Realm,
        Army,
        Protectee,
        EntityName,
        Stamina,
        Structure,
      },
    },
    account: { account },
  } = useDojo();

  const armies = useEntityQuery([
    Has(Army),
    Has(Position),
    Has(Quantity),
    HasValue(EntityOwner, { entity_owner_id: entity_owner_entity_id }),
  ]);

  const entityArmies = useMemo(() => {
    return formatArmies(
      armies,
      account.address,
      Army,
      Protectee,
      EntityName,
      Health,
      Quantity,
      Movable,
      CapacityConfig,
      Weight,
      ArrivalTime,
      Position,
      EntityOwner,
      Owner,
      Realm,
      Stamina,
      Structure,
    );
  }, [armies]);

  return {
    entityArmies,
  };
};

export const getArmiesByBattleId = () => {
  const {
    setup: {
      components: {
        Position,
        EntityOwner,
        Owner,
        Health,
        Quantity,
        Movable,
        CapacityConfig,
        Weight,
        ArrivalTime,
        Realm,
        Army,
        Protectee,
        EntityName,
        Stamina,
        Structure,
      },
    },
    account: { account },
  } = useDojo();

  const armiesByBattleId = (battle_id: ID) => {
    const armiesEntityIds = runQuery([HasValue(Army, { battle_id })]);
    return formatArmies(
      Array.from(armiesEntityIds),
      account.address,
      Army,
      Protectee,
      EntityName,
      Health,
      Quantity,
      Movable,
      CapacityConfig,
      Weight,
      ArrivalTime,
      Position,
      EntityOwner,
      Owner,
      Realm,
      Stamina,
      Structure,
    );
  };
  return armiesByBattleId;
};

export const useArmyByArmyEntityId = (entityId: ID): ArmyInfo | undefined => {
  const {
    setup: {
      components: {
        Position,
        EntityOwner,
        Owner,
        Health,
        Quantity,
        Movable,
        CapacityConfig,
        Weight,
        ArrivalTime,
        Realm,
        Army,
        Protectee,
        EntityName,
        Stamina,
        Structure,
      },
    },
    account: { account },
  } = useDojo();

  const armiesEntityIds = useEntityQuery([HasValue(Army, { entity_id: entityId })]);
  return formatArmies(
    Array.from(armiesEntityIds),
    account.address,
    Army,
    Protectee,
    EntityName,
    Health,
    Quantity,
    Movable,
    CapacityConfig,
    Weight,
    ArrivalTime,
    Position,
    EntityOwner,
    Owner,
    Realm,
    Stamina,
    Structure,
  )[0];
};

export const getUserArmyInBattle = (battle_id: ID) => {
  const {
    account: { account },
    setup: {
      components: {
        Position,
        EntityOwner,
        Owner,
        Health,
        Quantity,
        Movable,
        CapacityConfig,
        Weight,
        ArrivalTime,
        Realm,
        Army,
        Protectee,
        EntityName,
        Stamina,
        Structure,
      },
    },
  } = useDojo();

  const armiesEntityIds = runQuery([
    Has(Army),
    NotValue(Army, { battle_id: 0 }),
    HasValue(Army, { battle_id }),
    HasValue(Owner, { address: ContractAddress(account.address) }),
  ]);

  const armies = useMemo(() => {
    return formatArmies(
      Array.from(armiesEntityIds),
      account.address,
      Army,
      Protectee,
      EntityName,
      Health,
      Quantity,
      Movable,
      CapacityConfig,
      Weight,
      ArrivalTime,
      Position,
      EntityOwner,
      Owner,
      Realm,
      Stamina,
      Structure,
    )[0];
  }, [battle_id]);

  return armies;
};

export const useOwnArmiesByPosition = ({
  position,
  inBattle,
  playerStructures,
}: {
  position: Position;
  inBattle: boolean;
  playerStructures: PlayerStructure[];
}) => {
  {
    const {
      account: { account },
      setup: {
        components: {
          Position,
          EntityOwner,
          Owner,
          Health,
          Quantity,
          Movable,
          CapacityConfig,
          Weight,
          ArrivalTime,
          Realm,
          Army,
          Protectee,
          EntityName,
          Stamina,
          Structure,
        },
      },
    } = useDojo();

    const ownArmiesAtPosition = useEntityQuery([
      Has(Army),
      HasValue(Position, { x: position.x, y: position.y }),
      Not(Protectee),
      inBattle ? NotValue(Army, { battle_id: 0 }) : HasValue(Army, { battle_id: 0 }),
    ]);

    const ownArmies = useMemo(() => {
      return formatArmies(
        ownArmiesAtPosition,
        account.address,
        Army,
        Protectee,
        EntityName,
        Health,
        Quantity,
        Movable,
        CapacityConfig,
        Weight,
        ArrivalTime,
        Position,
        EntityOwner,
        Owner,
        Realm,
        Stamina,
        Structure,
      ).filter((army) =>
        playerStructures.some((structure) => structure.entity_id === army.entityOwner.entity_owner_id),
      );
    }, [ownArmiesAtPosition, position.x, position.y]);

    return ownArmies;
  }
};

export const useEnemyArmiesByPosition = ({
  position,
  playerStructures,
}: {
  position: Position;
  playerStructures: PlayerStructure[];
}) => {
  {
    const {
      account: { account },
      setup: {
        components: {
          Position,
          EntityOwner,
          Owner,
          Health,
          Quantity,
          Movable,
          CapacityConfig,
          Weight,
          ArrivalTime,
          Realm,
          Army,
          Protectee,
          EntityName,
          Stamina,
          Structure,
        },
      },
    } = useDojo();

    const enemyArmiesAtPosition = useEntityQuery([
      Has(Army),
      HasValue(Position, { x: position.x, y: position.y }),
      Not(Protectee),
    ]);

    const enemyArmies = useMemo(() => {
      return formatArmies(
        enemyArmiesAtPosition,
        account.address,
        Army,
        Protectee,
        EntityName,
        Health,
        Quantity,
        Movable,
        CapacityConfig,
        Weight,
        ArrivalTime,
        Position,
        EntityOwner,
        Owner,
        Realm,
        Stamina,
        Structure,
      ).filter((army) =>
        playerStructures.every((structure) => structure.entity_id !== army.entityOwner.entity_owner_id),
      );
    }, [enemyArmiesAtPosition]);

    return enemyArmies;
  }
};

export const getArmyByEntityId = () => {
  const {
    setup: {
      components: {
        Position,
        EntityOwner,
        Owner,
        Health,
        Quantity,
        Movable,
        CapacityConfig,
        Weight,
        ArrivalTime,
        Realm,
        Army,
        Protectee,
        EntityName,
        Stamina,
        Structure,
      },
    },
    account: { account },
  } = useDojo();

  const getAliveArmy = (entity_id: ID): ArmyInfo | undefined => {
    const armiesEntityIds = runQuery([Has(Army), HasValue(Army, { entity_id })]);
    return formatArmies(
      Array.from(armiesEntityIds),
      account.address,
      Army,
      Protectee,
      EntityName,
      Health,
      Quantity,
      Movable,
      CapacityConfig,
      Weight,
      ArrivalTime,
      Position,
      EntityOwner,
      Owner,
      Realm,
      Stamina,
      Structure,
    )[0];
  };

  const getArmy = (entity_id: ID): ArmyInfo | undefined => {
    const armiesEntityIds = runQuery([Has(Army), HasValue(Army, { entity_id })]);

    return formatArmies(
      Array.from(armiesEntityIds),
      account.address,
      Army,
      Protectee,
      EntityName,
      Health,
      Quantity,
      Movable,
      CapacityConfig,
      Weight,
      ArrivalTime,
      Position,
      EntityOwner,
      Owner,
      Realm,
      Stamina,
      Structure,
    )[0];
  };

  return { getAliveArmy, getArmy };
};

export const getArmiesByPosition = () => {
  const {
    account: { account },
    setup: {
      components: {
        Position,
        EntityOwner,
        Owner,
        Health,
        Quantity,
        Movable,
        CapacityConfig,
        Weight,
        ArrivalTime,
        Realm,
        Army,
        Protectee,
        EntityName,
        Stamina,
        Structure,
      },
    },
  } = useDojo();

  const getArmies = (position: Position) => {
    const armiesEntityIds = runQuery([Has(Army), HasValue(Position, { x: position.x, y: position.y })]);
    return formatArmies(
      Array.from(armiesEntityIds),
      account.address,
      Army,
      Protectee,
      EntityName,
      Health,
      Quantity,
      Movable,
      CapacityConfig,
      Weight,
      ArrivalTime,
      Position,
      EntityOwner,
      Owner,
      Realm,
      Stamina,
      Structure,
    );
  };

  return getArmies;
};
