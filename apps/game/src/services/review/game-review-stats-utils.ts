import type { HeraldHistoryEvent } from "@bibliothecadao/eternum/game-sync";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";

export interface GameReviewValueMetric {
  playerAddress: string;
  value: number;
  timestamp?: number;
}

interface GameReviewDerivedMetrics {
  timeToFirstT3Seconds: GameReviewValueMetric | null;
  timeToFirstHyperstructureSeconds: GameReviewValueMetric | null;
  firstBlood: GameReviewValueMetric | null;
  mostTroopsKilled: GameReviewValueMetric | null;
  biggestStructuresOwned: GameReviewValueMetric | null;
}

type Row = Record<string, unknown>;

const record = (value: unknown): Row | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Row) : null;

const toBigInt = (value: unknown): bigint | null => {
  if (!["bigint", "number", "string"].includes(typeof value)) return null;
  try {
    return BigInt(value as string | number | bigint);
  } catch {
    return null;
  }
};

const address = (value: unknown): string | null => {
  const parsed = toBigInt(value);
  return parsed !== null && parsed > 0n ? `0x${parsed.toString(16)}` : null;
};

const number = (value: unknown): number => {
  const parsed = toBigInt(value);
  if (parsed === null) return 0;
  const result = Number(parsed);
  return Number.isFinite(result) ? result : 0;
};

const scaled = (value: unknown): number => number(value) / RESOURCE_PRECISION;

const bool = (value: unknown): boolean => value === true || value === 1n || value === "0x1" || value === 1;

const story = (event: HeraldHistoryEvent, variant: string): Row | null => record(record(event.value.story)?.[variant]);

const firstMetric = (
  events: readonly HeraldHistoryEvent[],
  gameStartAt: number,
  select: (event: HeraldHistoryEvent) => { owner: string; timestamp: number } | null,
): GameReviewValueMetric | null => {
  const match = events
    .flatMap((event) => {
      const selected = select(event);
      return selected ? [selected] : [];
    })
    .toSorted((left, right) => left.timestamp - right.timestamp)[0];
  if (!match || match.timestamp < gameStartAt) return null;
  return { playerAddress: match.owner, timestamp: match.timestamp, value: match.timestamp - gameStartAt };
};

const topMetric = (values: Map<string, number>): GameReviewValueMetric | null => {
  const top = [...values.entries()]
    .filter(([, value]) => value > 0)
    .toSorted(
      ([leftAddress, left], [rightAddress, right]) => right - left || leftAddress.localeCompare(rightAddress),
    )[0];
  return top ? { playerAddress: top[0], value: top[1] } : null;
};

const increment = (values: Map<string, number>, owner: string | null, value: number): void => {
  if (owner && Number.isFinite(value) && value > 0) values.set(owner, (values.get(owner) ?? 0) + value);
};

export const buildGameReviewDerivedMetrics = (input: {
  gameStartAt: number;
  storyEvents: readonly HeraldHistoryEvent[];
  structures: readonly Row[];
}): GameReviewDerivedMetrics => {
  const timeToFirstT3Seconds = firstMetric(input.storyEvents, input.gameStartAt, (event) => {
    const creation = story(event, "ExplorerCreateStory");
    const owner = address(event.value.owner);
    const tier = String(creation?.tier ?? "").toUpperCase();
    const timestamp = number(event.value.timestamp);
    return creation && owner && (tier === "T3" || tier === "2" || tier === "3") ? { owner, timestamp } : null;
  });

  const timeToFirstHyperstructureSeconds = firstMetric(input.storyEvents, input.gameStartAt, (event) => {
    const battle = story(event, "BattleStory");
    const defender = record(battle?.defender_structure);
    const owner = address(battle?.attacker_owner_address);
    const category = number(defender?.structure_category);
    const timestamp = number(event.value.timestamp);
    return battle && owner && bool(defender?.structure_taken) && category === 2 ? { owner, timestamp } : null;
  });

  const firstBlood = firstMetric(input.storyEvents, input.gameStartAt, (event) => {
    const battle = story(event, "BattleStory");
    const defender = record(battle?.defender_structure);
    const attacker = address(battle?.attacker_owner_address);
    const defenderOwner = address(battle?.defender_owner_address);
    const timestamp = number(event.value.timestamp);
    return battle &&
      attacker &&
      defenderOwner &&
      attacker !== defenderOwner &&
      bool(defender?.structure_taken) &&
      number(defender?.structure_category) === 1
      ? { owner: attacker, timestamp }
      : null;
  });

  const kills = new Map<string, number>();
  for (const event of input.storyEvents) {
    const battle = story(event, "BattleStory");
    if (!battle) continue;
    increment(kills, address(battle.attacker_owner_address), scaled(battle.defender_troops_lost));
    increment(kills, address(battle.defender_owner_address), scaled(battle.attacker_troops_lost));
  }

  const structures = new Map<string, number>();
  for (const structure of input.structures) increment(structures, address(structure.owner), 1);

  return {
    timeToFirstT3Seconds,
    timeToFirstHyperstructureSeconds,
    firstBlood,
    mostTroopsKilled: topMetric(kills),
    biggestStructuresOwned: topMetric(structures),
  };
};
