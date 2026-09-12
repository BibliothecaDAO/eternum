import { recoverGameSyncSession } from "@/sync/active-game-client";
import { addNetworkBreadcrumb } from "@/observability/network-health-reporting";

export const triggerConnectionForceReconnect = async (): Promise<void> => {
  addNetworkBreadcrumb({ event: "force_retry" });
  await recoverGameSyncSession();
};
