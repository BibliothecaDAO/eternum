import { ClientComponents, ContractAddress } from "@bibliothecadao/eternum";
import { Has, HasValue, runQuery } from "@dojoengine/recs";

export const getRandomRealmEntity = (components: ClientComponents) => {
  const realms = runQuery([Has(components.Realm)]);

  if (realms.size === 0) {
    return undefined;
  }

  // Get a random realm entity from the set
  const realmEntities = Array.from(realms);
  const randomIndex = Math.floor(Math.random() * realmEntities.length);
  const randomRealmEntity = realmEntities[randomIndex];

  return randomRealmEntity;
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
