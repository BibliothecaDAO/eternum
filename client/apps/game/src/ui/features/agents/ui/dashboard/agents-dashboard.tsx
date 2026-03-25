import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { MyAgentSummary } from "@bibliothecadao/types";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useFactoryWorlds } from "@/hooks/use-factory-worlds";
import { getActiveWorld, listWorldProfiles } from "@/runtime/world/store";

import { useLaunchMyAgentMutation, useMyAgentDetailQuery, useMyAgentsQuery } from "../../hooks/use-my-agents";
import { useAgentsUiStore } from "../../model/use-agents-ui-store";
import { AgentLaunchPanel } from "./agent-launch-panel";
import { MyAgentDetailPanel } from "./my-agent-detail-panel";
import { WorldAgentCard } from "./world-agent-card";

type WorldOption = {
  worldId: string;
  label: string;
  chain?: "sepolia" | "mainnet" | "slot" | "slottest" | "local";
  subtitle?: string;
  rpcUrl?: string;
  toriiBaseUrl?: string;
};

export const AgentsDashboard = () => {
  const account = useAccountStore((state) => state.account);
  const queryClient = useQueryClient();
  const playerId = account?.address && account.address !== "0x0" ? account.address : null;
  const { data, isLoading } = useMyAgentsQuery(playerId);
  const { worlds: factoryWorlds } = useFactoryWorlds(["mainnet", "slot"]);
  const launchMutation = useLaunchMyAgentMutation(playerId);
  const selectedWorldId = useAgentsUiStore((state) => state.selectedWorldId);
  const setSelectedWorldId = useAgentsUiStore((state) => state.setSelectedWorldId);
  const worldOptions = useMemo(() => {
    const activeWorld = getActiveWorld();
    const knownProfiles = listWorldProfiles();
    const worldMap = new Map<string, WorldOption>();

    if (activeWorld) {
      worldMap.set(activeWorld.worldAddress, {
        worldId: activeWorld.worldAddress,
        label: activeWorld.name,
        chain: activeWorld.chain,
        subtitle: activeWorld.chain,
        rpcUrl: activeWorld.rpcUrl,
        toriiBaseUrl: activeWorld.toriiBaseUrl,
      });
    }

    for (const profile of knownProfiles) {
      worldMap.set(profile.worldAddress, {
        worldId: profile.worldAddress,
        label: profile.name,
        chain: profile.chain,
        subtitle: profile.chain,
        rpcUrl: profile.rpcUrl,
        toriiBaseUrl: profile.toriiBaseUrl,
      });
    }

    for (const world of factoryWorlds) {
      if (world.worldAddress) {
        worldMap.set(world.worldAddress, {
          worldId: world.worldAddress,
          label: world.name,
          chain: world.chain,
          subtitle: world.chain,
        });
      }
    }

    for (const agent of data?.agents ?? []) {
      if (!worldMap.has(agent.worldId)) {
        worldMap.set(agent.worldId, {
          worldId: agent.worldId,
          label: agent.worldId,
        });
      }
    }

    return Array.from(worldMap.values());
  }, [data?.agents, factoryWorlds]);

  useEffect(() => {
    if (!selectedWorldId && worldOptions.length > 0) {
      setSelectedWorldId(worldOptions[0].worldId);
    }
  }, [selectedWorldId, setSelectedWorldId, worldOptions]);

  useEffect(() => {
    if (typeof window === "undefined" || !playerId) {
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }
      if (event.data?.type !== "agent-auth-complete") {
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ["my-agents", playerId] });
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [playerId, queryClient]);

  const selectedAgent = useMemo(
    () => data?.agents.find((agent) => agent.worldId === selectedWorldId) ?? null,
    [data?.agents, selectedWorldId],
  );
  const { data: detail } = useMyAgentDetailQuery(playerId, selectedAgent?.id ?? null);
  const selectedWorld = worldOptions.find((world) => world.worldId === selectedWorldId) ?? null;

  if (!playerId) {
    return (
      <div className="rounded-3xl border border-gold/20 bg-black/55 p-8 text-gold/70 backdrop-blur-xl">
        Sign in to view and launch your agents.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-gold/15 bg-black/45 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-gold/50">My Agents</div>
          <div className="mt-2 text-3xl font-cinzel text-gold">{data?.agents.length ?? 0}</div>
        </div>
        <div className="rounded-2xl border border-gold/15 bg-black/45 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-gold/50">Ready</div>
          <div className="mt-2 text-3xl font-cinzel text-gold">
            {data?.agents.filter((agent) => agent.setup.status === "ready").length ?? 0}
          </div>
        </div>
        <div className="rounded-2xl border border-gold/15 bg-black/45 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-gold/50">Autonomy Enabled</div>
          <div className="mt-2 text-3xl font-cinzel text-gold">
            {data?.agents.filter((agent) => agent.autonomy.enabled).length ?? 0}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          {worldOptions.map((world) => (
            <WorldAgentCard
              key={world.worldId}
              title={world.label}
              subtitle={world.subtitle}
              agent={data?.agents.find((agent) => agent.worldId === world.worldId) ?? null}
              isSelected={selectedWorldId === world.worldId}
              onSelect={() => setSelectedWorldId(world.worldId)}
            />
          ))}
        </div>

        <div>
          {isLoading ? (
            <div className="rounded-3xl border border-gold/20 bg-black/55 p-8 text-gold/70 backdrop-blur-xl">
              Loading your agents...
            </div>
          ) : selectedWorld && !selectedAgent ? (
            <AgentLaunchPanel
              worldId={selectedWorld.worldId}
              worldLabel={selectedWorld.label}
              isPending={launchMutation.isPending}
              onLaunch={async ({ displayName }) => {
                await launchMutation.mutateAsync({
                  worldId: selectedWorld.worldId,
                  worldName: selectedWorld.label,
                  chain: selectedWorld.chain,
                  rpcUrl: selectedWorld.rpcUrl,
                  toriiBaseUrl: selectedWorld.toriiBaseUrl,
                  displayName,
                  modelProvider: "anthropic",
                  modelId: "claude-sonnet-4-20250514",
                });
              }}
            />
          ) : detail ? (
            <MyAgentDetailPanel
              agent={detail}
              onCompleteSetup={(authUrl) => {
                window.open(authUrl, "_blank", "noopener,noreferrer");
              }}
            />
          ) : (
            <div className="rounded-3xl border border-gold/20 bg-black/55 p-8 text-gold/70 backdrop-blur-xl">
              Select a world to manage your agent.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
