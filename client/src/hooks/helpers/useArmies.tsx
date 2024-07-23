import { ClientComponents } from "@/dojo/createClientComponents";
import { getUIPositionFromColRow } from "@/ui/utils/utils";
import { EternumGlobalConfig, Position, UIPosition } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import {
  Component,
  ComponentValue,
  Entity,
  Has,
  HasValue,
  Not,
  NotValue,
  getComponentValue,
  runQuery,
} from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useMemo } from "react";
import { shortString } from "starknet";
import { useDojo } from "../context/DojoContext";
import { getBattle } from "./battles/useBattles";
import { armyHasLost, battleIsFinished } from "./battles/useBattlesUtils";

export type ArmyInfo = ComponentValue<ClientComponents["Army"]["schema"]> & {
  name: string;
  isMine: boolean;
  isMercenary: boolean;
  uiPos: UIPosition;
  offset: Position;
  health: ComponentValue<ClientComponents["Health"]["schema"]>;
  position: ComponentValue<ClientComponents["Position"]["schema"]>;
  owner: ComponentValue<ClientComponents["Owner"]["schema"]>;
  entityOwner: ComponentValue<ClientComponents["EntityOwner"]["schema"]>;
  protectee: ComponentValue<ClientComponents["Protectee"]["schema"]> | undefined;
  quantity: ComponentValue<ClientComponents["Quantity"]["schema"]> | undefined;
  movable: ComponentValue<ClientComponents["Movable"]["schema"]> | undefined;
  capacity: ComponentValue<ClientComponents["Capacity"]["schema"]> | undefined;
  arrivalTime: ComponentValue<ClientComponents["ArrivalTime"]["schema"]> | undefined;
  stamina: ComponentValue<ClientComponents["Stamina"]["schema"]> | undefined;
  realm: ComponentValue<ClientComponents["Realm"]["schema"]> | undefined;
  homePosition: ComponentValue<ClientComponents["Position"]["schema"]> | undefined;
};

export const formatArmies = (
  armies: Entity[],
  playerAddress: string,
  Army: Component<ClientComponents["Army"]["schema"]>,
  Protectee: Component<ClientComponents["Protectee"]["schema"]>,
  Name: Component<ClientComponents["EntityName"]["schema"]>,
  Health: Component<ClientComponents["Health"]["schema"]>,
  Quantity: Component<ClientComponents["Quantity"]["schema"]>,
  Movable: Component<ClientComponents["Movable"]["schema"]>,
  Capacity: Component<ClientComponents["Capacity"]["schema"]>,
  ArrivalTime: Component<ClientComponents["ArrivalTime"]["schema"]>,
  Position: Component<ClientComponents["Position"]["schema"]>,
  EntityOwner: Component<ClientComponents["EntityOwner"]["schema"]>,
  Owner: Component<ClientComponents["Owner"]["schema"]>,
  Realm: Component<ClientComponents["Realm"]["schema"]>,
  Stamina: Component<ClientComponents["Stamina"]["schema"]>,
): ArmyInfo[] => {
  return armies
    .map((armyEntityId) => {
      const army = getComponentValue(Army, armyEntityId);
      if (!army) return undefined;
      const health = getComponentValue(Health, armyEntityId);

      const position = getComponentValue(Position, armyEntityId);
      if (!position) return undefined;

      const entityOwner = getComponentValue(EntityOwner, armyEntityId);
      if (!entityOwner) return undefined;

      let owner = getComponentValue(Owner, armyEntityId);
      if (!owner && entityOwner?.entity_owner_id) {
        owner = getComponentValue(Owner, getEntityIdFromKeys([BigInt(entityOwner.entity_owner_id)]));
      }
      if (!owner) return undefined;

      let healthClone = structuredClone(health);
      if (healthClone) {
        healthClone.current =
          BigInt(healthClone.current) /
          (BigInt(EternumGlobalConfig.resources.resourcePrecision) * EternumGlobalConfig.troop.healthPrecision);
        healthClone.lifetime =
          BigInt(healthClone.lifetime) /
          (BigInt(EternumGlobalConfig.resources.resourcePrecision) * EternumGlobalConfig.troop.healthPrecision);
      } else {
        healthClone = {
          entity_id: army.entity_id,
          current: 0n,
          lifetime: 0n,
        };
      }
      const protectee = getComponentValue(Protectee, armyEntityId);
      const quantity = getComponentValue(Quantity, armyEntityId);
      const movable = getComponentValue(Movable, armyEntityId);
      const capacity = getComponentValue(Capacity, armyEntityId);
      const arrivalTime = getComponentValue(ArrivalTime, armyEntityId);
      const stamina = getComponentValue(Stamina, armyEntityId);
      const name = getComponentValue(Name, armyEntityId);
      const realm = entityOwner && getComponentValue(Realm, getEntityIdFromKeys([BigInt(entityOwner.entity_owner_id)]));
      const homePosition = realm && getComponentValue(Position, getEntityIdFromKeys([BigInt(realm.realm_id)]));

      const isMine = BigInt(owner?.address || 0) === BigInt(playerAddress);
      const isMercenary = owner === undefined;
      const ownGroupIndex = Number(army.entity_id) % 12;
      const offset = calculateOffset(ownGroupIndex, 12);
      const offsetToAvoidOverlapping = Math.random() * 1 - 0.5;
      offset.y += offsetToAvoidOverlapping;

      return {
        ...army,
        protectee,
        health: healthClone,
        quantity,
        movable,
        capacity,
        arrivalTime,
        position,
        entityOwner,
        stamina,
        owner,
        realm,
        homePosition,
        isMine,
        isMercenary,
        offset,
        uiPos: { ...getUIPositionFromColRow(Number(position?.x || 0), Number(position?.y || 0)), z: 0.32 },
        name: name
          ? shortString.decodeShortString(name.name.toString())
          : `${protectee ? "🛡️" : "🗡️"}` + `Army ${army.entity_id}`,
      };
    })
    .filter((army): army is ArmyInfo => army !== undefined);
};

