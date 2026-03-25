import { useEffect, useMemo, useState } from "react";
import { PanelRightOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { getActiveWorld } from "@/runtime/world/store";
import type { AgentEvent } from "@bibliothecadao/types";

import {
  useAgentEventsStream,
  useDisableMyAgentAutonomyMutation,
  useEnableMyAgentAutonomyMutation,
  useMyAgentDetailQuery,
  useMyAgentHistoryQuery,
  useMyAgentMessagesQuery,
  useMyAgentsQuery,
  useSendMyAgentMessageMutation,
  useSetMyAgentSteeringMutation,
} from "../../hooks/use-my-agents";
import { useAgentsUiStore } from "../../model/use-agents-ui-store";
import {
  describeLatestAction,
  describeRunSummary,
  formatTimestamp,
  humanizeExecutionState,
  isHeartbeatStalled,
} from "./agent-dock-utils";
import { ActivityTab, ChatTab, DetailsTab, SteeringTab } from "./tabs";

export const AgentDockHost = () => {
  const account = useAccountStore((state) => state.account);
  const playerId = account?.address && account.address !== "0x0" ? account.address : null;
  const activeWorld = getActiveWorld();
  const worldId = activeWorld?.worldAddress ?? null;
  const worldLabel = activeWorld?.name ?? "Current world";
  const navigate = useNavigate();

  const { data } = useMyAgentsQuery(playerId);
  const setDockOpen = useAgentsUiStore((state) => state.setDockOpen);
  const isDockOpen = useAgentsUiStore((state) => state.isDockOpen);
  const dockTab = useAgentsUiStore((state) => state.dockTab);
  const setDockTab = useAgentsUiStore((state) => state.setDockTab);
  const draftMessageByAgentId = useAgentsUiStore((state) => state.draftMessageByAgentId);
  const setDraftMessage = useAgentsUiStore((state) => state.setDraftMessage);
  const draftSteeringJobByAgentId = useAgentsUiStore((state) => state.draftSteeringJobByAgentId);
  const setDraftSteeringJob = useAgentsUiStore((state) => state.setDraftSteeringJob);

  const agent = useMemo(
    () => data?.agents.find((candidate) => candidate.worldId === worldId) ?? null,
    [data?.agents, worldId],
  );
  const { data: detail } = useMyAgentDetailQuery(playerId, agent?.id ?? null);
  const { data: historyData } = useMyAgentHistoryQuery(playerId, agent?.id ?? null);
  const { data: messagesData } = useMyAgentMessagesQuery(playerId, agent?.id ?? null);
  const enableAutonomyMutation = useEnableMyAgentAutonomyMutation(playerId, agent?.id ?? null);
  const disableAutonomyMutation = useDisableMyAgentAutonomyMutation(playerId, agent?.id ?? null);
  const steeringMutation = useSetMyAgentSteeringMutation(playerId, agent?.id ?? null);
  const sendMessageMutation = useSendMyAgentMessageMutation(playerId, agent?.id ?? null);
  const [events, setEvents] = useState<AgentEvent[]>([]);

  useEffect(() => {
    if (!detail?.id) return;
    setEvents([]);
  }, [detail?.id]);

  useEffect(
    useAgentEventsStream(playerId, agent?.id ?? null, events.at(-1)?.seq ?? 0, (event) => {
      setEvents((current) => [...current, event as AgentEvent]);
    }),
    [playerId, agent?.id, events],
  );

  useEffect(() => {
    if (agent?.id && !draftSteeringJobByAgentId[agent.id]) {
      setDraftSteeringJob(agent.id, agent.activeSteeringJob?.type ?? "scout");
    }
  }, [agent?.id, agent?.activeSteeringJob?.type, draftSteeringJobByAgentId, setDraftSteeringJob]);

  if (!playerId || !worldId) {
    return null;
  }

  const selectedSteering = agent?.id ? (draftSteeringJobByAgentId[agent.id] ?? "scout") : "scout";
  const draftMessage = agent?.id ? (draftMessageByAgentId[agent.id] ?? "") : "";
  const recentEvents = events.length > 0 ? events : (detail?.recentEvents ?? []);
  const recentHistory = historyData?.history ?? [];
  const latestRunSummary = detail?.latestRun ? describeRunSummary(detail.latestRun) : "No run recorded yet";
  const statusTone = detail?.lastErrorMessage ? "text-red-300" : "text-gold/80";
  const heartbeatStalled = detail
    ? isHeartbeatStalled({
        autonomyEnabled: detail.autonomy.enabled,
        executionState: detail.executionState,
        nextWakeAt: detail.nextWakeAt,
      })
    : false;

  const isReady = agent && detail?.setup.status === "ready";

  return (
    <div className="pointer-events-auto fixed right-0 top-20 bottom-8 z-[90] flex items-stretch">
      <button
        type="button"
        onClick={() => setDockOpen(!isDockOpen)}
        className="self-start mr-2 rounded-l-2xl rounded-r-none border border-r-0 border-gold/20 bg-black/70 px-3 py-4 text-gold transition-colors hover:bg-black/85"
      >
        <PanelRightOpen className="h-4 w-4" />
      </button>

      {isDockOpen ? (
        <div className="flex h-full w-[420px] flex-col overflow-hidden rounded-l-3xl border border-gold/20 bg-black/80 shadow-[0_25px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="border-b border-gold/10 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-gold/50">{worldLabel}</div>
                <h2 className="mt-1 font-cinzel text-xl text-gold">{detail?.displayName ?? "World Agent"}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gold/70">
                  <span className="rounded-full border border-gold/15 px-2 py-1">
                    {detail?.autonomy.enabled ? "Autonomy enabled" : "Autonomy disabled"}
                  </span>
                  <span className="rounded-full border border-gold/15 px-2 py-1">
                    {detail?.activeSteeringJob?.label ?? "No steering job"}
                  </span>
                  <span className="rounded-full border border-gold/15 px-2 py-1">
                    {humanizeExecutionState(detail?.executionState)}
                  </span>
                </div>
                <div className="mt-3 text-xs text-gold/50">
                  {detail?.nextWakeAt
                    ? `Next heartbeat ${formatTimestamp(detail.nextWakeAt)}`
                    : detail?.autonomy.enabled
                      ? "Waiting for the next server heartbeat."
                      : "Heartbeat is paused until autonomy is enabled."}
                </div>
                {detail ? (
                  <div className="mt-3 rounded-2xl border border-gold/10 bg-black/30 px-3 py-3 text-xs text-gold/65">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-gold/40">Latest Action</div>
                    <div className="mt-1 text-sm text-gold/80">{describeLatestAction(detail.latestAction)}</div>
                    {detail.latestAction?.txHash ? (
                      <div className="mt-1">Tx {detail.latestAction.txHash.slice(0, 12)}...</div>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => navigate("/?tab=agents")}
                className="rounded-xl border border-gold/15 bg-black/35 px-3 py-2 text-xs text-gold/75 hover:border-gold/30 hover:text-gold"
              >
                Dashboard
              </button>
            </div>
          </div>

          {heartbeatStalled ? (
            <div className="border-b border-amber-300/20 bg-amber-200/10 px-5 py-3 text-xs text-amber-100">
              Stalled heartbeat: the executor is overdue to wake this agent again.
            </div>
          ) : null}

          <div className="flex border-b border-gold/10 px-2 py-2">
            {(
              [
                ["activity", "Activity"],
                ["chat", "Chat"],
                ["steering", "Steering"],
                ["details", "Details"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setDockTab(id)}
                className={`rounded-full px-3 py-2 text-xs transition-colors ${
                  dockTab === id ? "bg-gold text-black" : "text-gold/65 hover:bg-gold/10 hover:text-gold"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {!agent ? (
              <div className="rounded-2xl border border-gold/15 bg-black/35 p-4 text-sm text-gold/65">
                No agent exists for this world yet. Launch it from the dashboard first.
              </div>
            ) : !isReady ? (
              <div className="rounded-2xl border border-gold/15 bg-black/35 p-4 text-sm text-gold/65">
                Your agent is not ready yet. Current setup status: {detail?.setup.status}.
              </div>
            ) : dockTab === "activity" ? (
              <ActivityTab
                recentEvents={recentEvents}
                recentHistory={recentHistory}
                latestRunSummary={latestRunSummary}
                statusTone={statusTone}
              />
            ) : dockTab === "chat" ? (
              <ChatTab
                messages={messagesData?.messages ?? []}
                draftMessage={draftMessage}
                onDraftChange={(value) => setDraftMessage(agent.id, value)}
                onSend={() =>
                  void sendMessageMutation
                    .mutateAsync({ content: draftMessage })
                    .then(() => setDraftMessage(agent.id, ""))
                }
                isSending={sendMessageMutation.isPending}
              />
            ) : dockTab === "steering" ? (
              <SteeringTab
                isAutonomyEnabled={detail.autonomy.enabled}
                currentSteeringType={detail.activeSteeringJob?.type}
                selectedSteering={selectedSteering}
                onSelectSteering={(type) => setDraftSteeringJob(agent.id, type)}
                onEnableAutonomy={() =>
                  void enableAutonomyMutation.mutateAsync({
                    worldId,
                    steeringJobType: selectedSteering,
                  })
                }
                onDisableAutonomy={() => void disableAutonomyMutation.mutateAsync({ worldId })}
                onApplySteering={() =>
                  void steeringMutation.mutateAsync({
                    worldId,
                    steeringJobType: selectedSteering,
                  })
                }
                isEnabling={enableAutonomyMutation.isPending}
                isDisabling={disableAutonomyMutation.isPending}
                isApplying={steeringMutation.isPending}
              />
            ) : (
              <DetailsTab detail={detail} />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};
