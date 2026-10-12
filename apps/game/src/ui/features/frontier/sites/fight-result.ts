import type { IconCode } from "@/ui/design-system/kit/kit-icon";
import { type SiteKind } from "@bibliothecadao/eternum";
import { create } from "zustand";

/** How one attack ended: the guard is gone, the army is gone, or both still stand and the fight goes on. */
export type FightVerdict = "victory" | "army-lost" | "guard-holds";

/** The player's own attack as it was sent: who fought, with what, and what the clear would pay. */
export interface FightSent {
  siteId: number;
  site: SiteKind;
  armyId: number;
  armyArt: string;
  /** Whole troops on each side as the attack was sent. */
  army: number;
  guard: number;
  /** What clearing the site pays: what fits home and the XP, as the preview showed them. */
  clearPays: { pay: { icon: IconCode; amount: number } | null; xp: number };
}

/** Whole troops on each side now; an army that is gone has none. */
export interface FightSides {
  army: number;
  guard: number;
}

/** What one attack did, for its result: each side before and after, and what a clear paid. */
export interface FightResult {
  site: SiteKind;
  verdict: FightVerdict;
  armyArt: string;
  army: { before: number; after: number };
  guard: { before: number; after: number };
  gained: FightSent["clearPays"] | null;
}

export const fightVerdict = (after: FightSides): FightVerdict =>
  after.guard === 0 ? "victory" : after.army === 0 ? "army-lost" : "guard-holds";

/**
 * The attack's result once the facts carry it: nothing while both sides still read as they were sent. The result is
 * the entity diff around the player's own attack; no event has to arrive for it.
 */
export const readFightResult = (sent: FightSent, now: FightSides): FightResult | null => {
  if (now.army === sent.army && now.guard === sent.guard) return null;
  const verdict = fightVerdict(now);
  return {
    site: sent.site,
    verdict,
    armyArt: sent.armyArt,
    army: { before: sent.army, after: now.army },
    guard: { before: sent.guard, after: now.guard },
    gained: verdict === "victory" ? sent.clearPays : null,
  };
};

/**
 * The acting surface's own state for its attack: the attack in flight, then its result until the player closes it.
 * It is never a game fact, only what this screen shows of the fight it sent.
 */
const useFightStore = create<{ sent: FightSent | null; result: FightResult | null }>(() => ({
  sent: null,
  result: null,
}));

export const useFightSent = () => useFightStore((state) => state.sent);
export const useFightResult = () => useFightStore((state) => state.result);

export const fightIsSent = (sent: FightSent): void => useFightStore.setState({ sent, result: null });
/** The attack never left (the send failed): there is no fight to report. */
export const fightWasNotSent = (): void => useFightStore.setState({ sent: null });
export const fightEnded = (result: FightResult | null): void => useFightStore.setState({ sent: null, result });
export const closeFightResult = (): void => useFightStore.setState({ result: null });