export const useMovableArmies = () => {
  const {
    setup: {
      components: {
        Position,
        EntityOwner,
        Owner,
        Health,
        Quantity,
        Movable,
        Capacity,
        ArrivalTime,
        Realm,
        Army,
        Protectee,
        EntityName,
        Stamina,
        Battle,
      },
    },
    account: { account },
  } = useDojo();

  const armies = useEntityQuery([
    Has(Position),
    Has(Army),
    Has(Health),
    Not(Protectee),
    NotValue(Movable, { sec_per_km: 0 }),
    HasValue(Army, { battle_id: 0n }),
  ]);

  return {
    getArmies: () =>
      formatArmies(
        armies,
        account.address,
        Army,
        Protectee,
        EntityName,
        Health,
        Quantity,
        Movable,
        Capacity,
        ArrivalTime,
        Position,
        EntityOwner,
        Owner,
        Realm,
        Stamina,
      ).filter((army) => isArmyAlive(army, Battle, Army)),
  };
};

export const useArmiesByEntityOwner = ({ entity_owner_entity_id }: { entity_owner_entity_id: bigint }) => {
  const {
    setup: {
      components: {
        Position,
        EntityOwner,
        Owner,
        Health,
        Quantity,
        Movable,
        Capacity,
        ArrivalTime,
        Realm,
        Army,
        Protectee,
        EntityName,
        Stamina,
        Battle,
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
      Capacity,
      ArrivalTime,
      Position,
      EntityOwner,
      Owner,
      Realm,
      Stamina,
    ).filter((army) => isArmyAlive(army, Battle, Army));
  }, [armies]);

  return {
    entityArmies,
  };
};

export const useArmiesByBattleId = (battle_id: bigint) => {
  const {
    setup: {
      components: {
        Position,
        EntityOwner,
        Owner,
        Health,
        Quantity,
        Movable,
        Capacity,
        ArrivalTime,
        Realm,
        Army,
        Protectee,
        EntityName,
        Stamina,
        Battle,
      },
    },
    account: { account },
  } = useDojo();

  const armiesEntityIds = useEntityQuery([HasValue(Army, { battle_id })]);
  return formatArmies(
    Array.from(armiesEntityIds),
    account.address,
    Army,
    Protectee,
    EntityName,
    Health,
    Quantity,
    Movable,
    Capacity,
    ArrivalTime,
    Position,
    EntityOwner,
    Owner,
    Realm,
    Stamina,
  ).filter((army) => isArmyAlive(army, Battle, Army));
};

