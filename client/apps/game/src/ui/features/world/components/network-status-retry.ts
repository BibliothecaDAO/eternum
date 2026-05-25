import { getConnectionHealthMonitor } from "@/dojo/connection-health-monitor";
import { addNetworkBreadcrumb } from "@/observability/network-health-reporting";

export const triggerConnectionForceReconnect = async (): Promise<void> => {
  const monitor = getConnectionHealthMonitor();
  if (!monitor) return;
  addNetworkBreadcrumb({ event: "force_retry" });
  await monitor.forceReconnect();
};
