import { useEntityQuery } from "@dojoengine/react";
import { useDojo } from "../context/DojoContext";
import { Component, Entity, Has, HasValue, Not, NotValue, getComponentValue } from "@dojoengine/recs";
import { Position } from "@bibliothecadao/eternum";
import { shortString } from "starknet";
import { useMemo } from "react";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { ClientComponents } from "@/dojo/createClientComponents";
import { getForeignKeyEntityId } from "@/ui/utils/utils";

export type ArmyAndName = ClientComponents["Army"]["schema"] & { name: string } & ClientComponents["Health"]["schema"] &
  ClientComponents["Protectee"]["schema"] &
  ClientComponents["Quantity"]["schema"] &
  ClientComponents["Movable"]["schema"] &
  ClientComponents["Capacity"]["schema"] &
  ClientComponents["ArrivalTime"]["schema"] &
  ClientComponents["Position"]["schema"] &
  ClientComponents["EntityOwner"]["schema"] &
  ClientComponents["Owner"]["schema"] & { realm: ClientComponents["Realm"]["schema"] } & {
    homePosition: ClientComponents["Position"]["schema"];
  };

const formatArmies = (
  armies: Entity[],
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
): ArmyAndName[] => {
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
      ...owner,
      realm,
      homePosition,
      name:
        (name ? shortString.decodeShortString(name.name.toString()) : `Army ${army?.entity_id}`) +
        ` - ${protectee ? "Defense 🛡️" : "Attack 🗡️"}`,
      // note: have to explicitly specify entity id as the army entity id or else it's realm entity id
      entity_id: army.entity_id,
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
      },
    },
  } = useDojo();

  const armies = useEntityQuery([Has(Army), Has(Health), NotValue(Health, { lifetime: 0n })]);

  return {
    armies: () =>
      formatArmies(
        armies,
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
      ),
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
      },
    },
  } = useDojo();

  const armies = useEntityQuery([Has(Army), HasValue(EntityOwner, { entity_owner_id: entity_id })]);

  return {
    entityArmies: () =>
      formatArmies(
        armies,
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
      ),
  };
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
        },
      },
      account: { account },
    } = useDojo();

    const allArmiesAtPosition = useEntityQuery([Has(Army), HasValue(Position, position)]);

    const allArmies = useMemo(() => {
      return formatArmies(
        allArmiesAtPosition,
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

    return {
      allArmies,
      enemyArmies,
      userArmies,
    };
  }
};