export const getArmiesByBattleId = (battle_id: bigint) => {
  const {
    setup: {
      components: {
        Position,
        EntityOwner,
        Owner,
        Health,
        Quantity,
        Movable,
        Capacity,
        ArrivalTime,
        Realm,
        Army,
        Protectee,
        EntityName,
        Stamina,
        Battle,
      },
    },
    account: { account },
  } = useDojo();

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
    Capacity,
    ArrivalTime,
    Position,
    EntityOwner,
    Owner,
    Realm,
    Stamina,
  ).filter((army) => isArmyAlive(army, Battle, Army));
};

export const useArmyByArmyEntityId = (entityId: bigint) => {
  const {
    setup: {
      components: {
        Position,
        EntityOwner,
        Owner,
        Health,
        Quantity,
        Movable,
        Capacity,
        ArrivalTime,
        Realm,
        Army,
        Protectee,
        EntityName,
        Stamina,
        Battle,
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
    Capacity,
    ArrivalTime,
    Position,
    EntityOwner,
    Owner,
    Realm,
    Stamina,
  ).filter((army) => isArmyAlive(army, Battle, Army))[0];
};

export const usePositionArmies = ({ position }: { position: Position }) => {
  {
    const {
      setup: {
        components: {
          Position,
          EntityOwner,
          Owner,
          Health,
          Quantity,
          Movable,
          Capacity,
          ArrivalTime,
          Realm,
          Army,
          Protectee,
          EntityName,
          Stamina,
          Battle,
        },
      },
      account: { account },
    } = useDojo();

    const allArmiesAtPosition = useEntityQuery([Has(Army), HasValue(Position, { x: position.x, y: position.y })]);

    const allArmies = useMemo(() => {
      return formatArmies(
        allArmiesAtPosition,
        account.address,
        Army,
        Protectee,
        EntityName,
        Health,
        Quantity,
        Movable,
        Capacity,
        ArrivalTime,
        Position,
        EntityOwner,
        Owner,
        Realm,
        Stamina,
      ).filter((army) => isArmyAlive(army, Battle, Army));
    }, [allArmiesAtPosition]);

    const userArmies = useMemo(() => {
      return allArmies.filter((army: any) => {
        const entityOwner = getComponentValue(EntityOwner, getEntityIdFromKeys([army?.entity_id || 0n]));
        const owner = getComponentValue(Owner, getEntityIdFromKeys([entityOwner?.entity_owner_id || 0n]));
        return owner?.address === BigInt(account.address);
      });
    }, [allArmies]);

    const enemyArmies = useMemo(() => {
      return allArmies.filter((army: any) => {
        const entityOwner = getComponentValue(EntityOwner, getEntityIdFromKeys([army?.entity_id || 0n]));
        const owner = getComponentValue(Owner, getEntityIdFromKeys([entityOwner?.entity_owner_id || 0n]));

        return owner?.address !== BigInt(account.address);
      });
    }, [allArmies]);

    const userAttackingArmies = useMemo(() => {
      return userArmies.filter((army: any) => {
        const entityOwner = getComponentValue(Protectee, getEntityIdFromKeys([army?.entity_id || 0n]));
        return !entityOwner;
      });
    }, [userArmies]);

    return {
      allArmies,
      enemyArmies,
      userArmies,
      userAttackingArmies,
    };
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
        Capacity,
        ArrivalTime,
        Realm,
        Army,
        Protectee,
        EntityName,
        Stamina,
        Battle,
      },
    },
    account: { account },
  } = useDojo();

  const getAliveArmy = (entity_id: bigint): ArmyInfo | undefined => {
    const armiesEntityIds = runQuery([Has(Army), HasValue(Army, { entity_id: entity_id })]);

    return formatArmies(
      Array.from(armiesEntityIds),
      account.address,
      Army,
      Protectee,
      EntityName,
      Health,
      Quantity,
      Movable,
      Capacity,
      ArrivalTime,
      Position,
      EntityOwner,
      Owner,
      Realm,
      Stamina,
    ).filter((army) => isArmyAlive(army, Battle, Army))[0];
  };

  const getArmy = (entity_id: bigint) => {
    const armiesEntityIds = runQuery([Has(Army), HasValue(Army, { entity_id: entity_id })]);

    return formatArmies(
      Array.from(armiesEntityIds),
      account.address,
      Army,
      Protectee,
      EntityName,
      Health,
      Quantity,
      Movable,
      Capacity,
      ArrivalTime,
      Position,
      EntityOwner,
      Owner,
      Realm,
      Stamina,
    )[0];
  };

  return { getAliveArmy, getArmy };
};

