import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Globe, Loader2, Play, RefreshCw, Users } from "lucide-react";
import { shortString } from "starknet";

import { useWorldsAvailability, getAvailabilityStatus } from "@/hooks/use-world-availability";
import { getActiveWorldName, getFactorySqlBaseUrl, listWorldNames } from "@/runtime/world";
import { deleteWorldProfile } from "@/runtime/world/store";
import Button from "@/ui/design-system/atoms/button";
import { WorldCountdown, useGameTimeStatus } from "@/ui/components/world-countdown";
import { env } from "../../../../env";

const decodePaddedFeltAscii = (hex: string): string => {
  try {
    if (!hex) return "";
    const h = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
    if (h === "0") return "";
    try {
      const asDec = BigInt("0x" + h).toString();
      const decoded = shortString.decodeShortString(asDec);
      if (decoded && decoded.trim().length > 0) return decoded;
    } catch {
      // ignore and fallback to manual decode
    }
    let i = 0;
    while (i + 1 < h.length && h.slice(i, i + 2) === "00") i += 2;
    let out = "";
    for (; i + 1 < h.length; i += 2) {
      const byte = parseInt(h.slice(i, i + 2), 16);
      if (byte === 0) continue;
      out += String.fromCharCode(byte);
    }
    return out;
  } catch {
    return "";
  }
};

interface WorldSelectPanelProps {
  onSelect: (worldName: string) => void;
}

