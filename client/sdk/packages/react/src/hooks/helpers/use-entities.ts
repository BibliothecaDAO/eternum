import {
  ContractAddress,
  getRealmWithPosition,
  getStructure,
  PlayerStructure,
  RealmWithPosition,
} from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { Has, HasValue } from "@dojoengine/recs";
import { useMemo } from "react";
import { useDojo } from "../context";

export const usePlayerRealms = (playerAddress?: ContractAddress) => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const entities = useEntityQuery([
    Has(components.Realm),
    HasValue(components.Owner, { address: playerAddress || ContractAddress(account.address) }),
  ]);

  const playerRealms = useMemo(() => {
    return entities
      .map((id) => getRealmWithPosition(Number(id), components))
      .filter((realm): realm is RealmWithPosition => realm !== undefined)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [entities]);

  return playerRealms;
};

export const usePlayerStructures = (playerAddress?: ContractAddress) => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const entities = useEntityQuery([
    Has(components.Structure),
    Has(components.Position),
    Has(components.Owner),
    HasValue(components.Owner, { address: playerAddress || ContractAddress(account.address) }),
  ]);

  const playerStructures = useMemo(() => {
    return entities
      .map((id) => getStructure(Number(id), components))
      .filter((structure): structure is PlayerStructure => structure !== undefined)
      .sort((a, b) => a.category.localeCompare(b.category));
  }, [entities]);

  return playerStructures;
};
