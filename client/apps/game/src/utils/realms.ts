import { ClientComponents } from "@bibliothecadao/eternum";
import { Has, runQuery } from "@dojoengine/recs";

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
