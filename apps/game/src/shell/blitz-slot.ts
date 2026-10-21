import { useQuery } from "@tanstack/react-query";

import { fetchApi } from "@/runtime/app-api";

import type { NextBlitzGame } from "../../../launch-service/src/calendar";
import type { PlaytestSlot } from "../../../launch-service/src/slots";

export type { NextBlitzGame, PlaytestSlot };

/** A Blitz game's roster. */
export const BLITZ_SEATS = 24;

/**
 * The slots still taking players and those just closed, as the launch service lists them under the app's own /api.
 * Only the operator opens one; the client only reads the list.
 */
const fetchPlaytestSlots = async (): Promise<{ slots: PlaytestSlot[] }> => {
  const response = await fetchApi("/api/slots", { credentials: "include" });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? `Slots answered ${response.status}`);
  return payload;
};

export const usePlaytestSlots = () =>
  useQuery({ queryKey: ["playtestSlots"], queryFn: fetchPlaytestSlots, refetchInterval: 3_000 });

/**
 * The next Blitz game the launch service's schedule opens, from its season calendar (`nextBlitz`): null when its Blitz
 * window has no game left. The client never derives the timetable; a calendar that names no next game is a failure.
 */
const fetchNextBlitz = async (): Promise<NextBlitzGame | null> => {
  const response = await fetchApi("/api/factory/calendar");
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? `Calendar answered ${response.status}`);
  if (!("nextBlitz" in payload)) throw new Error("The calendar names no next Blitz");
  return payload.nextBlitz;
};

export const useNextBlitz = () =>
  useQuery({ queryKey: ["nextBlitz"], queryFn: fetchNextBlitz, refetchInterval: 60_000 });
