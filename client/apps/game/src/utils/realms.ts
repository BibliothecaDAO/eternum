import { ClientComponents, ContractAddress } from "@bibliothecadao/eternum";
import { Has, HasValue, runQuery } from "@dojoengine/recs";

export const getRandomRealmEntity = (components: ClientComponents) => {
  if (!components?.Realm) {
    throw new Error("Invalid components: Realm component is required");
  }

  const realms = runQuery([Has(components.Realm)]);

  if (realms.size === 0) {
    return undefined;
  }

  // Optimize for large sets by avoiding Array.from
  const randomIndex = Math.floor(Math.random() * realms.size);
  let i = 0;
  for (const entity of realms) {
    if (i === randomIndex) return entity;
    i++;
  }

  // This should never happen due to the size check above
  throw new Error("Failed to get random realm entity");
};

export const getPlayerFirstRealm = (components: ClientComponents, address: ContractAddress) => {
  const realms = runQuery([
    Has(components.Structure),
    Has(components.Realm),
    HasValue(components.Owner, { address: address }),
  ]);

  const realm = realms.values().next().value;

  return realm;
};
