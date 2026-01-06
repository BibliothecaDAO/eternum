import { useMemo, useState, useEffect, memo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Globe, Loader2, RefreshCw, Users, Check, AlertCircle } from "lucide-react";
import {
  useFactoryWorlds,
  useWorldsAvailability,
  useGameSelection,
  getAvailabilityStatus,
  getWorldKey,
  type Chain,
  type FactoryWorld,
} from "@bibliothecadao/game-selection";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Loading } from "@/shared/ui/loading";
import { ROUTES } from "@/shared/consts/routes";
import { cn } from "@/shared/lib/utils";

// Countdown formatter
function formatCountdown(secondsLeft: number): string {
  const total = Math.max(0, Math.floor(secondsLeft));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const hh = h.toString().padStart(2, "0");
  const mm = m.toString().padStart(2, "0");
  const ss = s.toString().padStart(2, "0");
  return d > 0 ? `${d}d ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;
}

// Self-updating countdown component
const WorldCountdown = memo(
  ({ startMainAt, endAt, status }: { startMainAt: number | null; endAt: number | null; status: string }) => {
    const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
    const needsTimer = startMainAt != null && status === "ok";

    useEffect(() => {
      if (!needsTimer) return;
      const id = window.setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
      return () => window.clearInterval(id);
    }, [needsTimer]);

    const label = useMemo(() => {
      if (startMainAt == null) return status === "ok" ? "Not Configured" : "";
      if (endAt === 0 || endAt == null) {
        if (nowSec < startMainAt) return `Starts in ${formatCountdown(startMainAt - nowSec)}`;
        return "Ongoing";
      }
      if (nowSec < startMainAt) return `Starts in ${formatCountdown(startMainAt - nowSec)}`;
      if (nowSec < endAt) return `${formatCountdown(endAt - nowSec)} left`;
      return "Ended";
    }, [startMainAt, endAt, nowSec, status]);

    if (!label) return null;
    return <span className="text-xs text-muted-foreground">{label}</span>;
  },
);

WorldCountdown.displayName = "WorldCountdown";

// Hook to check if game is ongoing (updates every 10s)
function useGameTimeStatus() {
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const id = window.setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 10000);
    return () => window.clearInterval(id);
  }, []);

  const isOngoing = (startMainAt: number | null, endAt: number | null) => {
    if (startMainAt == null) return false;
    if (nowSec < startMainAt) return false;
    if (endAt === 0 || endAt == null) return true;
    return nowSec < endAt;
  };

  return { isOngoing };
}

// Normalize chain values for factory lookup
function normalizeFactoryChain(chain: Chain): Chain {
  if (chain === "slottest" || chain === "local") return "slot";
  return chain;
}

interface WorldCardProps {
  world: FactoryWorld;
  status: "checking" | "ok" | "fail";
  startMainAt: number | null;
  endAt: number | null;
  registrationCount: number | null;
  isSelected: boolean;
  onSelect: () => void;
}

function WorldCard({ world, status, startMainAt, endAt, registrationCount, isSelected, onSelect }: WorldCardProps) {
  return (
    <Card
      className={cn(
        "cursor-pointer transition-all active:scale-[0.98]",
        isSelected ? "ring-2 ring-primary bg-primary/5" : "hover:bg-muted/50",
      )}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold truncate">{world.name}</span>
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full uppercase font-medium",
                  world.chain === "mainnet" ? "bg-green-500/20 text-green-600" : "bg-blue-500/20 text-blue-600",
                )}
              >
                {world.chain}
              </span>
              {isSelected && <Check className="w-4 h-4 text-primary" />}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <WorldCountdown startMainAt={startMainAt} endAt={endAt} status={status} />
              {registrationCount != null && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="w-3 h-3" />
                  {registrationCount}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {status === "checking" && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            {status === "ok" && (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Online
              </span>
            )}
            {status === "fail" && <span className="text-xs text-red-500">Offline</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function WorldSelectPage() {
  const navigate = useNavigate();
  const { selectWorld, selectedWorld, selectedChain, setSelectedChain } = useGameSelection();
  const { isOngoing } = useGameTimeStatus();

  // Active chain for factory lookup
  const activeFactoryChain = normalizeFactoryChain(selectedChain);
  const factoryChains = useMemo<Chain[]>(() => ["mainnet", "slot"], []);

  // Fetch worlds from factory
  const {
    worlds: factoryWorlds,
    isLoading: factoryWorldsLoading,
    error: factoryError,
    refetchAll: refetchFactoryWorlds,
  } = useFactoryWorlds(factoryChains, { enabled: true });

  // Check availability
  const {
    results: factoryAvailability,
    isAnyLoading: factoryCheckingAvailability,
    refetchAll: refetchAvailability,
  } = useWorldsAvailability(factoryWorlds, { enabled: factoryWorlds.length > 0 });

  // Build display list
  const factoryGames = useMemo(() => {
    return factoryWorlds.map((world) => {
      const worldKey = getWorldKey(world);
      const availability = factoryAvailability.get(worldKey);
      const status = getAvailabilityStatus(availability);
      return {
        ...world,
        worldKey,
        status,
        startMainAt: availability?.meta?.startMainAt ?? null,
        endAt: availability?.meta?.endAt ?? null,
        registrationCount: availability?.meta?.registrationCount ?? null,
      };
    });
  }, [factoryWorlds, factoryAvailability]);

  // Filter to online & ongoing games for the active chain
  const onlineGames = factoryGames.filter((fg) => fg.status === "ok");
  const ongoingGames = onlineGames.filter(
    (fg) => isOngoing(fg.startMainAt, fg.endAt) && normalizeFactoryChain(fg.chain) === activeFactoryChain,
  );

  const isLoading = factoryWorldsLoading || (factoryWorlds.length > 0 && factoryCheckingAvailability);

  const handleRefresh = async () => {
    await refetchFactoryWorlds();
    await refetchAvailability();
  };

  const handleSelectWorld = (world: FactoryWorld) => {
    selectWorld(world);
  };

  const handleContinue = () => {
    if (selectedWorld) {
      navigate({ to: ROUTES.HOME });
    }
  };

  const handleSwitchChain = (chain: Chain) => {
    if (normalizeFactoryChain(chain) !== activeFactoryChain) {
      setSelectedChain(chain);
    }
  };

  return (
    <div className="flex min-h-screen flex-col p-4">
      <img src="/images/eternum-logo-words.svg" alt="Eternum Logo" className="w-3/4 mx-auto my-8" />

      <Card className="flex-1 flex flex-col">
        <CardHeader className="text-center pb-2">
          <CardTitle>Select a World</CardTitle>
          <CardDescription>Choose a game world to enter</CardDescription>

          {/* Chain switcher */}
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Chain</span>
            <div className="flex items-center gap-1 rounded-full border p-1">
              <button
                type="button"
                onClick={() => handleSwitchChain("mainnet")}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-full transition",
                  activeFactoryChain === "mainnet" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                Mainnet
              </button>
              <button
                type="button"
                onClick={() => handleSwitchChain("slot")}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-full transition",
                  activeFactoryChain === "slot" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                Slot
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col gap-3 overflow-hidden">
          {/* World list */}
          <div className="flex-1 overflow-y-auto space-y-2 -mx-2 px-2">
            {isLoading && factoryGames.length === 0 ? (
              <Loading className="py-8" text="Loading worlds..." />
            ) : factoryError ? (
              <div className="text-center py-8">
                <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
                <p className="text-sm text-destructive">{factoryError.message}</p>
                <Button variant="outline" size="sm" onClick={handleRefresh} className="mt-3">
                  Try Again
                </Button>
              </div>
            ) : ongoingGames.length === 0 ? (
              <div className="text-center py-8">
                <Globe className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No active games found on {activeFactoryChain}</p>
              </div>
            ) : (
              ongoingGames.map((game) => (
                <WorldCard
                  key={game.worldKey}
                  world={game}
                  status={game.status}
                  startMainAt={game.startMainAt}
                  endAt={game.endAt}
                  registrationCount={game.registrationCount}
                  isSelected={selectedWorld?.name === game.name && selectedWorld?.chain === game.chain}
                  onSelect={() => handleSelectWorld(game)}
                />
              ))
            )}
          </div>

          {/* Refresh button */}
          <div className="flex justify-center">
            <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isLoading}>
              <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
              Refresh
            </Button>
          </div>

          {/* Continue button */}
          {selectedWorld && (
            <Button className="w-full" onClick={handleContinue}>
              Continue to {selectedWorld.name}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
