import { type SentCommand, untilApplied } from "@/sync/action-outcome";
import type { BuildingType } from "@bibliothecadao/types";
import { useMemo } from "react";
import { create } from "zustand";

/** The order an army has in flight. */
export type OrderInFlight = "explore" | "move" | "attack" | "use";

/** An army's order in flight and, for one that takes it to a tile, that tile (a scene hex). */
type ArmyOrderInFlight = { order: OrderInFlight; to?: { col: number; row: number } };

/**
 * What an action is sent for, and what the place that shows it needs to draw it while it is in flight. One action at
 * a time for each: an army's order, a plot's building, a realm's next army, a research row, a castle's level, an
 * army's refill, an army's tier, a transfer's shipment from one holding to another.
 */
interface InFlight {
  army: ArmyOrderInFlight;
  plot: { type: BuildingType; plot: { col: number; row: number } };
  deploy: number;
  research: true;
  castle: true;
  refill: true;
  tier: true;
  shipment: true;
}
type Subject = keyof InFlight;
type Key = string | number;

/**
 * The acting surfaces' own state for the actions they sent: what is in flight, sent from this screen, its outcome not
 * known yet. Until that action's own outcome arrives (applied, refused with its reason, or unanswered) its control
 * cannot be pressed again, wherever the player looks for it. It is never a game fact.
 */
const useActionsInFlight = create<{ flights: ReadonlyMap<string, unknown> }>(() => ({ flights: new Map() }));

const idOf = (subject: Subject, key: Key): string => `${subject}:${key}`;

export const useInFlight = <S extends Subject>(subject: S, key: Key | null): InFlight[S] | undefined =>
  useActionsInFlight((state) =>
    key === null ? undefined : (state.flights.get(idOf(subject, key)) as InFlight[S] | undefined),
  );

export const inFlight = <S extends Subject>(subject: S, key: Key): InFlight[S] | undefined =>
  useActionsInFlight.getState().flights.get(idOf(subject, key)) as InFlight[S] | undefined;

/** Every action in flight for one kind of subject, by its key: a list reads each of its rows from it. */
export const useAllInFlight = <S extends Subject>(subject: S): ReadonlyMap<string, InFlight[S]> => {
  const flights = useActionsInFlight((state) => state.flights);
  return useMemo(() => {
    const prefix = `${subject}:`;
    const ofSubject = [...flights].filter(([id]) => id.startsWith(prefix));
    return new Map(ofSubject.map(([id, what]) => [id.slice(prefix.length), what as InFlight[S]]));
  }, [flights, subject]);
};

/** Hears each action as it goes in flight for one kind of subject, by its key, with what it is. */
export const onSent = <S extends Subject>(subject: S, heard: (key: string, what: InFlight[S]) => void): (() => void) =>
  useActionsInFlight.subscribe(({ flights }, { flights: before }) => {
    const prefix = `${subject}:`;
    for (const [id, what] of flights)
      if (id.startsWith(prefix) && !before.has(id)) heard(id.slice(prefix.length), what as InFlight[S]);
  });

/**
 * Hears each outcome for one kind of subject, by its key: the action is no longer in flight (applied, refused or
 * unanswered), and a surface that held its subject can offer it again.
 */
export const onOutcome = (subject: Subject, heard: (key: string) => void): (() => void) =>
  useActionsInFlight.subscribe(({ flights }, { flights: before }) => {
    const prefix = `${subject}:`;
    for (const id of before.keys()) if (id.startsWith(prefix) && !flights.has(id)) heard(id.slice(prefix.length));
  });

/**
 * Sends an action, the one way any surface does: one at a time for its subject, held in flight until the action's
 * own outcome. Resolves with the action's transaction once the game has applied it, and with null, sending nothing,
 * when the subject already has an action in flight: a second press on the same control, or another surface's action
 * for the same subject, never becomes a second transaction. Rejects with the reason when the action was refused,
 * could not be sent, or got no answer; either way the subject is free again.
 */
export const sendOnce = async <S extends Subject>(
  subject: S,
  key: Key,
  what: InFlight[S],
  send: () => Promise<SentCommand>,
): Promise<string | null> => {
  const id = idOf(subject, key);
  if (!take(id, what)) return null;
  try {
    return await untilApplied(send());
  } finally {
    free(id);
  }
};

const take = (id: string, what: unknown): boolean => {
  const { flights } = useActionsInFlight.getState();
  if (flights.has(id)) return false;
  useActionsInFlight.setState({ flights: new Map(flights).set(id, what) });
  return true;
};

const free = (id: string): void => {
  const flights = new Map(useActionsInFlight.getState().flights);
  if (flights.delete(id)) useActionsInFlight.setState({ flights });
};
