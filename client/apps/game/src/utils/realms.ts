import { ClientComponents, ContractAddress, StructureType } from "@bibliothecadao/eternum";
import { Has, HasValue, runQuery } from "@dojoengine/recs";
import { Query, ToriiClient } from "@dojoengine/torii-wasm";

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

export const getRandomRealmWithVillageSlots = async (toriiClient: ToriiClient) => {
  const query: Query = {
    limit: 1,
    offset: 0,
    clause: {
      Member: {
        model: "Structure",
        member: "metadata.villages_count",
        operator: "Lte",
        value: { Primitive: { U8: 5 } },
      },
    },
    dont_include_hashed_keys: false,
    order_by: [],
    entity_models: ["Structure"],
    entity_updated_after: 0,
  };

  const entities = await toriiClient.getEntities(query);

  // Filter for realms (category = StructureType.Realm)
  const realms = Object.values(entities).filter(
    (entity) => entity.Structure && entity.Structure.category.value === StructureType.Realm,
  );

  if (realms.length === 0) {
    return null;
  }

  // Select a random realm
  const randomIndex = Math.floor(Math.random() * realms.length);
  return realms[randomIndex];
};
