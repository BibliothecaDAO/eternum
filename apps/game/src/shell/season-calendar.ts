import { useQuery } from "@tanstack/react-query";

import { fetchApi } from "@/runtime/app-api";

import type { SeasonPhase } from "../../../launch-service/src/calendar";

export type { SeasonPhase };

export type SeasonCalendar = { phases: SeasonPhase[] };

const fetchSeasonCalendar = async (): Promise<SeasonCalendar> => {
  const response = await fetchApi("/api/factory/calendar");
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? `Calendar answered ${response.status}`);
  if (!Array.isArray(payload.phases)) throw new Error("The calendar lists no phases");
  return { phases: payload.phases };
};

export const useSeasonCalendar = () =>
  useQuery({ queryKey: ["seasonCalendar"], queryFn: fetchSeasonCalendar, refetchInterval: 60_000 });
