import { BigNumberish, shortString } from "starknet";
import { AtGates, Characteristics, Npc, Residents, Travelers } from "./types";
import { SEX, ROLES } from "./constants";
import { Entity, Has, HasValue, NotValue, QueryFragment, getComponentValue, runQuery } from "@dojoengine/recs";
import { useEntityQuery } from "@dojoengine/react";
import { getPosition } from "../../../../utils/utils";

const U2_MASK: bigint = BigInt(0x3);
const U8_MASK: bigint = BigInt(0xff);

const TWO_POW_8 = 0x100;
const TWO_POW_16 = 0x10000;

export const NPC_CONFIG_ID = BigInt("999999999999999990");

export const getTravelersNpcs = (
  realmId: bigint,
  realmEntityId: bigint,
  NpcComponent: any,
  EntityOwnerComponent: any,
  PositionComponent: any,
) => {
  const realmPosition = getPosition(realmId);
  let travelers: Travelers = getNpcsFromQuery(
    [
      Has(NpcComponent),
      HasValue(EntityOwnerComponent, { entity_owner_id: realmEntityId }),
      NotValue(NpcComponent, { current_realm_entity_id: realmEntityId }),
      NotValue(PositionComponent, { x: realmPosition.x, y: realmPosition.y }),
    ],
    NpcComponent,
  );
  return travelers;
};

export const getAtGatesNpcs = (
  realmId: bigint,
  realmEntityId: bigint,
  nextBlockTimestamp: number,
  NpcComponent: any,
  PositionComponent: any,
  ArrivalTime: any,
  EntityOwnerComponent: any,
): AtGates => {
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

  const natives: AtGates = getNpcsOnlyIfArrivedAtGates(potentialNatives, nextBlockTimestamp, true, ArrivalTime);

  const potentialForeigners = getNpcsFromQuery(
    [
      Has(NpcComponent),
      HasValue(PositionComponent, { x: realmPosition.x, y: realmPosition.y }),
      HasValue(NpcComponent, { current_realm_entity_id: 0n }),
      NotValue(EntityOwnerComponent, { entity_owner_id: realmEntityId }),
    ],
    NpcComponent,
  );
  const foreigners: AtGates = getNpcsOnlyIfArrivedAtGates(potentialForeigners, nextBlockTimestamp, false, ArrivalTime);

  return natives.concat(foreigners).sort((a, b) => Number(b!.arrival_time - a!.arrival_time));
};

export const alreadyArrivedAtGates = (
  npc: Npc,
  nextBlockTimestamp: number,
  ArrivalTimeComponent: any,
): { npc: Npc; arrival_time: bigint } | undefined => {
  const npcArrivalTimeEntityId = runQuery([HasValue(ArrivalTimeComponent, { entity_id: BigInt(npc.entityId) })]);
  const npcArrivalTime = getComponentValue(ArrivalTimeComponent, npcArrivalTimeEntityId.values().next().value);
  if (npcArrivalTime!.arrives_at <= nextBlockTimestamp) {
    return { npc, arrival_time: npcArrivalTime!.arrives_at };
  }
};

const getNpcsOnlyIfArrivedAtGates = (
  tempNpcs: Npc[],
  nextBlockTimestamp: number,
  native: boolean,
  ArrivalTime: any,
): AtGates => {
  const npcs: AtGates = tempNpcs.reduce((acc: AtGates, npc: Npc) => {
    const npcWithArrivalTimeAlreadyAtGate = alreadyArrivedAtGates(npc, nextBlockTimestamp, ArrivalTime);
    if (npcWithArrivalTimeAlreadyAtGate !== undefined) {
      acc.push({ ...npcWithArrivalTimeAlreadyAtGate, native });
    }
    return acc;
  }, []);
  return npcs;
};

export const getResidentNpcs = (realmEntityId: bigint, NpcComponent: any, EntityOwnerComponent: any): Residents => {
  let residents: Residents = { foreigners: [], natives: [] };
  residents.natives = getNpcsFromQuery(
    [
      HasValue(NpcComponent, { current_realm_entity_id: realmEntityId }),
      HasValue(EntityOwnerComponent, { entity_owner_id: realmEntityId }),
    ],
    NpcComponent,
  );
  residents.foreigners = getNpcsFromQuery(
    [
      HasValue(NpcComponent, { current_realm_entity_id: realmEntityId }),
      NotValue(EntityOwnerComponent, { entity_owner_id: realmEntityId }),
    ],
    NpcComponent,
  );
  return residents;
};

export const getNpcsFromQuery = (query: QueryFragment[], NpcComponent: any): Npc[] => {
  return Array.from(useEntityQuery(query)).map((npcEntityId) => getNpcFromEntityId(npcEntityId, NpcComponent));
};

const getNpcFromEntityId = (npcEntityId: Entity, NpcComponent: any): Npc => {
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
