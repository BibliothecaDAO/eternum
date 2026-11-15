import { isDeepTile, type NativeFactStore } from "@bibliothecadao/eternum/game-client";
import type { HeraldHistoryEvent } from "@bibliothecadao/eternum/game-sync";
import { aspects, RESOURCE_PRECISION } from "@bibliothecadao/types";

/** One side of a Deep fight: the Aspect it fought for and the troops it brought and kept. */
export interface FightSide {
  aspect: string;
  before: number;
  after: number;
}

/** A fight in the Deep that one of the player's Aspect's members was in, read from Herald's immutable battle history. */
export interface AspectFight {
  id: string;
  /** Chain time, in seconds. */
  at: number;
  attacker: FightSide;
  defender: FightSide;
  attackerWon: boolean;
}

/** A side that kept no troops was wiped out. */
export const wipedOut = (side: FightSide): boolean => side.after === 0;

const troops = (amount: unknown): number => Number(BigInt(String(amount))) / RESOURCE_PRECISION;

function sideOf(store: NativeFactStore, game_id: number, home: unknown, report: Record<string, unknown>): FightSide {
  const membership = store.get("HomeAspect", { game_id, home: BigInt(String(home)) });
  const aspect = aspects.find((candidate) => candidate.id === membership?.aspect);
  if (!aspect) throw new Error(`Fight has no Aspect for home ${String(home)}`);
  return { aspect: aspect.name, before: troops(report.before), after: troops(report.after) };
}

/** The Deep fights among the battles, newest first as Herald lists them: a fight elsewhere on the map is not the Aspect's. */
export function aspectFights(
  store: NativeFactStore,
  game_id: number,
  battles: readonly HeraldHistoryEvent[],
): AspectFight[] {
  const { spacing } = store.require("SettlementRules", { game_id });
  return battles
    .filter(({ value }) => {
      const { x, y, alt } = value.coord as { x: unknown; y: unknown; alt: boolean };
      return isDeepTile(spacing, { col: Number(x), row: Number(y), alt });
    })
    .map(({ value, transaction_hash, event_index }) => ({
      id: `${transaction_hash}:${event_index}`,
      at: Number(BigInt(String(value.timestamp))),
      attacker: sideOf(store, game_id, value.attacker_owner, value.attacker as Record<string, unknown>),
      defender: sideOf(store, game_id, value.defender_owner, value.defender as Record<string, unknown>),
      attackerWon: BigInt(String(value.winner_id)) === BigInt(String(value.attacker_id)),
    }));
}
