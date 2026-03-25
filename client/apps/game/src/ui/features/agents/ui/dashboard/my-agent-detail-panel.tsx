import type { MyAgentDetail } from "@bibliothecadao/types";

import Button from "@/ui/design-system/atoms/button";
import {
  describeLatestAction,
  formatEventLabel,
  formatTimestamp,
  humanizeExecutionState,
  isHeartbeatStalled,
  truncateAddress,
} from "../dock/agent-dock-utils";

export const MyAgentDetailPanel = ({
  agent,
  onCompleteSetup,
}: {
  agent: MyAgentDetail;
  onCompleteSetup?: (authUrl: string) => void;
}) => {
  const heartbeatStalled = isHeartbeatStalled({
    autonomyEnabled: agent.autonomy.enabled,
    executionState: agent.executionState,
    nextWakeAt: agent.nextWakeAt,
  });

  return (
    <div className="rounded-3xl border border-gold/20 bg-black/55 p-6 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-cinzel text-2xl text-gold">{agent.displayName}</h2>
          <p className="text-sm text-gold/60">{truncateAddress(agent.worldId)}</p>
        </div>
        <div className="rounded-full border border-gold/20 bg-black/40 px-3 py-1 text-xs text-gold/80">
          {agent.autonomy.enabled ? "Autonomy enabled" : "Autonomy disabled"}
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-gold/10 bg-black/35 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-gold/50">Setup</div>
          <div className="mt-2 text-sm text-gold">{agent.setup.status}</div>
          <p className="mt-2 text-xs text-gold/55">Execution: {humanizeExecutionState(agent.executionState)}</p>
          {agent.nextWakeAt ? (
            <p className="mt-1 text-xs text-gold/55">Next heartbeat: {formatTimestamp(agent.nextWakeAt, true)}</p>
          ) : null}
          {heartbeatStalled ? (
            <p className="mt-2 text-xs text-amber-200">
              Heartbeat looks stalled. The executor is overdue to wake this agent again.
            </p>
          ) : null}
          {agent.activeSession?.cartridgeUsername ? (
            <p className="mt-2 text-xs text-gold/55">Cartridge: {agent.activeSession.cartridgeUsername}</p>
          ) : null}
          {agent.activeSession?.expiresAt ? (
            <p className="mt-1 text-xs text-gold/55">Expires: {formatTimestamp(agent.activeSession.expiresAt, true)}</p>
          ) : null}
          {agent.setup.errorMessage ? <p className="mt-2 text-xs text-red-300">{agent.setup.errorMessage}</p> : null}
          {agent.setup.status === "pending_auth" && agent.setup.authUrl ? (
            <Button className="mt-4 w-full" onClick={() => onCompleteSetup?.(agent.setup.authUrl!)}>
              Complete Setup
            </Button>
          ) : null}
        </section>

        <section className="rounded-2xl border border-gold/10 bg-black/35 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-gold/50">Steering</div>
          <div className="mt-2 text-sm text-gold">
            {agent.activeSteeringJob ? agent.activeSteeringJob.label : "No active steering profile"}
          </div>
          <p className="mt-2 text-xs text-gold/55">
            {agent.activeSteeringJob?.summary ?? "Enable autonomy in-game to activate a steering job for this match."}
          </p>
        </section>

        <section className="rounded-2xl border border-gold/10 bg-black/35 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-gold/50">Latest Action</div>
          <div className="mt-2 text-sm text-gold">{describeLatestAction(agent.latestAction)}</div>
          {agent.latestAction?.txHash ? (
            <p className="mt-2 text-xs text-gold/55">Tx hash: {truncateAddress(agent.latestAction.txHash, 10)}</p>
          ) : null}
          {agent.latestAction?.calldataSummary ? (
            <p className="mt-1 text-xs text-gold/55">{agent.latestAction.calldataSummary}</p>
          ) : null}
          {agent.latestAction?.errorMessage ? (
            <p className="mt-2 text-xs text-red-300">{agent.latestAction.errorMessage}</p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-gold/10 bg-black/35 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-gold/50">Execution Summary</div>
          <div className="mt-2 text-sm text-gold">
            {agent.executionSummary?.lastRunStatus
              ? `Last run ${agent.executionSummary.lastRunStatus}`
              : "No execution summary yet"}
          </div>
          {agent.executionSummary?.lastWakeReason ? (
            <p className="mt-2 text-xs text-gold/55">
              Wake reason: {formatEventLabel(agent.executionSummary.lastWakeReason)}
            </p>
          ) : null}
          {agent.executionSummary?.lastRunFinishedAt ? (
            <p className="mt-1 text-xs text-gold/55">
              Finished: {formatTimestamp(agent.executionSummary.lastRunFinishedAt, true)}
            </p>
          ) : null}
          {agent.executionSummary?.lastErrorMessage ? (
            <p className="mt-2 text-xs text-red-300">{agent.executionSummary.lastErrorMessage}</p>
          ) : null}
        </section>
      </div>
    </div>
  );
};
