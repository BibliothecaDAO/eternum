import type { PlaytestSlot } from "../../../../../../../apps/launch-service/src/slots";
import type { toFactoryRunRecord } from "../../../../../../../apps/launch-service/src/model";
import { fetchApi } from "@/runtime/app-api";
export type { PlaytestSlot };
type FactoryRun = ReturnType<typeof toFactoryRunRecord>;

/** The launch routes are served under the app's own /api beside identity, so the session cookie reaches them. */
async function request<T>(path: string, body?: unknown, method = body === undefined ? "GET" : "POST"): Promise<T> {
  const response = await fetchApi(path, {
    method,
    credentials: "include",
    ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? `Launch request failed (${response.status})`);
  return payload as T;
}

export const fetchPlaytestSlots = () => request<{ slots: PlaytestSlot[] }>("/api/slots");
/** Whether the signed-in caller launches: the factory page shows itself to launchers only. */
export const fetchLauncherStatus = () => request<{ launcher: boolean }>("/api/factory/launcher");
/** A launcher's runs: the Eternum games made here and the Frontier season's launch. Blitz runs are the operator's. */
export const fetchFactoryRuns = (environment: "madara.eternum" | "madara.frontier") =>
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
  request<FactoryRun>(`/api/factory/runs/${run.environment}/${encodeURIComponent(run.gameName)}/actions/continue`, {});
