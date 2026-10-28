import { create } from "zustand";

/**
 * An attack with no fight to report, in the one line the card shows instead: the game refused it, it could not be
 * sent, or no answer came for it yet (the line then says it may still apply).
 */
interface FightRefusal {
  armyId: number;
  targetId: number;
  line: string;
}

/**
 * The acting surface's own state for the attack it sent: why it never happened, until the next attack. It is set from
 * the action's own outcome, never from a later change in the game's rows, and is never a game fact. How a fight ended
 * is the Feed's to tell (owner, 27 October 2026: "the post fight cards are pretty useless").
 */
const useFightRefusalStore = create<{ refusal: FightRefusal | null }>(() => ({ refusal: null }));

/** Why this army's last attack on this target did not happen, until it attacks again. */
export const useFightRefusal = (armyId: number | null, targetId: number): string | undefined =>
  useFightRefusalStore(({ refusal }) =>
    refusal && refusal.armyId === armyId && refusal.targetId === targetId ? refusal.line : undefined,
  );

/** An attack leaves: the last one's refusal goes. */
export const fightIsSent = (): void => useFightRefusalStore.setState({ refusal: null });
/** The attack was refused, never sent or left unanswered: there is no fight to report, only that line. */
export const fightWasNotSent = (refusal: FightRefusal): void => useFightRefusalStore.setState({ refusal });