export const WorldSelectPanel = ({ onSelect }: WorldSelectPanelProps) => {
  const [saved, setSaved] = useState<string[]>(() => listWorldNames());
  const [selected, setSelected] = useState<string | null>(getActiveWorldName());
  const [factoryNames, setFactoryNames] = useState<string[]>([]);
  const [factoryNamesLoading, setFactoryNamesLoading] = useState(false);
  const [factoryError, setFactoryError] = useState<string | null>(null);

  // Use hook for game status filtering (updates every 10s, not every 1s)
  const { isOngoing } = useGameTimeStatus();

  // Use cached availability hook for factory worlds
  const {
    results: factoryAvailability,
    isAnyLoading: factoryCheckingAvailability,
    refetchAll: refetchFactory,
  } = useWorldsAvailability(factoryNames, factoryNames.length > 0);

  // Use cached availability hook for saved worlds
  const { results: savedAvailability, allSettled: savedChecksDone } = useWorldsAvailability(saved, saved.length > 0);

  // Auto-delete offline saved games when checks complete
  useEffect(() => {
    if (!savedChecksDone || saved.length === 0) return;

    const offlineGames = saved.filter((name) => {
      const availability = savedAvailability.get(name);
      return availability && !availability.isLoading && !availability.isAvailable;
    });

    if (offlineGames.length > 0) {
      offlineGames.forEach((n) => deleteWorldProfile(n));
      const updatedList = listWorldNames();
      setSaved(updatedList);
      if (selected && offlineGames.includes(selected)) {
        setSelected(null);
      }
    }
  }, [savedChecksDone, saved, savedAvailability, selected]);

  // Fetch factory world names (just the list, not availability)
  const loadFactoryNames = useCallback(async () => {
    try {
      setFactoryNamesLoading(true);
      setFactoryError(null);

      const factorySqlBaseUrl = getFactorySqlBaseUrl(env.VITE_PUBLIC_CHAIN as "mainnet" | "sepolia" | "slot" | "local");
      if (!factorySqlBaseUrl) {
        setFactoryNames([]);
        return;
      }

      const query = `SELECT name FROM [wf-WorldDeployed] LIMIT 1000;`;
      const url = `${factorySqlBaseUrl}?query=${encodeURIComponent(query)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Factory query failed: ${res.status} ${res.statusText}`);
      const rows = (await res.json()) as Record<string, unknown>[];

      const names: string[] = [];
      const seen = new Set<string>();
      for (const row of rows) {
        const feltHex: string | undefined =
          (row && (row.name as string)) || (row && (row["data.name"] as string)) || undefined;
        if (!feltHex || typeof feltHex !== "string") continue;
        const decoded = decodePaddedFeltAscii(feltHex);
        if (!decoded || seen.has(decoded)) continue;
        seen.add(decoded);
        names.push(decoded);
      }

      setFactoryNames(names);
    } catch (e: unknown) {
      setFactoryError(e instanceof Error ? e.message : String(e));
    } finally {
      setFactoryNamesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFactoryNames();
  }, [loadFactoryNames]);

  // Build factory games list from cached availability results
  const factoryGames = useMemo(() => {
    return factoryNames.map((name) => {
      const availability = factoryAvailability.get(name);
      const status = getAvailabilityStatus(availability);
      return {
        name,
        status,
        startMainAt: availability?.meta?.startMainAt ?? null,
        endAt: availability?.meta?.endAt ?? null,
        registrationCount: availability?.meta?.registrationCount ?? null,
      };
    });
  }, [factoryNames, factoryAvailability]);

  const factoryLoading = factoryNamesLoading || (factoryNames.length > 0 && factoryCheckingAvailability);

  const handleRefresh = useCallback(async () => {
    await loadFactoryNames();
    await refetchFactory();
  }, [loadFactoryNames, refetchFactory]);

  const handleSelectWorld = (worldName: string) => {
    setSelected(worldName);
  };

  const handleEnterWorld = (worldName: string) => {
    onSelect(worldName);
  };

  // Filter and sort games using the hook's isOngoing function
  const onlineGames = factoryGames.filter((fg) => fg.status === "ok");
  const ongoingGames = onlineGames.filter((fg) => isOngoing(fg.startMainAt, fg.endAt));

  return (
    <div className="flex flex-col h-full">
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold text-gold">Select a World</h2>
        <p className="text-sm text-gold/60 mt-1">Choose a game world to enter</p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
        {factoryLoading && factoryGames.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="w-8 h-8 text-gold/50 animate-spin mb-3" />
            <p className="text-sm text-gold/60">Loading available worlds...</p>
          </div>
        ) : factoryError ? (
          <div className="text-center py-8">
            <AlertCircle className="w-8 h-8 text-danger/60 mx-auto mb-2" />
            <p className="text-sm text-danger">{factoryError}</p>
            <button
              onClick={() => void handleRefresh()}
              className="mt-3 px-3 py-1.5 text-xs rounded-md bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20"
            >
              Try Again
            </button>
          </div>
        ) : ongoingGames.length === 0 ? (
          <div className="text-center py-8">
            <Globe className="w-8 h-8 text-gold/30 mx-auto mb-2" />
            <p className="text-sm text-gold/60">No active games found</p>
          </div>
        ) : (
          ongoingGames.map((fg) => (
            <div
              key={fg.name}
              className={`group relative rounded-lg border-2 p-3 transition-all duration-200 cursor-pointer ${
                selected === fg.name
                  ? "border-gold bg-gold/10 shadow-lg shadow-gold/20"
                  : "border-gold/20 bg-brown/40 hover:bg-brown/60 hover:border-gold/40"
              }`}
              onClick={() => handleSelectWorld(fg.name)}
              onDoubleClick={() => handleEnterWorld(fg.name)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gold truncate">{fg.name}</span>
                    {selected === fg.name && (
                      <div className="p-0.5 rounded-full bg-gold/20">
                        <Check className="w-3 h-3 text-gold" />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-white/60">
                    <WorldCountdown startMainAt={fg.startMainAt} endAt={fg.endAt} status={fg.status} />
                    {fg.registrationCount != null && (
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {fg.registrationCount}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-brilliance/10 text-brilliance border border-brilliance/30">
                    <div className="w-1.5 h-1.5 rounded-full bg-brilliance animate-pulse" />
                    Online
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEnterWorld(fg.name);
                    }}
                    className="p-1.5 rounded-md bg-brilliance/10 text-brilliance border border-brilliance/30 hover:bg-brilliance/20 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Enter game"
                  >
                    <Play className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Refresh button */}
      <div className="mt-4 flex justify-center">
        <button
          onClick={() => void handleRefresh()}
          disabled={factoryLoading}
          className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-md bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${factoryLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Enter button */}
      {selected && (
        <div className="mt-4">
          <Button className="w-full !h-12" variant="gold" onClick={() => handleEnterWorld(selected)}>
            Enter {selected}
          </Button>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(223, 170, 84, 0.1);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(223, 170, 84, 0.3);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(223, 170, 84, 0.5);
        }
      `}</style>
    </div>
  );
};
