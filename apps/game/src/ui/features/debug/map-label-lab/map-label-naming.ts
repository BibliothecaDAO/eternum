import type { MapLabelEntity } from "@/three/debug/map-label-lab-fixture";

/**
 * How a thing no player named is called on the map, three ways for the owner to pick from. A realm and a hyperstructure
 * keep their own names in every scheme; only camps, rifts and armies (and, in production, mines, banks and other
 * unnamed structures) differ. Today the map reads the kind and the entity id ("Camp 12884901891").
 */
export const NAMING_SCHEMES = {
  owner: {
    name: "1 · By owner",
    line: "Whose it is: “djizus’s camp”, “Bandit camp” for an unowned one; an army by its owner, your own by its number.",
  },
  home: {
    name: "2 · By home realm",
    line: "The realm that raised it (the namespace its id was allocated in): “Camp of Hetokamohuti”, an army “Host of …”; an unowned one by its owner word. Stable when it changes hands.",
  },
  code: {
    name: "3 · Short code",
    line: "Its kind and a short code read off its id, home and serial: “Camp 19·21” (an unowned one’s home is 0). Unique and stable, but a code.",
  },
} as const;

export type NamingScheme = keyof typeof NAMING_SCHEMES;

const LOCAL_RANGE = 2 ** 32;

const KIND_WORD = { camp: "Camp", rift: "Rift", army: "Army" } as const;

/** The name a label shows for an entity under one scheme. */
export const labelName = (entity: MapLabelEntity, scheme: NamingScheme): string => {
  if (entity.kind === "realm" || entity.kind === "hyperstructure") return entity.name;
  const kind = KIND_WORD[entity.kind];
  switch (scheme) {
    case "owner":
      return ownerName(entity, kind);
    case "home":
      if (!entity.homeName) return ownerName(entity, kind);
      return entity.kind === "army" ? `Host of ${entity.homeName}` : `${kind} of ${entity.homeName}`;
    case "code":
      return `${kind} ${Math.floor(entity.entityId / LOCAL_RANGE)}·${entity.entityId % LOCAL_RANGE}`;
  }
};

const ownerName = (entity: MapLabelEntity, kind: string) => {
  if (entity.kind === "army" && entity.relation === "own" && entity.army) return `Army ${entity.army.number}`;
  if (entity.owner === null) return entity.kind === "rift" ? kind : `Bandit ${kind.toLowerCase()}`;
  return `${entity.owner}’s ${kind.toLowerCase()}`;
};
