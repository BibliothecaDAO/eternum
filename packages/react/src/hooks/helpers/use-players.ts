import { getInternalAddressName } from "@bibliothecadao/eternum";
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

        let actualName = getInternalAddressName(addressName.address.toString());
        if (!actualName) {
          actualName = shortString.decodeShortString(addressName.name.toString());
        }

        return {
          entity: id,
          address: addressName.address,
          name: actualName,
        };
      })
      .filter(Boolean) as Player[];
  }, [entities]);

  return players;
};
