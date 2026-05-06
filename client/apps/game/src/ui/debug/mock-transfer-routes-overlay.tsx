import { useMemo } from "react";

import { useUIStore } from "@/hooks/store/use-ui-store";

const QUERY_PARAM = "debugTransferRoutes";

export function isMockTransferRoutesEnabled(search: string = window.location.search): boolean {
  const params = new URLSearchParams(search);
  const value = params.get(QUERY_PARAM);
  if (value === null) {
    return false;
  }
  return value.toLowerCase() === "mock" || (value !== "0" && value.toLowerCase() !== "false");
}

export function MockTransferRoutesOverlay(): JSX.Element | null {
  const enabled = useMemo(() => isMockTransferRoutesEnabled(), []);
  const routeCount = useUIStore((state) => state.transferRouteOverlayRoutes.length);

  if (!enabled) {
    return null;
  }

  return (
    <div
      className="fixed right-4 top-16 z-[9999] rounded-md border border-cyan-300/50 bg-slate-950/85 px-3 py-2 font-mono text-xs text-cyan-50 shadow-xl"
      data-testid="mock-transfer-routes-overlay"
    >
      <div className="font-semibold text-cyan-300">Mock Transfer Routes</div>
      <div className="mt-1 text-cyan-50/80">mode: query param</div>
      <div className="text-cyan-50/80">routes: {routeCount}</div>
      <div className="text-cyan-50/60">?debugTransferRoutes=mock</div>
    </div>
  );
}