export const getArmiesAtPosition = () => {
  const {
    setup: {
      components: {
        Position,
        EntityOwner,
        Owner,
        Health,
        Quantity,
        Movable,
        Capacity,
        ArrivalTime,
        Realm,
        Army,
        Protectee,
        EntityName,
        Stamina,
        Battle,
      },
    },
    account: { account },
  } = useDojo();

  const getArmies = ({ x, y }: Position) => {
    const allArmiesAtPosition = runQuery([Has(Army), HasValue(Position, { x, y }), HasValue(Army, { battle_id: 0n })]);

    const userArmies = Array.from(allArmiesAtPosition).filter((armyEntityId: any) => {
      const entityOwner = getComponentValue(EntityOwner, armyEntityId);
      const owner = getComponentValue(Owner, getEntityIdFromKeys([entityOwner?.entity_owner_id || 0n]));
      return owner?.address === BigInt(account.address);
    });

    const opponentArmies = Array.from(allArmiesAtPosition).filter((armyEntityId: any) => {
      const entityOwner = getComponentValue(EntityOwner, armyEntityId);
      const owner = getComponentValue(Owner, getEntityIdFromKeys([entityOwner?.entity_owner_id || 0n]));
      return owner?.address !== BigInt(account.address);
    });

    return {
      userArmiesAtPosition: formatArmies(
        userArmies,
        account.address,
        Army,
        Protectee,
        EntityName,
        Health,
        Quantity,
        Movable,
        Capacity,
        ArrivalTime,
        Position,
        EntityOwner,
        Owner,
        Realm,
        Stamina,
      ).filter((army) => isArmyAlive(army, Battle, Army)),

      opponentArmiesAtPosition: formatArmies(
        opponentArmies,
        account.address,
        Army,
        Protectee,
        EntityName,
        Health,
        Quantity,
        Movable,
        Capacity,
        ArrivalTime,
        Position,
        EntityOwner,
        Owner,
        Realm,
        Stamina,
      ).filter((army) => isArmyAlive(army, Battle, Army)),
    };
  };

  return { getArmies };
};
const calculateOffset = (index: number, total: number) => {
  if (total === 1) return { x: 0, y: 0 };

  const radius = 1.5; // Radius where the armies will be placed
  const angleIncrement = (2 * Math.PI) / 6; // Maximum 6 points on the circumference for the first layer
  let angle = angleIncrement * (index % 6);
  let offsetRadius = radius;

  if (index >= 6) {
    // Adjustments for more than 6 armies, placing them in another layer
    offsetRadius += 0.5; // Increase radius for each new layer
    angle += angleIncrement / 2; // Offset angle to interleave with previous layer
  }

  return {
    x: offsetRadius * Math.cos(angle),
    y: offsetRadius * Math.sin(angle),
  };
};

export const checkIfArmyLostAFinishedBattle = (Battle: Component, Army: Component, army: ArmyInfo) => {
  const battle = getBattle(getEntityIdFromKeys([BigInt(army?.battle_id || 0n)]), Battle);
  if (battle && armyHasLost(army, battle as any) && battleIsFinished(Army, battle as any)) {
    return true;
  }
  return false;
};

export const checkIfArmyAliveOnchain = (army: ArmyInfo) => {
  if (army.protectee !== undefined) return true;
  return BigInt(army.health.current) > 0;
};

export const isArmyAlive = (army: ArmyInfo, Battle: Component, Army: Component) => {
  return checkIfArmyLostAFinishedBattle(Battle, Army, army) === false || army.protectee !== undefined;
};
