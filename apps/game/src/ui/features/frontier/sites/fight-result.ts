import { type IconMeaning } from "@/ui/design-system/icon";

import { create } from "zustand";

import type { FightRecord, TroopsChange } from "./fight-record";
import type { AttackTargetKind } from "./site-marks";

/** How one attack ended: the army is gone, the guard is gone, or both still stand and the fight goes on. */
export type FightVerdict = "victory" | "army-lost" | "guard-holds";

/** The player's own attack as it leaves: who fights whom. */
export interface FightSent {
  /** The site attacked, or the other player's army. */
  targetId: number;
  site: AttackTargetKind;
  armyId: number;
  armyArt: IconMeaning;
  /** The army's whole troops as the attack leaves. */
  army: number;
  /** The realm the army answers to, whose stores take what a clear pays. */
  homeId: number;
  /** The XP the rules give for clearing this site; undefined for an army, which pays nothing. */
  clearXp: number | undefined;
}

/**
 * What a victory paid: the reward as the clear's own payout record names it (none for stragglers or a ruin), marked
 * when the store that received it stands at its limit, so some of it did not fit; and the clear's XP.
 */
export interface FightGain {
  pay: { icon: IconMeaning; amount: number; storeFull: boolean } | null;
  xp: number;
}

/** What one attack did, for its result: each side before and after, and what a clear paid. */
export interface FightResult {
  site: AttackTargetKind;
  verdict: FightVerdict;
  armyArt: IconMeaning;
  army: TroopsChange;
  /** The other side as the battle recorded it; null when no record of the battle reached this screen. */
  guard: TroopsChange | null;
  gained: FightGain | null;
}

/** A lost army is lost whatever is left of the other side; a victory needs the army standing and the guard gone. */
export const fightVerdict = (after: { army: number; guard: number }): FightVerdict =>
  after.army === 0 ? "army-lost" : after.guard === 0 ? "victory" : "guard-holds";

/**
 * The attack's result from the battle's own record: nothing here is read from what a row no longer says. Only a
 * victory gains, and what it gained is the caller's to read from the clear's own record.
 */
export const fightResultOf = (
  sent: FightSent,
  { army, guard }: FightRecord,
  gained: (sent: FightSent) => FightGain | null,
): FightResult => {
  const verdict = fightVerdict({ army: army.after, guard: guard.after });
  return {
    site: sent.site,
    verdict,
    armyArt: sent.armyArt,
    army,
    guard,
    gained: verdict === "victory" ? gained(sent) : null,
  };
};

/** The one thing known of a fight with no record once the army's own row is gone: the army was lost. */
export const lostArmyResult = (sent: FightSent): FightResult => ({
  site: sent.site,
  verdict: "army-lost",
  armyArt: sent.armyArt,
  army: { before: sent.army, after: 0 },
  guard: null,
  gained: null,
});

/**
 * An attack with no result to show, in the one line the card shows instead: the game refused it, it could not be
 * sent, or no answer came for it yet (the line then says it may still apply).
 */
interface FightRefusal {
  armyId: number;
  targetId: number;
  line: string;
}

/**
 * The acting surface's own state for the attack it sent: its result until the player closes it, or the reason it
 * never happened until the next attack. Both are set from the action's own outcome and never from a later change in
 * the game's rows. It is never a game fact, only what this screen shows of the fight it sent.
 */
const useFightStore = create<{ result: FightResult | null; refusal: FightRefusal | null }>(() => ({
  result: null,
  refusal: null,
}));

export const useFightResult = () => useFightStore((state) => state.result);
/** Why this army's last attack on this target did not happen, until it attacks again. */
export const useFightRefusal = (armyId: number | null, targetId: number): string | undefined =>
  useFightStore(({ refusal }) =>
    refusal && refusal.armyId === armyId && refusal.targetId === targetId ? refusal.line : undefined,
  );

/** An attack leaves: what the last one left on screen goes. */
export const fightIsSent = (): void => useFightStore.setState({ result: null, refusal: null });
/** The attack was refused, never sent or left unanswered: there is no fight to report, only that line. */
export const fightWasNotSent = (refusal: FightRefusal): void => useFightStore.setState({ refusal });
/** The attack was applied: its result stands until closed; null where another surface shows it or nothing is known. */
export const fightEnded = (result: FightResult | null): void => useFightStore.setState({ result });
export const closeFightResult = (): void => useFightStore.setState({ result: null });
