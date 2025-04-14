import { ClientComponents, ContractAddress, StructureType } from "@bibliothecadao/types";
import { Has, HasValue, runQuery } from "@dojoengine/recs";

export const getRandomRealmEntity = (components: ClientComponents) => {
  const realms = runQuery([
    Has(components.Structure),
    HasValue(components.Structure, { category: StructureType.Realm }),
  ]);

  if (realms.size === 0) {
    return;
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
    HasValue(components.Structure, { owner: address, category: StructureType.Realm }),
  ]);

  const realm = realms.values().next().value;

  return realm;
};
