import { useQuery } from "@tanstack/react-query";

import { fetchApi } from "@/runtime/app-api";

import type { PlaytestSlot } from "../../../launch-service/src/slots";

export type { PlaytestSlot };

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
