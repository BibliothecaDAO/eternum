import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Check, Globe, Loader2, Play, RefreshCw, Users } from "lucide-react";
import { shortString } from "starknet";

import { useAccountStore } from "@/hooks/store/use-account-store";
import { getActiveWorldName, getFactorySqlBaseUrl, listWorldNames } from "@/runtime/world";
import { isToriiAvailable } from "@/runtime/world/factory-resolver";
import { deleteWorldProfile } from "@/runtime/world/store";
import Button from "@/ui/design-system/atoms/button";
import { env } from "../../../../env";

const WORLD_CONFIG_QUERY = `SELECT "season_config.start_main_at" AS start_main_at, "season_config.end_at" AS end_at, "blitz_registration_config.registration_count" AS registration_count FROM "s1_eternum-WorldConfig" LIMIT 1;`;

const buildToriiBaseUrl = (worldName: string) => `https://api.cartridge.gg/x/${worldName}/torii`;

const formatCountdown = (secondsLeft: number): string => {
  const total = Math.max(0, Math.floor(secondsLeft));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const hh = h.toString().padStart(2, "0");
  const mm = m.toString().padStart(2, "0");
  const ss = s.toString().padStart(2, "0");
  return d > 0 ? `${d}d ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;
};

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

const parseMaybeHexToNumber = (v: unknown): number | null => {
  if (v == null) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    try {
      if (v.startsWith("0x") || v.startsWith("0X")) return Number(BigInt(v));
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  }
  return null;
};

const fetchWorldConfigMeta = async (
  toriiBaseUrl: string,
): Promise<{ startMainAt: number | null; endAt: number | null; registrationCount: number | null }> => {
  const meta: { startMainAt: number | null; endAt: number | null; registrationCount: number | null } = {
    startMainAt: null,
    endAt: null,
    registrationCount: null,
  };
  try {
    const url = `${toriiBaseUrl}/sql?query=${encodeURIComponent(WORLD_CONFIG_QUERY)}`;
    const response = await fetch(url);
    if (!response.ok) return meta;
    const [row] = (await response.json()) as Record<string, unknown>[];
    if (row) {
      if (row.start_main_at != null) meta.startMainAt = parseMaybeHexToNumber(row.start_main_at) ?? null;
      if (row.end_at != null) meta.endAt = parseMaybeHexToNumber(row.end_at);
      if (row.registration_count != null) meta.registrationCount = parseMaybeHexToNumber(row.registration_count);
    }
  } catch {
    // ignore fetch errors; caller handles defaults
  }
  return meta;
};

type FactoryGame = {
  name: string;
  status: "checking" | "ok" | "fail";
  toriiBaseUrl: string;
  startMainAt: number | null;
  endAt: number | null;
  registrationCount: number | null;
};

interface WorldSelectPanelProps {
  onSelect: (worldName: string) => void;
}

export const WorldSelectPanel = ({ onSelect }: WorldSelectPanelProps) => {
  const [saved, setSaved] = useState<string[]>(() => listWorldNames());
  const [selected, setSelected] = useState<string | null>(getActiveWorldName());
  const [statusMap, setStatusMap] = useState<Record<string, "checking" | "ok" | "fail">>({});
  const [factoryGames, setFactoryGames] = useState<FactoryGame[]>([]);
  const [factoryLoading, setFactoryLoading] = useState(false);
  const [factoryError, setFactoryError] = useState<string | null>(null);
  const [nowSec, setNowSec] = useState<number>(() => Math.floor(Date.now() / 1000));
  const account = useAccountStore((state) => state.account);
  const playerAddress = account?.address && account.address !== "0x0" ? account.address : null;

  // Ticking clock for countdowns
  useEffect(() => {
    const id = window.setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Check saved worlds availability
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const entries = await Promise.all(
        saved.map(async (n) => {
          const ok = await isToriiAvailable(`https://api.cartridge.gg/x/${n}/torii`);
          return [n, ok ? "ok" : "fail"] as const;
        }),
      );
      if (!cancelled) {
        const next: Record<string, "ok" | "fail"> = {};
        const offlineGames: string[] = [];
        entries.forEach(([k, v]) => {
          next[k] = v;
          if (v === "fail") offlineGames.push(k);
        });
        setStatusMap(next);

        // Auto-delete offline games
        if (offlineGames.length > 0) {
          offlineGames.forEach((n) => deleteWorldProfile(n));
          const updatedList = listWorldNames();
          setSaved(updatedList);
          if (selected && offlineGames.includes(selected)) {
            setSelected(null);
          }
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [saved, selected]);

  // Fetch factory games
  const loadFactoryGames = useCallback(async () => {
    try {
      setFactoryLoading(true);
      setFactoryError(null);

      const factorySqlBaseUrl = getFactorySqlBaseUrl(env.VITE_PUBLIC_CHAIN as "mainnet" | "sepolia" | "slot" | "local");
      if (!factorySqlBaseUrl) {
        setFactoryGames([]);
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

      const initial: FactoryGame[] = names.map((n) => ({
        name: n,
        status: "checking",
        toriiBaseUrl: buildToriiBaseUrl(n),
        startMainAt: null,
        endAt: null,
        registrationCount: null,
      }));
      setFactoryGames(initial);

      // Concurrency-limited status fetch
      const limit = 8;
      let index = 0;
      const work = async () => {
        while (index < initial.length) {
          const i = index++;
          const item = initial[i];
          try {
            const online = await isToriiAvailable(item.toriiBaseUrl);
            const meta = online ? await fetchWorldConfigMeta(item.toriiBaseUrl) : null;
            setFactoryGames((prev) => {
              const copy = [...prev];
              const idx = copy.findIndex((w) => w.name === item.name);
              if (idx >= 0)
                copy[idx] = {
                  ...copy[idx],
                  status: online ? "ok" : "fail",
                  startMainAt: meta?.startMainAt ?? null,
                  endAt: meta?.endAt ?? null,
                  registrationCount: meta?.registrationCount ?? null,
                };
              return copy;
            });
          } catch {
            setFactoryGames((prev) => {
              const copy = [...prev];
              const idx = copy.findIndex((w) => w.name === item.name);
              if (idx >= 0) copy[idx] = { ...copy[idx], status: "fail" };
              return copy;
            });
          }
        }
      };

      const workers: Promise<void>[] = [];
      for (let k = 0; k < limit; k++) workers.push(work());
      await Promise.all(workers);
    } catch (e: unknown) {
      setFactoryError(e instanceof Error ? e.message : String(e));
    } finally {
      setFactoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFactoryGames();
  }, [loadFactoryGames]);

  const handleSelectWorld = (worldName: string) => {
    setSelected(worldName);
  };

  const handleEnterWorld = (worldName: string) => {
    onSelect(worldName);
  };

  const getTimeLabel = (fg: FactoryGame) => {
    if (fg.startMainAt == null) return fg.status === "ok" ? "Not Configured" : "";

    if ((fg.endAt === 0 || fg.endAt == null) && fg.startMainAt != null) {
      if (nowSec < fg.startMainAt) return `Starts in ${formatCountdown(fg.startMainAt - nowSec)}`;
      return `Ongoing`;
    }

    const endT = fg.endAt as number;
    if (nowSec < fg.startMainAt) return `Starts in ${formatCountdown(fg.startMainAt - nowSec)}`;
    if (nowSec < endT) return `${formatCountdown(endT - nowSec)} left`;
    return `Ended`;
  };

  // Filter and sort games
  const onlineGames = factoryGames.filter((fg) => fg.status === "ok");
  const ongoingGames = onlineGames.filter(
    (fg) =>
      fg.startMainAt != null &&
      nowSec >= fg.startMainAt &&
      (fg.endAt === 0 || fg.endAt == null || nowSec < (fg.endAt as number)),
  );

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
              onClick={() => void loadFactoryGames()}
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
                    <span>{getTimeLabel(fg)}</span>
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
          onClick={() => void loadFactoryGames()}
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
