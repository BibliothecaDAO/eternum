import { BigNumberish, shortString } from "starknet";
import { Characteristics, Npc, Villager, VillagerType } from "./types";
import { SEX, ROLES } from "./constants";
import { Entity, Has, HasValue, NotValue, QueryFragment, getComponentValue, runQuery } from "@dojoengine/recs";
import { useEntityQuery } from "@dojoengine/react";
import { getPosition } from "../../../../utils/utils";

const U2_MASK: bigint = BigInt(0x3);
const U8_MASK: bigint = BigInt(0xff);

const TWO_POW_8 = 0x100;
const TWO_POW_16 = 0x10000;

export const NPC_CONFIG_ID = 999999999999999989n;

export const useTravelersNpcs = (
  realmId: bigint,
  realmEntityId: bigint,
  NpcComponent: any,
  EntityOwnerComponent: any,
  PositionComponent: any,
): Villager[] => {
  const realmPosition = getPosition(realmId);
  let travelers: Npc[] = getNpcsFromQuery(
    [
      Has(NpcComponent),
      HasValue(EntityOwnerComponent, { entity_owner_id: realmEntityId }),
      NotValue(NpcComponent, { current_realm_entity_id: realmEntityId }),
      NotValue(PositionComponent, { x: realmPosition.x, y: realmPosition.y }),
    ],
    NpcComponent,
  );
  const villagers: Villager[] = travelers.map((npc) => ({
    npc: npc,
    type: VillagerType.Traveler,
    native: true,
  }));

  return villagers;
};

export const useAtGatesNpcs = (
  realmId: bigint,
  realmEntityId: bigint,
  nextBlockTimestamp: number,
  NpcComponent: any,
  PositionComponent: any,
  ArrivalTime: any,
  EntityOwnerComponent: any,
): Villager[] => {
  const realmPosition = getPosition(realmId);

  const potentialNatives = getNpcsFromQuery(
    [
      Has(NpcComponent),
      HasValue(PositionComponent, { x: realmPosition.x, y: realmPosition.y }),
      HasValue(NpcComponent, { current_realm_entity_id: 0n }),
      HasValue(EntityOwnerComponent, { entity_owner_id: realmEntityId }),
    ],
    NpcComponent,
  );

  const natives: Villager[] = getNpcsOnlyIfArrivedAtGates(potentialNatives, nextBlockTimestamp, true, ArrivalTime);

  const potentialForeigners = getNpcsFromQuery(
    [
      Has(NpcComponent),
      HasValue(PositionComponent, { x: realmPosition.x, y: realmPosition.y }),
      HasValue(NpcComponent, { current_realm_entity_id: 0n }),
      NotValue(EntityOwnerComponent, { entity_owner_id: realmEntityId }),
    ],
    NpcComponent,
  );
  const foreigners: Villager[] = getNpcsOnlyIfArrivedAtGates(
    potentialForeigners,
    nextBlockTimestamp,
    false,
    ArrivalTime,
  );

  return natives.concat(foreigners);
};

export const alreadyArrivedAtGates = (
  npc: Npc,
  nextBlockTimestamp: number,
  ArrivalTimeComponent: any,
): Npc | undefined => {
  const npcArrivalTimeEntityId = runQuery([HasValue(ArrivalTimeComponent, { entity_id: BigInt(npc.entityId) })]);
  const npcArrivalTime = getComponentValue(ArrivalTimeComponent, npcArrivalTimeEntityId.values().next().value);
  if (npcArrivalTime!.arrives_at <= nextBlockTimestamp) {
    return npc;
  }
};

const getNpcsOnlyIfArrivedAtGates = (
  tempNpcs: Npc[],
  nextBlockTimestamp: number,
  native: boolean,
  ArrivalTime: any,
): Villager[] => {
  const npcs: Villager[] = tempNpcs.reduce((acc: Villager[], npc: Npc) => {
    const npcWithArrivalTimeAlreadyAtGate = alreadyArrivedAtGates(npc, nextBlockTimestamp, ArrivalTime);
    if (npcWithArrivalTimeAlreadyAtGate !== undefined) {
      acc.push({ npc: npcWithArrivalTimeAlreadyAtGate, type: VillagerType.AtGates, native });
    }
    return acc;
  }, []);
  return npcs;
};

