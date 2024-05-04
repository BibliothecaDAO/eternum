import { useEntityQuery } from "@dojoengine/react";
import { useDojo } from "../context/DojoContext";
import { Component, Entity, Has, HasValue, getComponentValue } from "@dojoengine/recs";
import { Position } from "@bibliothecadao/eternum";
import { shortString } from "starknet";
import { useMemo } from "react";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { ClientComponents } from "@/dojo/createClientComponents";

export type ArmyAndName = ClientComponents["Army"]["schema"] & { name: string } & ClientComponents["Health"]["schema"] &
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
    const health = getComponentValue(Health, id) as ClientComponents["Health"]["schema"];
    const quantity = getComponentValue(Quantity, id) as ClientComponents["Quantity"]["schema"];
    const movable = getComponentValue(Movable, id) as ClientComponents["Movable"]["schema"];
    const capacity = getComponentValue(Capacity, id) as ClientComponents["Capacity"]["schema"];
    const arrivalTime = getComponentValue(ArrivalTime, id) as ClientComponents["ArrivalTime"]["schema"];
    const position = getComponentValue(Position, id) as ClientComponents["Position"]["schema"];
    const entityOwner = getComponentValue(EntityOwner, id) as ClientComponents["EntityOwner"]["schema"];
    const owner = getComponentValue(Owner, id) as ClientComponents["Owner"]["schema"];
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
      name: name ? shortString.decodeShortString(name.name.toString()) : `Army ${army?.entity_id}`,
    };
  });
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
