import { useUIStore } from "@/hooks/store/use-ui-store";
import { getActiveWorldName, getFactorySqlBaseUrl, listWorldNames } from "@/runtime/world";
import { isToriiAvailable } from "@/runtime/world/factory-resolver";
import { deleteWorldProfile } from "@/runtime/world/store";
import Button from "@/ui/design-system/atoms/button";
import { AlertCircle, Check, Globe, Loader2, Play, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { shortString } from "starknet";
import { env } from "../../../../env";

type FactoryGame = {
  name: string;
  status: "checking" | "ok" | "fail";
  toriiBaseUrl: string;
  startMainAt: number | null; // epoch seconds, if available
  endAt: number | null; // epoch seconds, if available
};

export const WorldSelectorModal = ({
  onConfirm,
  onCancel,
}: {
  onConfirm: (name: string) => void;
  onCancel: () => void;
}) => {
  const close = useUIStore((s) => s.setModal);
  const [saved, setSaved] = useState<string[]>(() => listWorldNames());
  const [selected, setSelected] = useState<string | null>(getActiveWorldName());
  const [nameInput, setNameInput] = useState("");
  const [inputStatus, setInputStatus] = useState<"idle" | "checking" | "ok" | "fail">("idle");
  const [statusMap, setStatusMap] = useState<Record<string, "checking" | "ok" | "fail">>({});
  const checkTimer = useRef<number | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const [factoryGames, setFactoryGames] = useState<FactoryGame[]>([]);
  const [factoryLoading, setFactoryLoading] = useState(false);
  const [factoryError, setFactoryError] = useState<string | null>(null);
  const [savedTimes, setSavedTimes] = useState<Record<string, { startMainAt: number | null; endAt: number | null }>>(
    {},
  );
  const [nowSec, setNowSec] = useState<number>(() => Math.floor(Date.now() / 1000));
  const [showEnded, setShowEnded] = useState(false);
  const [showAwaiting, setShowAwaiting] = useState(false);

  // Check saved worlds availability and auto-delete offline games
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

  // Debounced input availability check
  useEffect(() => {
    if (checkTimer.current) window.clearTimeout(checkTimer.current);
    if (!nameInput) {
      setInputStatus("idle");
      return;
    }
    setInputStatus("checking");
    checkTimer.current = window.setTimeout(async () => {
      const ok = await isToriiAvailable(`https://api.cartridge.gg/x/${nameInput}/torii`);
      setInputStatus(ok ? "ok" : "fail");
    }, 400) as any;
  }, [nameInput]);

  // Ticking clock for countdowns (1s)
  useEffect(() => {
    const id = window.setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Fetch season start time and end time for Saved Games that are online
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const toFetch = saved.filter((n) => statusMap[n] === "ok" && !(n in savedTimes));
      if (toFetch.length === 0) return;

      const limit = 6;
      let index = 0;
      const workers: Promise<void>[] = [];
      const work = async () => {
        while (!cancelled && index < toFetch.length) {
          const i = index++;
          const name = toFetch[i];
          const torii = `https://api.cartridge.gg/x/${name}/torii`;
          let startMainAt: number | null = null;
          let endAt: number | null = null;
          try {
            const q = `SELECT "season_config.start_main_at" AS start_main_at, "season_config.end_at" AS end_at FROM "s1_eternum-WorldConfig" LIMIT 1;`;
            const u = `${torii}/sql?query=${encodeURIComponent(q)}`;
            const r = await fetch(u);
            if (r.ok) {
              const arr = (await r.json()) as any[];
              if (arr && arr[0]) {
                if (arr[0].start_main_at != null) {
                  startMainAt = parseMaybeHexToNumber(arr[0].start_main_at);
                }
                if (arr[0].end_at != null) {
                  endAt = parseMaybeHexToNumber(arr[0].end_at);
                }
              }
            }
          } catch {
            // ignore per-world errors
          }
          if (!cancelled) {
            setSavedTimes((prev) => ({ ...prev, [name]: { startMainAt, endAt } }));
          }
        }
      };
      for (let k = 0; k < limit; k++) workers.push(work());
      await Promise.all(workers);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [saved, statusMap, savedTimes]);

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

  // Helpers for factory world listing
  const decodePaddedFeltAscii = (hex: string): string => {
    try {
      if (!hex) return "";
      const h = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
      if (h === "0") return "";
      // prefer starknet shortString if possible
      try {
        const asDec = BigInt("0x" + h).toString();
        const decoded = shortString.decodeShortString(asDec);
        if (decoded && decoded.trim().length > 0) return decoded;
      } catch {
        // ignore and fallback to manual decode
      }
      // manual hex → ascii (skip leading 00 bytes)
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

  const parseMaybeHexToNumber = (v: any): number | null => {
    if (v == null) return null;
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      try {
        if (v.startsWith("0x") || v.startsWith("0X")) return Number(BigInt(v));
        // decimal string
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      } catch {
        return null;
      }
    }
    return null;
  };

  // Fetch recent factory games (up to 1000), check Torii, then fetch season start time
  const loadFactoryGames = async () => {
    try {
      setFactoryLoading(true);
      setFactoryError(null);

      const factorySqlBaseUrl = getFactorySqlBaseUrl(env.VITE_PUBLIC_CHAIN as any);
      if (!factorySqlBaseUrl) {
        setFactoryGames([]);
        return;
      }

      // Query last 1000 deployments; conservative ordering-less fallback
      const query = `SELECT name FROM [wf-WorldDeployed] LIMIT 1000;`;
      const url = `${factorySqlBaseUrl}?query=${encodeURIComponent(query)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Factory query failed: ${res.status} ${res.statusText}`);
      const rows = (await res.json()) as any[];

      // Extract and dedupe names
      const names: string[] = [];
      const seen = new Set<string>();
      for (const row of rows) {
        const feltHex: string | undefined =
          (row && (row.name as string)) || (row && (row["data.name"] as string)) || (row && row?.data?.name);
        if (!feltHex || typeof feltHex !== "string") continue;
        const decoded = decodePaddedFeltAscii(feltHex);
        if (!decoded || seen.has(decoded)) continue;
        seen.add(decoded);
        names.push(decoded);
      }

      const initial: FactoryGame[] = names.map((n) => ({
        name: n,
        status: "checking",
        toriiBaseUrl: `https://api.cartridge.gg/x/${n}/torii`,
        startMainAt: null,
        endAt: null,
      }));
      setFactoryGames(initial);

      // Concurrency-limited status + time fetch
      const limit = 8;
      let index = 0;
      const workers: Promise<void>[] = [];
      const work = async () => {
        while (index < initial.length) {
          const i = index++;
          const item = initial[i];
          try {
            const online = await isToriiAvailable(item.toriiBaseUrl);
            let startMainAt: number | null = null;
            let endAt: number | null = null;
            if (online) {
              try {
                const q = `SELECT "season_config.start_main_at" AS start_main_at, "season_config.end_at" AS end_at FROM "s1_eternum-WorldConfig" LIMIT 1;`;
                const u = `${item.toriiBaseUrl}/sql?query=${encodeURIComponent(q)}`;
                const r = await fetch(u);
                if (r.ok) {
                  const arr = (await r.json()) as any[];
                  if (arr && arr[0]) {
                    if (arr[0].start_main_at != null) {
                      startMainAt = parseMaybeHexToNumber(arr[0].start_main_at);
                    }
                    if (arr[0].end_at != null) {
                      endAt = parseMaybeHexToNumber(arr[0].end_at);
                    }
                  }
                }
              } catch {
                // ignore per-world time errors
              }
            }
            setFactoryGames((prev) => {
              const copy = [...prev];
              const idx = copy.findIndex((w) => w.name === item.name);
              if (idx >= 0) copy[idx] = { ...copy[idx], status: online ? "ok" : "fail", startMainAt, endAt };
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

      for (let k = 0; k < limit; k++) workers.push(work());
      await Promise.all(workers);
    } catch (e: any) {
      setFactoryError(e?.message || String(e));
    } finally {
      setFactoryLoading(false);
    }
  };

  useEffect(() => {
    void loadFactoryGames();
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        cancel();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  const confirm = () => {
    const toUse = nameInput || selected;
    if (!toUse) return;
    close(null, false);
    onConfirm(toUse);
  };

  const cancel = () => {
    close(null, false);
    onCancel();
  };

  const handleRemoveWorld = (worldName: string) => {
    deleteWorldProfile(worldName);
    setSaved(listWorldNames());
    if (selected === worldName) setSelected(null);
  };

  const handleEnterGame = (worldName: string) => {
    const status = statusMap[worldName];
    if (status !== "ok") return; // Don't allow entering offline games

    close(null, false);
    onConfirm(worldName);
  };

  const handleDoubleClick = (worldName: string) => {
    handleEnterGame(worldName);
  };

  const handleEnterFactoryGame = (worldName: string) => {
    // For factory entries we already gate by their own online status in UI
    close(null, false);
    onConfirm(worldName);
  };

  const isGameOnline = (worldName: string) => {
    return statusMap[worldName] === "ok";
  };

  const renderFactoryItem = (fg: FactoryGame) => {
    const isOnline = fg.status === "ok";
    const isUnconfigured = fg.startMainAt == null && isOnline;
    const isEnded = fg.startMainAt != null && fg.endAt != null && fg.endAt !== 0 && nowSec >= (fg.endAt as number);

    const startAtText = (() => {
      if (fg.startMainAt == null) return isOnline && fg.status !== "checking" ? "Not Configured" : "";

      // If endAt is 0 (or null) and there's a start time, show infinity
      if ((fg.endAt === 0 || fg.endAt == null) && fg.startMainAt != null) {
        if (nowSec < fg.startMainAt) return `Starts in ${formatCountdown(fg.startMainAt - nowSec)}`;
        return `Ongoing — ∞`;
      }

      // Normal case with endAt
      const endT = fg.endAt as number;
      if (nowSec < fg.startMainAt) return `Starts in ${formatCountdown(fg.startMainAt - nowSec)}`;
      if (nowSec < endT) return `Ongoing — ${formatCountdown(endT - nowSec)} left`;
      return `Ended at ${new Date(endT * 1000).toLocaleString()}`;
    })();

    return (
      <div
        key={fg.name}
        className={`group relative rounded-lg border-2 p-4 transition-all duration-200 ${
          isOnline ? "cursor-pointer" : "cursor-default"
        } ${
          nameInput === fg.name
            ? isEnded
              ? "border-gold/40 bg-brown/20 shadow-lg shadow-gold/10 opacity-70"
              : isUnconfigured
                ? "border-gold/60 bg-gold/5 shadow-lg shadow-gold/10"
                : "border-gold bg-gold/10 shadow-lg shadow-gold/20"
            : isEnded
              ? "border-gold/10 bg-brown/20 hover:bg-brown/30 hover:border-gold/20 opacity-60"
              : isUnconfigured
                ? "border-gold/30 bg-gold/5 hover:bg-gold/10 hover:border-gold/40 opacity-80"
                : "border-gold/20 bg-brown/40 hover:bg-brown/60 hover:border-gold/40"
        }`}
        onClick={() => setNameInput(fg.name)}
        onDoubleClick={() => isOnline && handleEnterFactoryGame(fg.name)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div
                className={`truncate font-bold text-base ${
                  isEnded ? "text-gold/50" : isUnconfigured ? "text-gold/70" : "text-gold"
                }`}
              >
                {fg.name}
              </div>
              {nameInput === fg.name && (
                <div className="flex-shrink-0 p-1 rounded-full bg-gold/20">
                  <Check className="w-3 h-3 text-gold" />
                </div>
              )}
            </div>
            {startAtText && (
              <div
                className={`text-sm md:text-base font-semibold mt-1 ${
                  isEnded ? "text-white/40" : isUnconfigured ? "text-white/60" : "text-white"
                }`}
              >
                {startAtText}
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            {/* Status Badge */}
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide border ${
                fg.status === "ok"
                  ? "bg-brilliance/10 text-brilliance border-brilliance/30"
                  : fg.status === "fail"
                    ? "bg-danger/10 text-danger border-danger/30"
                    : "bg-gold/10 text-gold/60 border-gold/20"
              }`}
            >
              {fg.status === "ok" ? (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-brilliance animate-pulse" />
                  Online
                </>
              ) : fg.status === "fail" ? (
                <>
                  <AlertCircle className="w-3 h-3" />
                  Offline
                </>
              ) : (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Checking
                </>
              )}
            </span>

            {/* Action Buttons */}
            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {/* Enter Game Button */}
              {isOnline && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEnterFactoryGame(fg.name);
                  }}
                  className="p-1.5 rounded-md bg-brilliance/10 text-brilliance border border-brilliance/30 hover:bg-brilliance/20 transition-all"
                  title="Enter game"
                >
                  <Play className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brown/90 backdrop-blur-sm p-4">
      <div
        ref={modalRef}
        className="w-full max-w-4xl border-2 border-gold/30 bg-brown/95 panel-wood rounded-lg shadow-2xl shadow-black/50 overflow-hidden"
      >
        {/* Header */}
        <div className="relative border-b-2 border-gold/20 bg-gradient-to-b from-brown/80 to-transparent p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-gold/10 border border-gold/30">
                <Globe className="w-6 h-6 text-gold" />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-gold uppercase">Select Game</h2>
                <p className="text-sm text-gold/60 mt-1">Choose your game </p>
              </div>
            </div>
            <Button onClick={cancel} variant="outline" size="md">
              Cancel
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Add New Game on top */}

          {/* Two columns: Factory left, Saved right */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Factory games (left) */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
                <div className="text-xs font-semibold uppercase tracking-widest text-gold/80 px-2">Factory Games</div>
                {factoryLoading && (
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide bg-gold/10 text-gold border border-gold/30">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Loading
                  </span>
                )}
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
                <button
                  onClick={() => void loadFactoryGames()}
                  disabled={factoryLoading}
                  className="p-1.5 rounded-md bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Refresh factory games"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${factoryLoading ? "animate-spin" : ""}`} />
                </button>
              </div>

              {saved.length > 0 && (
                <div className="rounded-lg border border-gold/20 bg-gold/5 p-2 mb-2">
                  <p className="text-[10px] text-gold/60 text-center">
                    <span className="font-semibold">Tip:</span> Double-click to enter • Hover for actions
                  </p>
                </div>
              )}

              {/* Offline summary + bulk delete */}
              {/* {saved.length > 0 && (
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] text-gold/60">
                    Offline saved games: {saved.filter((n) => statusMap[n] === "fail").length}
                  </div>
                  <button
                    onClick={handleRemoveOfflineSaved}
                    className="text-[10px] px-2 py-1 rounded border border-danger/30 text-danger hover:bg-danger/10 transition-colors"
                  >
                    Delete Offline
                  </button>
                </div>
              )} */}

              {/* Filters */}
              {/* <div className="flex items-center justify-between gap-3 mb-2">
                <div className="text-[10px] text-gold/60">
                  {factoryLoading
                    ? "Loading factory deployments..."
                    : factoryError
                      ? `Error: ${factoryError}`
                      : `Found ${factoryGames.filter((g) => g.status === "ok").length} online games`}
                </div>
                <div className="text-[10px] text-gold/60">Ordering: Starts next</div>
              </div> */}

              {/* Factory list container with visible loading overlay when refreshing */}
              <div className="relative">
                <div
                  className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar"
                  aria-busy={factoryLoading ? true : undefined}
                  aria-live="polite"
                >
                  {factoryLoading && factoryGames.length === 0 ? (
                    <div className="rounded-lg border-2 border-dashed border-gold/20 p-8 text-center">
                      <Loader2 className="w-12 h-12 text-gold/50 mx-auto mb-3 animate-spin" />
                      <p className="text-sm text-gold/60 font-semibold">Loading factory games...</p>
                      <p className="text-xs text-gold/40 mt-1">Fetching available worlds from the factory</p>
                    </div>
                  ) : factoryError ? (
                    <div className="rounded-lg border-2 border-danger/30 bg-danger/5 p-6 text-center">
                      <AlertCircle className="w-12 h-12 text-danger/60 mx-auto mb-2" />
                      <p className="text-sm text-danger font-semibold">Failed to load factory games</p>
                      <p className="text-xs text-danger/70 mt-1">{factoryError}</p>
                      <button
                        onClick={() => void loadFactoryGames()}
                        className="mt-3 px-3 py-1.5 text-xs rounded-md bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20 transition-all"
                      >
                        Try Again
                      </button>
                    </div>
                  ) : factoryGames.length === 0 ? (
                    <div className="rounded-lg border-2 border-dashed border-gold/20 p-6 text-center">
                      <Globe className="w-12 h-12 text-gold/30 mx-auto mb-2" />
                      <p className="text-sm text-gold/60">No factory games found</p>
                      <p className="text-xs text-gold/40 mt-1">Check back later for new worlds</p>
                    </div>
                  ) : (
                    (() => {
                      const online = factoryGames.filter((fg) => fg.status === "ok");
                      const upcoming = online
                        .filter((fg) => fg.startMainAt != null && nowSec < (fg.startMainAt as number))
                        .sort((a, b) => (a.startMainAt as number) - (b.startMainAt as number));
                      const ongoing = online
                        .filter(
                          (fg) =>
                            fg.startMainAt != null &&
                            nowSec >= (fg.startMainAt as number) &&
                            (fg.endAt === 0 || fg.endAt == null || nowSec < (fg.endAt as number)),
                        )
                        .sort((a, b) => {
                          // Infinite games (endAt === 0 or null) should be sorted by start time
                          if ((a.endAt === 0 || a.endAt == null) && (b.endAt === 0 || b.endAt == null)) {
                            return (a.startMainAt as number) - (b.startMainAt as number);
                          }
                          if (a.endAt === 0 || a.endAt == null) return -1; // Infinite games first
                          if (b.endAt === 0 || b.endAt == null) return 1;
                          // Sort by time remaining (soonest to end first)
                          return (a.endAt as number) - nowSec - ((b.endAt as number) - nowSec);
                        });
                      const ended = online
                        .filter(
                          (fg) =>
                            fg.startMainAt != null &&
                            fg.endAt != null &&
                            fg.endAt !== 0 &&
                            nowSec >= (fg.endAt as number),
                        )
                        .sort((a, b) => (b.endAt as number) - (a.endAt as number));
                      const unknown = online
                        .filter((fg) => fg.startMainAt == null)
                        .sort((a, b) => a.name.localeCompare(b.name));

                      return (
                        <>
                          {ongoing.length > 0 && (
                            <>
                              <div className="flex items-center gap-2 my-2">
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
                                <div className="text-[10px] font-semibold uppercase tracking-widest text-gold/80 px-2">
                                  Ongoing
                                </div>
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
                              </div>
                              {ongoing.map((fg) => renderFactoryItem(fg))}
                            </>
                          )}
                          {upcoming.length > 0 && (
                            <>
                              <div className="flex items-center gap-2 my-2">
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
                                <div className="text-[10px] font-semibold uppercase tracking-widest text-gold/80 px-2">
                                  Upcoming
                                </div>
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
                              </div>
                              {upcoming.map((fg) => renderFactoryItem(fg))}
                            </>
                          )}
                          {ended.length > 0 && (
                            <>
                              <button
                                onClick={() => setShowEnded(!showEnded)}
                                className="flex items-center gap-2 my-2 w-full hover:opacity-80 transition-opacity cursor-pointer"
                              >
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
                                <div className="text-[10px] font-semibold uppercase tracking-widest text-gold/80 px-2">
                                  Ended ({ended.length}) {showEnded ? "▲" : "▼"}
                                </div>
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
                              </button>
                              {showEnded && ended.map((fg) => renderFactoryItem(fg))}
                            </>
                          )}
                          {unknown.length > 0 && (
                            <>
                              <button
                                onClick={() => setShowAwaiting(!showAwaiting)}
                                className="flex items-center gap-2 my-2 w-full hover:opacity-80 transition-opacity cursor-pointer"
                              >
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
                                <div className="text-[10px] font-semibold uppercase tracking-widest text-gold/80 px-2">
                                  Awaiting Configuration ({unknown.length}) {showAwaiting ? "▲" : "▼"}
                                </div>
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
                              </button>
                              {showAwaiting && unknown.map((fg) => renderFactoryItem(fg))}
                            </>
                          )}
                        </>
                      );
                    })()
                  )}
                </div>
                {factoryLoading && factoryGames.length > 0 && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-brown/80 backdrop-blur-sm">
                    <div className="text-center">
                      <Loader2 className="w-10 h-10 text-gold animate-spin mx-auto mb-2" />
                      <p className="text-sm text-gold font-semibold">Refreshing factory games…</p>
                      <p className="text-xs text-gold/70">Updating world availability and timers</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Saved worlds (right) */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
                <div className="text-xs font-semibold uppercase tracking-widest text-gold/80 px-2">Recent Games</div>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
              </div>

              {saved.length > 0 && (
                <div className="rounded-lg border border-gold/20 bg-gold/5 p-2 mb-2">
                  <p className="text-[10px] text-gold/60 text-center">
                    <span className="font-semibold">Tip:</span> Double-click to enter • Hover for actions
                  </p>
                </div>
              )}

              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {saved.length === 0 && (
                  <div className="rounded-lg border-2 border-dashed border-gold/20 p-6 text-center">
                    <Globe className="w-12 h-12 text-gold/30 mx-auto mb-2" />
                    <p className="text-sm text-gold/60">No recent games yet</p>
                    <p className="text-xs text-gold/40 mt-1">Enter a world name to begin your conquest</p>
                  </div>
                )}
                {(() => {
                  // Categorize saved games
                  const categorized = saved.map((s) => {
                    const isOnline = isGameOnline(s);
                    const timeData = savedTimes[s];
                    const isEnded =
                      isOnline &&
                      timeData?.startMainAt != null &&
                      timeData?.endAt != null &&
                      timeData.endAt !== 0 &&
                      nowSec >= timeData.endAt;
                    const isOngoing =
                      isOnline &&
                      timeData?.startMainAt != null &&
                      nowSec >= timeData.startMainAt &&
                      (timeData.endAt === 0 || timeData.endAt == null || nowSec < timeData.endAt);
                    const isUpcoming = isOnline && timeData?.startMainAt != null && nowSec < timeData.startMainAt;

                    return { name: s, isOnline, timeData, isEnded, isOngoing, isUpcoming };
                  });

                  // Sort: live (ongoing) first, then upcoming, then ended, then others
                  const live = categorized.filter((g) => g.isOngoing);
                  const upcoming = categorized.filter((g) => g.isUpcoming);
                  const ended = categorized.filter((g) => g.isEnded);
                  const others = categorized.filter((g) => !g.isOngoing && !g.isUpcoming && !g.isEnded);

                  const sorted = [...live, ...upcoming, ...ended, ...others];

                  return sorted.map(({ name: s, isOnline, isEnded }) => (
                    <div
                      key={s}
                      className={`group relative rounded-lg border-2 p-4 transition-all duration-200 cursor-pointer ${
                        selected === s
                          ? isOnline
                            ? isEnded
                              ? "border-gold/40 bg-brown/20 shadow-lg shadow-gold/10 opacity-70"
                              : "border-gold bg-gold/10 shadow-lg shadow-gold/20"
                            : "border-danger/50 bg-danger/5 shadow-lg shadow-danger/10"
                          : isOnline
                            ? isEnded
                              ? "border-gold/10 bg-brown/20 hover:bg-brown/30 hover:border-gold/20 opacity-60"
                              : "border-gold/20 bg-brown/40 hover:bg-brown/60 hover:border-gold/40"
                            : "border-danger/40 bg-danger/5 hover:bg-danger/10"
                      }`}
                      onClick={() => setSelected(s)}
                      onDoubleClick={() => handleDoubleClick(s)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`truncate font-bold text-base ${isEnded ? "text-gold/50" : "text-gold"}`}>
                              {s}
                            </div>
                            {selected === s && (
                              <div className="flex-shrink-0 p-1 rounded-full bg-gold/20">
                                <Check className="w-3 h-3 text-gold" />
                              </div>
                            )}
                          </div>
                          {isOnline &&
                            savedTimes[s] != null &&
                            savedTimes[s].startMainAt != null &&
                            (() => {
                              const timeData = savedTimes[s];
                              const startT = timeData.startMainAt as number;
                              const endT = timeData.endAt;

                              let content: string;
                              if (nowSec < startT) {
                                content = `Starts in ${formatCountdown(startT - nowSec)}`;
                              } else if (endT === 0 || endT == null) {
                                // Infinite game
                                content = `Ongoing — ∞`;
                              } else if (nowSec < endT) {
                                content = `Ongoing — ${formatCountdown(endT - nowSec)} left`;
                              } else {
                                content = `Ended at ${new Date(endT * 1000).toLocaleString()}`;
                              }

                              return (
                                <div
                                  className={`text-sm md:text-base font-semibold mt-1 ${
                                    isEnded ? "text-white/40" : "text-white"
                                  }`}
                                >
                                  {`${content}`}
                                </div>
                              );
                            })()}
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          {/* Status Badge */}
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide border ${
                              statusMap[s] === "ok"
                                ? "bg-brilliance/10 text-brilliance border-brilliance/30"
                                : statusMap[s] === "fail"
                                  ? "bg-danger/10 text-danger border-danger/30"
                                  : "bg-gold/10 text-gold/60 border-gold/20"
                            }`}
                          >
                            {statusMap[s] === "ok" ? (
                              <>
                                <div className="w-1.5 h-1.5 rounded-full bg-brilliance animate-pulse" />
                                Online
                              </>
                            ) : statusMap[s] === "fail" ? (
                              <>
                                <AlertCircle className="w-3 h-3" />
                                Offline
                              </>
                            ) : (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Checking
                              </>
                            )}
                          </span>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {/* Enter Game Button */}
                            {isOnline && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEnterGame(s);
                                }}
                                className="p-1.5 rounded-md bg-brilliance/10 text-brilliance border border-brilliance/30 hover:bg-brilliance/20 transition-all"
                                title="Enter game"
                              >
                                <Play className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {/* Delete Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveWorld(s);
                              }}
                              className="p-1.5 rounded-md text-danger/60 hover:text-danger hover:bg-danger/10 border border-transparent hover:border-danger/30"
                              title="Remove game"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        </div>
        {/* Footer removed; actions moved to header */}
      </div>

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
