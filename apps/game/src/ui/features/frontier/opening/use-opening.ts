import { identityClient, notificationOwnerOf, useIdentitySession } from "@/hooks/context/identity-session";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useNativeFacts } from "@/hooks/helpers/use-native-facts";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { OPENING_MOMENTS, type OpeningMoment, type OpeningRecord } from "@realms-world/identity";
import { useEffect, useMemo } from "react";
import { create } from "zustand";

import { momentsReached, OPENING_PARTS, type OpeningPart } from "./opening";

const OPENING_MODELS = [
  "StructureBuildings",
  "ExpeditionSite",
  "ExplorerTroops",
  "ArmySlot",
  "ArmyProgress",
  "TileOccupancy",
  "ResourceBalance",
  "ResourceProduction",
  "RealmKnowledge",
] as const;

interface OpeningState {
  /** The account whose record is read; none signed out. */
  owner: string | null;
  /** What the account keeps; null until it is read, or when it cannot be. */
  record: OpeningRecord | null;
  /**
   * The moments whose parts the HUD shows, or every part: outside Frontier's HUD, while watching or visiting, and
   * with Show everything.
   */
  opened: "all" | ReadonlySet<OpeningMoment>;
  /** The lines met this session and not yet put away, oldest first. */
  lines: OpeningMoment[];
}

export const useOpeningStore = create<OpeningState>(() => ({ owner: null, record: null, opened: "all", lines: [] }));

/** Whether the HUD shows a part now. */
export const useOpens = (part: OpeningPart): boolean =>
  useOpeningStore((state) => state.opened === "all" || state.opened.has(OPENING_PARTS[part]));

/** The line in front, and how it is put away; none while nothing new was met. */
export const useOpeningLine = (): { moment: OpeningMoment; putAway: () => void } | null => {
  const moment = useOpeningStore((state) => state.lines[0]);
  if (moment === undefined) return null;
  return {
    moment,
    putAway: () => useOpeningStore.setState((state) => ({ lines: state.lines.filter((line) => line !== moment) })),
  };
};

/** Show everything, as Settings changes it: kept on the account. */
export const setShowEverything = async (showAll: boolean): Promise<void> => {
  const { owner } = useOpeningStore.getState();
  if (!owner) return;
  if (showAll) useOpeningStore.setState({ lines: [] });
  accept(owner, await identityClient.saveInterfaceOpening({ owner, reach: [], showAll }));
};

/**
 * Opens Frontier's HUD as the player's realm has played (the one writer of what opens): the moments its facts show and
 * the moments the account kept. A moment first met is kept on the account and its line queued, so each line shows once
 * per account. An account's first record keeps without a line what a realm already shows beyond its launch: a player
 * who played before the interface opened meets no lines for what they had. The opening is the account's, so watching,
 * visiting or signed out (the lab), every part shows; while the account's record cannot be read, the realm's facts
 * alone open the HUD and no line is queued.
 */
export const useOpeningInterface = (realm: NativeRows["Structure"] | null) => {
  const { session } = useIdentitySession();
  const owner = notificationOwnerOf(session);
  const reachedNow = useReachedNow(owner ? realm : null);
  const { record } = useOpeningStore();
  useEffect(() => {
    void readOpening(owner);
  }, [owner]);
  useEffect(() => {
    useOpeningStore.setState({ opened: openedBy(reachedNow, record) });
  }, [reachedNow, record]);
  useEffect(() => {
    if (!owner || !record || !reachedNow) return;
    const met = reachedNow.filter((moment) => !record.reached.includes(moment));
    if (met.length === 0) return;
    void keepMoments(owner, met, record.showAll || isReturning(record, reachedNow) ? [] : met);
  }, [owner, record, reachedNow]);
  useEffect(() => {
    return () => useOpeningStore.setState({ opened: "all", lines: [] });
  }, []);
};

/** The moments the player's own realm shows now; none while watching or visiting. */
const useReachedNow = (realm: NativeRows["Structure"] | null): OpeningMoment[] | null => {
  const facts = useNativeFacts(OPENING_MODELS);
  const timestamp = useCurrentDefaultTick();
  // Read again on each change and tick, handed on as one array while the moments are the same ones.
  const key = useMemo(
    () => (realm ? momentsReached(facts.store, realm, timestamp).join() : null),
    [facts, realm, timestamp],
  );
  return useMemo(() => (key === null ? null : (key.split(",") as OpeningMoment[])), [key]);
};

const openedBy = (
  reachedNow: readonly OpeningMoment[] | null,
  record: OpeningRecord | null,
): OpeningState["opened"] => {
  if (!reachedNow || record?.showAll) return "all";
  return new Set([...reachedNow, ...(record?.reached ?? [])]);
};

/** An account with nothing kept whose realm already shows more than its launch played before the interface opened. */
const isReturning = (record: OpeningRecord, reachedNow: readonly OpeningMoment[]) =>
  record.reached.length === 0 && reachedNow.some((moment) => moment !== "launch");

const readOpening = async (owner: string | null): Promise<void> => {
  if (useOpeningStore.getState().owner === owner && useOpeningStore.getState().record) return;
  useOpeningStore.setState({ owner, record: null, lines: [] });
  if (!owner) return;
  try {
    accept(owner, await identityClient.getInterfaceOpening());
  } catch (error) {
    console.warn("interface opening unavailable", error);
  }
};

const keepMoments = async (owner: string, met: OpeningMoment[], lines: OpeningMoment[]): Promise<void> => {
  const record = useOpeningStore.getState().record;
  if (!record) return;
  // Kept here at once, so the line is queued once while the save is in flight.
  useOpeningStore.setState((state) => ({
    record: { ...record, reached: [...record.reached, ...met] },
    lines: [...state.lines, ...lines.filter((moment) => !state.lines.includes(moment))].toSorted(
      (a, b) => OPENING_MOMENTS.indexOf(a) - OPENING_MOMENTS.indexOf(b),
    ),
  }));
  try {
    accept(owner, await identityClient.saveInterfaceOpening({ owner, reach: met }));
  } catch (error) {
    console.warn("interface opening not kept", error);
  }
};

const accept = (owner: string, saved: OpeningRecord) => {
  if (useOpeningStore.getState().owner !== owner || saved.owner !== owner) return;
  useOpeningStore.setState((state) => ({
    record: {
      ...saved,
      // A moment kept here while the answer travelled stays kept.
      reached: [...new Set([...saved.reached, ...(state.record?.reached ?? [])])],
    },
  }));
};
