import { useEntityQuery } from "@dojoengine/react";
import { useDojo } from "../context/DojoContext";
import { Component, Entity, Has, HasValue, getComponentValue } from "@dojoengine/recs";
import { Position } from "@bibliothecadao/eternum";
import { shortString } from "starknet";
import { useMemo } from "react";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { ClientComponents } from "@/dojo/createClientComponents";

const formatArmies = (
  armies: Entity[],
  Army: Component,
  Name: Component,
): (ClientComponents["Army"]["schema"] & {
  name: string;
})[] => {
  return armies.map((id) => {
    const army = getComponentValue(Army, id) as ClientComponents["Army"]["schema"];
    const name = getComponentValue(Name, id) as {
      name: string;
    };
    return { ...army, name: name ? shortString.decodeShortString(name.name.toString()) : `Army ${army?.entity_id}` };
  });
};

export const useEntityArmies = ({ entity_id }: { entity_id: bigint }) => {
  const {
    setup: {
      components: { Army, EntityOwner, EntityName },
    },
  } = useDojo();

  const armies = useEntityQuery([Has(Army), HasValue(EntityOwner, { entity_owner_id: entity_id })]);

  return {
    entityArmies: () => formatArmies(armies, Army, EntityName),
  };
};

export const usePositionArmies = ({ position }: { position: Position }) => {
  {
    const {
      setup: {
        components: { Army, Position, EntityName, EntityOwner, Owner },
      },
      account: { account },
    } = useDojo();

    const allArmiesAtPosition = useEntityQuery([Has(Army), HasValue(Position, position)]);

    const allArmies = useMemo(() => {
      return formatArmies(allArmiesAtPosition, Army, EntityName);
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
