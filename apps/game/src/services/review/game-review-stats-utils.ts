import type { HeraldHistoryEvent } from "@bibliothecadao/eternum/game-sync";
import { RESOURCE_PRECISION, StructureType } from "@bibliothecadao/types";

export interface GameReviewValueMetric {
  playerAddress: string;
  value: number;
  timestamp?: number;
}

interface GameReviewDerivedMetrics {
  timeToFirstT3Seconds: GameReviewValueMetric | null;
  timeToFirstHyperstructureSeconds: GameReviewValueMetric | null;
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

const story = (event: HeraldHistoryEvent, variant: string): Row | null => record(record(event.value.story)?.[variant]);

/** A native battle's troop losses per side, as the chain records them in BattleEvent: each side's before less after. */
export const readBattleLosses = (event: HeraldHistoryEvent) => {
  if (event.model !== "BattleEvent") return null;
  const attacker = record(event.value.attacker);
  const defender = record(event.value.defender);
  if (!attacker || !defender) return null;
  return {
    attacker: address(attacker.player),
    defender: address(defender.player),
    attackerLost: (number(attacker.before) - number(attacker.after)) / RESOURCE_PRECISION,
    defenderLost: (number(defender.before) - number(defender.after)) / RESOURCE_PRECISION,
  };
};

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

  // A capture story names the new owner; the structure's category comes from its row, which a capture never changes.
  const categories = new Map(
    input.structures.map((structure) => [number(structure.entity_id), number(record(structure.base)?.category)]),
  );
  const timeToFirstHyperstructureSeconds = firstMetric(input.storyEvents, input.gameStartAt, (event) => {
    const capture = story(event, "StructureCapturedStory");
    const owner = address(capture?.new_owner);
    const category = categories.get(number(event.value.entity_id));
    const timestamp = number(event.value.timestamp);
    return capture && owner && category === StructureType.Hyperstructure ? { owner, timestamp } : null;
  });

  const kills = new Map<string, number>();
  for (const event of input.storyEvents) {
    const losses = readBattleLosses(event);
    if (!losses) continue;
    increment(kills, losses.attacker, losses.defenderLost);
    increment(kills, losses.defender, losses.attackerLost);
  }

  const structures = new Map<string, number>();
  for (const structure of input.structures) increment(structures, address(structure.owner), 1);

  return {
    timeToFirstT3Seconds,
    timeToFirstHyperstructureSeconds,
    mostTroopsKilled: topMetric(kills),
    biggestStructuresOwned: topMetric(structures),
  };
};
