import { isDeepTile, type NativeFactStore } from "@bibliothecadao/eternum/game-client";
import type { HeraldHistoryEvent } from "@bibliothecadao/eternum/game-sync";
import { aspects, RESOURCE_PRECISION } from "@bibliothecadao/types";

/** One side of a Deep fight: the Aspect it fought for and the troops it brought and kept. */
export interface FightSide {
  aspect: string;
  before: number;
  after: number;
}

/** How a fight ended, from the troops each side kept: one side wiped, both standing, or both wiped. */
type FightOutcome = "attacker" | "defender" | "standoff" | "mutual";

/** A fight in the Deep between two players' armies that one of the player's Aspect's members was in, from Herald's battle history. */
export interface AspectFight {
  id: string;
  /** Chain time, in seconds. */
  at: number;
  attacker: FightSide;
  defender: FightSide;
  outcome: FightOutcome;
}

/** A side that kept no troops was wiped out. */
export const wipedOut = (side: FightSide): boolean => side.after === 0;

/** The outcome as the day log reads a fight: by the troops each side kept, never by an owner id the emitter fills. */
const outcomeOf = (attacker: Pick<FightSide, "after">, defender: Pick<FightSide, "after">): FightOutcome =>
  attacker.after === 0 && defender.after === 0
    ? "mutual"
    : defender.after === 0
      ? "attacker"
      : attacker.after === 0
        ? "defender"
        : "standoff";

const troops = (amount: unknown): number => Number(BigInt(String(amount))) / RESOURCE_PRECISION;

function sideOf(
  store: NativeFactStore,
  game_id: number,
  home: bigint,
  report: Record<string, unknown>,
): FightSide | undefined {
  const aspect = aspects.find((candidate) => candidate.id === store.get("HomeAspect", { game_id, home })?.aspect);
  if (!aspect) return undefined;
  return { aspect: aspect.name, before: troops(report.before), after: troops(report.after) };
}

/** A battle between two players' armies on a tile of the Deep (a neutral beast's owner is 0). */
const isPlayerDeepFight = (spacing: number, { value }: Pick<HeraldHistoryEvent, "value">): boolean => {
  const { x, y, alt } = value.coord as { x: unknown; y: unknown; alt: boolean };
  return (
    isDeepTile(spacing, { col: Number(x), row: Number(y), alt }) &&
    BigInt(String(value.attacker_owner)) !== 0n &&
    BigInt(String(value.defender_owner)) !== 0n
  );
};

/** One page of Herald's battle history, newest first, and how many battles it holds in all. */
type BattlePage = { items: readonly HeraldHistoryEvent[]; total: number };

/**
 * The newest battles until `want` of them are player fights in the Deep, or the history ends: the filter runs before the
 * window closes, so fights elsewhere on the map never push a Deep fight out of the feed.
 */
export async function readDeepFightWindow(
  page: (offset: number) => Promise<BattlePage>,
  spacing: number,
  want: number,
  pageSize: number,
): Promise<HeraldHistoryEvent[]> {
  const battles: HeraldHistoryEvent[] = [];
  let deep = 0;
  for (let offset = 0; deep < want; offset += pageSize) {
    const read = await page(offset);
    battles.push(...read.items);
    deep += read.items.filter((battle) => isPlayerDeepFight(spacing, battle)).length;
    if (read.items.length === 0 || offset + pageSize >= read.total) break;
  }
  return battles;
}

/** The fights read, and how many of the Deep's player fights have a side the store cannot yet name an Aspect for. */
interface AspectFights {
  fights: AspectFight[];
  unnamed: number;
}

/**
 * The player fights in the Deep among the battles, as Herald lists them: a fight elsewhere on the map is not the Aspect's,
 * and a site's neutral beast (owner 0) has no Aspect to name. A fight whose sides' Aspects the store cannot name is
 * counted in `unnamed`, never given an Aspect it does not have and never passed over as if it had not happened.
 */
export function aspectFights(
  store: NativeFactStore,
  game_id: number,
  battles: readonly HeraldHistoryEvent[],
): AspectFights {
  const { spacing } = store.require("SettlementRules", { game_id });
  const fights: AspectFight[] = [];
  let unnamed = 0;
  for (const { value, transaction_hash, event_index } of battles) {
    if (!isPlayerDeepFight(spacing, { value })) continue;
    const [attackerHome, defenderHome] = [BigInt(String(value.attacker_owner)), BigInt(String(value.defender_owner))];
    const attacker = sideOf(store, game_id, attackerHome, value.attacker as Record<string, unknown>);
    const defender = sideOf(store, game_id, defenderHome, value.defender as Record<string, unknown>);
    if (!attacker || !defender) {
      unnamed++;
      continue;
    }
    fights.push({
      id: `${transaction_hash}:${event_index}`,
      at: Number(BigInt(String(value.timestamp))),
      attacker,
      defender,
      outcome: outcomeOf(attacker, defender),
    });
  }
  return { fights, unnamed };
}
