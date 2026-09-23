import { identityOrigin } from "@/hooks/context/identity-session";
import type { PlaytestSlot } from "../../../../../../../apps/launch-service/src/slots";
import type { toFactoryRunRecord } from "../../../../../../../apps/launch-service/src/model";
export type { PlaytestSlot };
type FactoryRun = ReturnType<typeof toFactoryRunRecord>;

/** The launch routes are served beside identity, on its origin, so the session cookie reaches them. */
async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${identityOrigin()}${path}`, {
    method: body === undefined ? "GET" : "POST",
    credentials: "include",
    ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? `Launch request failed (${response.status})`);
  return payload as T;
}

export const fetchPlaytestSlots = () => request<{ slots: PlaytestSlot[] }>("/api/slots");
export const registerPlaytestSlot = (name: string) =>
  request<PlaytestSlot>(`/api/slots/${encodeURIComponent(name)}/register`, {});
export const fetchFactoryRuns = (environment: "madara.blitz" | "madara.eternum" | "madara.frontier") =>
  request<{ runs: FactoryRun[] }>(`/api/factory/runs?environment=${environment}`);
export const createEternumGame = (gameName: string, gameStartTime: string) =>
  request<FactoryRun>("/api/factory/runs", {
    environment: "madara.eternum",
    gameName,
    gameStartTime,
    version: "3",
    devModeOn: false,
  });
export const retryFactoryRun = (run: FactoryRun) =>
  request<FactoryRun>(
    `/api/factory/${run.kind === "result" ? "results" : "runs"}/${run.environment}/${encodeURIComponent(run.gameName)}/actions/continue`,
    {},
  );
