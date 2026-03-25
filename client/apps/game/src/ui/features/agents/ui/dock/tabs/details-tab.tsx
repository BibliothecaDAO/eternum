import type { MyAgentDetail } from "@bibliothecadao/types";

import {
  describeRunSummary,
  formatTimestamp,
  humanizeConfigKey,
  humanizeExecutionState,
  truncateAddress,
} from "../agent-dock-utils";

export const DetailsTab = ({ detail }: { detail: MyAgentDetail }) => {
  const runtimeEntries = Object.entries(detail.runtimeConfig ?? {}).filter(
    ([, v]) => v !== undefined && v !== null,
  );

  return (
    <div className="space-y-3 text-sm text-gold/80">
      <div className="rounded-2xl border border-gold/10 bg-black/35 p-4">
        <div className="text-xs uppercase tracking-[0.16em] text-gold/50">Session & Setup</div>
        <div className="mt-2">{detail.setup.status}</div>
        <div className="mt-2 text-xs text-gold/60">
          Session: {detail.activeSession?.status ?? "No active session"}
        </div>
        {detail.activeSession?.cartridgeUsername ? (
          <div className="mt-1 text-xs text-gold/60">
            Cartridge: {detail.activeSession.cartridgeUsername}
          </div>
        ) : null}
        {detail.activeSession?.sessionAccountAddress ? (
          <div className="mt-1 text-xs text-gold/60">
            Account: {truncateAddress(detail.activeSession.sessionAccountAddress)}
          </div>
        ) : null}
        {detail.activeSession?.expiresAt ? (
          <div className="mt-1 text-xs text-gold/60">
            Expires {formatTimestamp(detail.activeSession.expiresAt, true)}
          </div>
        ) : null}
        {detail.setup.errorMessage ? (
          <div className="mt-2 text-xs text-red-300">{detail.setup.errorMessage}</div>
        ) : null}
        {detail.activeSession?.invalidationReason ? (
          <div className="mt-1 text-xs text-red-300">
            Invalidation: {detail.activeSession.invalidationReason}
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-gold/10 bg-black/35 p-4">
        <div className="text-xs uppercase tracking-[0.16em] text-gold/50">Execution</div>
        <div className="mt-2">{humanizeExecutionState(detail.executionState)}</div>
        {detail.nextWakeAt ? (
          <div className="mt-1 text-xs text-gold/60">
            Next heartbeat {formatTimestamp(detail.nextWakeAt, true)}
          </div>
        ) : null}
        {detail.lastRunFinishedAt ? (
          <div className="mt-1 text-xs text-gold/60">
            Last finished {formatTimestamp(detail.lastRunFinishedAt, true)}
          </div>
        ) : null}
        {detail.latestRun ? (
          <div className="mt-1 text-xs text-gold/60">{describeRunSummary(detail.latestRun)}</div>
        ) : null}
        {detail.lastErrorMessage ? (
          <div className="mt-2 text-xs text-red-300">{detail.lastErrorMessage}</div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-gold/10 bg-black/35 p-4">
        <div className="text-xs uppercase tracking-[0.16em] text-gold/50">Configuration</div>
        <div className="mt-2">
          {detail.modelProvider}/{detail.modelId}
        </div>
        {runtimeEntries.length > 0 ? (
          <div className="mt-3 space-y-1">
            {runtimeEntries.map(([key, value]) => (
              <div key={key} className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-gold/50">{humanizeConfigKey(key)}</span>
                <span className="text-gold/70">{String(value)}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};
