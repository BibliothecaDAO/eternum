import { Player } from "@bibliothecadao/types";
import { useEntityQuery } from "@dojoengine/react";
import { getComponentValue, Has } from "@dojoengine/recs";
import { useMemo } from "react";
import { shortString } from "starknet";
import { useDojo } from "../context";

export const usePlayers = (): Player[] => {
  const {
    setup: { components },
  } = useDojo();

  const entities = useEntityQuery([Has(components.AddressName)]);

  const players = useMemo(() => {
    return entities
      .map((id) => {
        const addressName = getComponentValue(components.AddressName, id);
        if (!addressName) return;
        return {
          entity: id,
          address: addressName.address,
          name: shortString.decodeShortString(addressName.name.toString()),
        };
      })
      .filter(Boolean) as Player[];
  }, [entities]);

  return players;
};
