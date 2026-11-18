import { useQuery } from "@tanstack/react-query";

import { fetchApi } from "@/runtime/app-api";

import type { NextBlitzGame, SeasonPhase } from "../../../launch-service/src/calendar";
import type { PlaytestSlot } from "../../../launch-service/src/slots";

export type { NextBlitzGame, PlaytestSlot, SeasonPhase };

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

export type SeasonCalendar = { phases: SeasonPhase[]; nextBlitz: NextBlitzGame | null };

const fetchSeasonCalendar = async (): Promise<SeasonCalendar> => {
  const response = await fetchApi("/api/factory/calendar");
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? `Calendar answered ${response.status}`);
  if (!Array.isArray(payload.phases)) throw new Error("The calendar lists no phases");
  if (!("nextBlitz" in payload)) throw new Error("The calendar names no next Blitz");
  return { phases: payload.phases, nextBlitz: payload.nextBlitz };
};

export const useSeasonCalendar = () =>
  useQuery({ queryKey: ["seasonCalendar"], queryFn: fetchSeasonCalendar, refetchInterval: 60_000 });
