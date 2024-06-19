import { ClientComponents } from "@/dojo/createClientComponents";
import { getUIPositionFromColRow } from "@/ui/utils/utils";
import { EternumGlobalConfig, Position, UIPosition } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { Component, Entity, Has, HasValue, Not, NotValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useMemo } from "react";
import { shortString } from "starknet";
import { useDojo } from "../context/DojoContext";

export type ArmyInfo = ClientComponents["Army"]["schema"] & {
  name: string;
  isMine: boolean;
  uiPos: UIPosition;
  offset: Position;
} & ClientComponents["Health"]["schema"] &
  ClientComponents["Protectee"]["schema"] &
  ClientComponents["Quantity"]["schema"] &
  ClientComponents["Movable"]["schema"] &
  ClientComponents["Capacity"]["schema"] &
  ClientComponents["ArrivalTime"]["schema"] &
  ClientComponents["Position"]["schema"] &
  ClientComponents["EntityOwner"]["schema"] &
  ClientComponents["Stamina"]["schema"] &
  ClientComponents["Owner"]["schema"] & { realm: ClientComponents["Realm"]["schema"] } & {
    homePosition: ClientComponents["Position"]["schema"];
  };

const formatArmies = (
  armies: Entity[],
  playerAddress: string,
  Army: Component,
  Protectee: Component,
  Name: Component,
  Health: Component,
  Quantity: Component,
  Movable: Component,
  Capacity: Component,
  ArrivalTime: Component,
  Position: Component,
  EntityOwner: Component,
  Owner: Component,
  Realm: Component,
  Stamina: Component,
): ArmyInfo[] => {
  return armies.map((id) => {
    const army = getComponentValue(Army, id) as ClientComponents["Army"]["schema"];
    const protectee = getComponentValue(Protectee, id) as ClientComponents["Protectee"]["schema"];
    const health = getComponentValue(Health, id) as ClientComponents["Health"]["schema"];
    const quantity = getComponentValue(Quantity, id) as ClientComponents["Quantity"]["schema"];
    const movable = getComponentValue(Movable, id) as ClientComponents["Movable"]["schema"];
    const capacity = getComponentValue(Capacity, id) as ClientComponents["Capacity"]["schema"];
    const arrivalTime = getComponentValue(ArrivalTime, id) as ClientComponents["ArrivalTime"]["schema"];
    const position = getComponentValue(Position, id) as ClientComponents["Position"]["schema"];
    const entityOwner = getComponentValue(EntityOwner, id) as ClientComponents["EntityOwner"]["schema"];
    const stamina = getComponentValue(Stamina, id) as ClientComponents["Stamina"]["schema"];
    let owner = getComponentValue(Owner, id) as ClientComponents["Owner"]["schema"];
    if (!owner && entityOwner?.entity_owner_id) {
      owner = getComponentValue(
        Owner,
        getEntityIdFromKeys([BigInt(entityOwner.entity_owner_id)]),
      ) as ClientComponents["Owner"]["schema"];
    }
    const name = getComponentValue(Name, id) as ClientComponents["EntityName"]["schema"];
    const realm =
      entityOwner &&
      (getComponentValue(
        Realm,
        getEntityIdFromKeys([BigInt(entityOwner.entity_owner_id)]),
      ) as ClientComponents["Realm"]["schema"]);
    const homePosition =
      realm &&
      (getComponentValue(
        Position,
        getEntityIdFromKeys([BigInt(realm.realm_id)]),
      ) as ClientComponents["Position"]["schema"]);

    const isMine = BigInt(owner.address) === BigInt(playerAddress);
    const ownGroupIndex = Number(army.entity_id) % 12;
    const offset = calculateOffset(ownGroupIndex, 12);
    const offsetToAvoidOverlapping = Math.random() * 1 - 0.5;
    offset.y += offsetToAvoidOverlapping;

    return {
      ...army,
      ...protectee,
      ...health,
      ...quantity,
      ...movable,
      ...capacity,
      ...arrivalTime,
      ...position,
      ...entityOwner,
      ...stamina,
      ...owner,
      realm,
      homePosition,
      isMine,
      offset,
      uiPos: { ...getUIPositionFromColRow(position?.x || 0, position?.y || 0), z: 0.32 },

      name: name
        ? shortString.decodeShortString(name.name.toString())
        : `${protectee ? "🛡️" : "🗡️"}` + `Army ${army?.entity_id}`,
    };
  });
};

export const useArmies = () => {
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
    NotValue(Health, { current: 0n }),
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
      ).filter((army) => BigInt(army.current) / EternumGlobalConfig.troop.healthPrecision > 0n),
  };
};

export const useEntityArmies = ({ entity_id }: { entity_id: bigint }) => {
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
      },
    },
    account: { account },
  } = useDojo();

  const armies = useEntityQuery([Has(Army), HasValue(EntityOwner, { entity_owner_id: entity_id })]);

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
    );
  }, [armies]);

  return {
    entityArmies,
  };
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
  );
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
  )[0];
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
        },
      },
      account: { account },
    } = useDojo();

    const allArmiesAtPosition = useEntityQuery([Has(Army), HasValue(Position, position)]);

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
      );
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

export const getArmyByEntityId = (entity_id: bigint) => {
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
      },
    },
    account: { account },
  } = useDojo();

  const armies = runQuery([Has(Army), HasValue(Army, { entity_id: entity_id })]);

  return formatArmies(
    Array.from(armies),
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

export const getUserArmiesAtPosition = (position: Position) => {
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
      },
    },
    account: { account },
  } = useDojo();

  const allArmiesAtPosition = runQuery([
    Has(Army),
    HasValue(Position, { x: position.x, y: position.y }),
    HasValue(Army, { battle_id: 0n }),
  ]);

  const userArmies = Array.from(allArmiesAtPosition).filter((armyEntityId: any) => {
    const entityOwner = getComponentValue(EntityOwner, armyEntityId);
    const owner = getComponentValue(Owner, getEntityIdFromKeys([entityOwner?.entity_owner_id || 0n]));
    return owner?.address === BigInt(account.address);
  });
  return formatArmies(
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
  );
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