export const useResidentsNpcs = (realmEntityId: bigint, NpcComponent: any, EntityOwnerComponent: any): Villager[] => {
  const natives = getNpcsFromQuery(
    [
      HasValue(NpcComponent, { current_realm_entity_id: realmEntityId }),
      HasValue(EntityOwnerComponent, { entity_owner_id: realmEntityId }),
    ],
    NpcComponent,
  );

  const nativeAsVillagers = natives.map((npc) => ({
    npc: npc,
    type: VillagerType.Resident,
    native: true,
  }));

  const foreigners = getNpcsFromQuery(
    [
      HasValue(NpcComponent, { current_realm_entity_id: realmEntityId }),
      NotValue(EntityOwnerComponent, { entity_owner_id: realmEntityId }),
    ],
    NpcComponent,
  );

  const foreignersAsVillagers = foreigners.map((npc) => ({
    npc: npc,
    type: VillagerType.Resident,
    native: false,
  }));

  return nativeAsVillagers.concat(foreignersAsVillagers);
};

export const getNpcsFromQuery = (query: QueryFragment[], NpcComponent: any): Npc[] => {
  return Array.from(useEntityQuery(query)).map((npcEntityId) => getNpcFromEntityId(npcEntityId, NpcComponent));
};

export const getNpcFromEntityId = (npcEntityId: Entity, NpcComponent: any): Npc => {
  const npcEntity = getComponentValue(NpcComponent, npcEntityId);
  return {
    entityId: npcEntity!.entity_id,
    currentRealmEntityId: npcEntity!.current_realm_entity_id,
    characteristics: unpackCharacteristics(npcEntity!.characteristics),
    characterTrait: shortString.decodeShortString(npcEntity!.character_trait.toString()),
    fullName: shortString.decodeShortString(npcEntity!.full_name.toString()),
  };
};

export const useArrivalTimeByEntityId = (entityId: BigNumberish, ArrivalTime: any): number => {
  const npcArrivalTimeEntityId = useEntityQuery([HasValue(ArrivalTime, { entity_id: BigInt(entityId) })]);
  const npcArrivalTime = getComponentValue(ArrivalTime, npcArrivalTimeEntityId.values().next().value);
  return npcArrivalTime!.arrives_at;
};

export const scrollToElement = (bottomRef: React.RefObject<HTMLDivElement>) => {
  setTimeout(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, 1);
};

export const unpackCharacteristics = (characteristics: bigint): Characteristics => {
  const age = characteristics & U8_MASK;
  characteristics = characteristics >> BigInt(8);
  const role = characteristics & U8_MASK;
  characteristics = characteristics >> BigInt(8);
  const sex = characteristics & U2_MASK;

  return {
    age: Number(age),
    role: ROLES[Number(role)],
    sex: SEX[Number(sex)],
  };
};

export const packCharacteristics = ({ age, role, sex }: any): BigNumberish => {
  const packed = age + role * TWO_POW_8 + sex * TWO_POW_16;
  return packed;
};

export function keysSnakeToCamel(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map((item) => (typeof item === "object" && item !== null ? keysSnakeToCamel(item) : item));
  } else if (typeof obj === "object" && obj !== null) {
    const newObj: Record<string, any> = {};
    Object.keys(obj).forEach((key) => {
      const camelCaseKey = snakeToCamel(key);
      newObj[camelCaseKey] = keysSnakeToCamel(obj[key]); // Apply conversion recursively
    });
    return newObj;
  }
  // Return the value directly if it's neither an object nor an array
  return obj;
}

function snakeToCamel(s: string): string {
  return s.replace(/(_\w)/g, (m) => m[1].toUpperCase());
}

export function getNpcImagePath(npc: Npc | null): string {
  if (npc === null) {
    return "";
  }
  const role_path = npc.characteristics.role.toLowerCase() + "/";
  const sex_path = npc.characteristics.sex + "/";
  const age_path = getAgeRange(npc.characteristics.age);

  return "/images/npc/" + role_path + sex_path + age_path + ".png";
}

function getAgeRange(age: number): string {
  if (age < 26) return "15-25";
  else if (age < 36) return "26-35";
  else if (age < 46) return "36-45";
  else if (age < 56) return "46-55";
  else return "56-65";
}