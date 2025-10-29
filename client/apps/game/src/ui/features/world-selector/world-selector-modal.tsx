import { useUIStore } from "@/hooks/store/use-ui-store";
import { getActiveWorldName, getFactorySqlBaseUrl, listWorldNames } from "@/runtime/world";
import { isToriiAvailable } from "@/runtime/world/factory-resolver";
import { deleteWorldProfile } from "@/runtime/world/store";
import Button from "@/ui/design-system/atoms/button";
import { AlertCircle, Check, Globe, Loader2, Play, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { shortString } from "starknet";
import { env } from "../../../../env";

type FactoryGame = {
  name: string;
  status: "checking" | "ok" | "fail";
  toriiBaseUrl: string;
  startMainAt: number | null; // epoch seconds, if available
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
  const [savedTimes, setSavedTimes] = useState<Record<string, number | null>>({});
  const [nowSec, setNowSec] = useState<number>(() => Math.floor(Date.now() / 1000));
  const GAME_DURATION_SEC = 2 * 60 * 60; // 2 hours

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

  // Fetch season start time for Saved Games that are online
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
          try {
            const q = `SELECT "season_config.start_main_at" AS start_main_at FROM "s1_eternum-WorldConfig" LIMIT 1;`;
            const u = `${torii}/sql?query=${encodeURIComponent(q)}`;
            const r = await fetch(u);
            if (r.ok) {
              const arr = (await r.json()) as any[];
              if (arr && arr[0] && arr[0].start_main_at != null) {
                startMainAt = parseMaybeHexToNumber(arr[0].start_main_at);
              }
            }
          } catch {
            // ignore per-world errors
          }
          if (!cancelled) {
            setSavedTimes((prev) => ({ ...prev, [name]: startMainAt }));
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
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
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
        }));
        if (!cancelled) setFactoryGames(initial);

        // Concurrency-limited status + time fetch
        const limit = 8;
        let index = 0;
        const workers: Promise<void>[] = [];
        const work = async () => {
          while (!cancelled && index < initial.length) {
            const i = index++;
            const item = initial[i];
            try {
              const online = await isToriiAvailable(item.toriiBaseUrl);
              let startMainAt: number | null = null;
              if (online) {
                try {
                  const q = `SELECT "season_config.start_main_at" AS start_main_at FROM "s1_eternum-WorldConfig" LIMIT 1;`;
                  const u = `${item.toriiBaseUrl}/sql?query=${encodeURIComponent(q)}`;
                  const r = await fetch(u);
                  if (r.ok) {
                    const arr = (await r.json()) as any[];
                    if (arr && arr[0] && arr[0].start_main_at != null) {
                      startMainAt = parseMaybeHexToNumber(arr[0].start_main_at);
                    }
                  }
                } catch {
                  // ignore per-world time errors
                }
              }
              if (!cancelled) {
                setFactoryGames((prev) => {
                  const copy = [...prev];
                  const idx = copy.findIndex((w) => w.name === item.name);
                  if (idx >= 0) copy[idx] = { ...copy[idx], status: online ? "ok" : "fail", startMainAt };
                  return copy;
                });
              }
            } catch {
              if (!cancelled) {
                setFactoryGames((prev) => {
                  const copy = [...prev];
                  const idx = copy.findIndex((w) => w.name === item.name);
                  if (idx >= 0) copy[idx] = { ...copy[idx], status: "fail" };
                  return copy;
                });
              }
            }
          }
        };

        for (let k = 0; k < limit; k++) workers.push(work());
        await Promise.all(workers);
      } catch (e: any) {
        if (!cancelled) setFactoryError(e?.message || String(e));
      } finally {
        if (!cancelled) setFactoryLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
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
    const startAtText = (() => {
      if (fg.startMainAt == null) return isOnline && fg.status !== "checking" ? "Not Configured" : "";
      const endT = fg.startMainAt + GAME_DURATION_SEC;
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
            ? "border-gold bg-gold/10 shadow-lg shadow-gold/20"
            : "border-gold/20 bg-brown/40 hover:bg-brown/60 hover:border-gold/40"
        }`}
        onClick={() => setNameInput(fg.name)}
        onDoubleClick={() => isOnline && handleEnterFactoryGame(fg.name)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="truncate font-bold text-gold text-base">{fg.name}</div>
              {nameInput === fg.name && (
                <div className="flex-shrink-0 p-1 rounded-full bg-gold/20">
                  <Check className="w-3 h-3 text-gold" />
                </div>
              )}
            </div>
            <div className="font-mono text-xs text-gold/50 truncate">api.cartridge.gg/x/{fg.name}/torii</div>
            {startAtText && (
              <div className="text-sm md:text-base text-white font-semibold mt-1">Game time: {startAtText}</div>
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
                <p className="text-sm text-gold/60 mt-1">Choose your world to enter the eternal conflict</p>
              </div>
            </div>
            <Button onClick={cancel} variant="outline" size="md">Cancel</Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Add New Game on top */}
          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
              <div className="text-xs font-semibold uppercase tracking-widest text-gold/80 px-2">Add New Game</div>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
            </div>

            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    className="w-full rounded-lg border-2 border-gold/30 bg-brown/60 px-4 py-3 text-gold placeholder-gold/40 outline-none focus:border-gold focus:bg-brown/80 transition-all duration-200 font-mono"
                    placeholder="gamecode-12345"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value.trim())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && nameInput) {
                        confirm();
                      }
                    }}
                  />
                  {nameInput && (
                    <button
                      onClick={() => setNameInput("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded text-gold/40 hover:text-gold transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <Button onClick={confirm} disabled={!nameInput} variant="gold" size="md">
                  Enter Game
                </Button>
              </div>

              {/* Status */}
              {nameInput && (
                <div className="flex items-center gap-2 p-3 rounded-lg border border-gold/20 bg-brown/40">
                  {inputStatus === "checking" && (
                    <>
                      <Loader2 className="w-4 h-4 text-gold/60 animate-spin" />
                      <span className="text-sm text-gold/60">Checking availability...</span>
                    </>
                  )}
                  {inputStatus === "ok" && (
                    <>
                      <div className="p-1 rounded-full bg-brilliance/20">
                        <Check className="w-3 h-3 text-brilliance" />
                      </div>
                      <span className="text-sm font-semibold text-brilliance">Game is online and available</span>
                    </>
                  )}
                  {inputStatus === "fail" && (
                    <>
                      <div className="p-1 rounded-full bg-danger/20">
                        <AlertCircle className="w-3 h-3 text-danger" />
                      </div>
                      <span className="text-sm font-semibold text-danger">Game is not reachable</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Two columns: Factory left, Saved right */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Factory games (left) */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
                <div className="text-xs font-semibold uppercase tracking-widest text-gold/80 px-2">Factory Games</div>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
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

              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {(() => {
                  const online = factoryGames.filter((fg) => fg.status === "ok");
                  const upcoming = online
                    .filter((fg) => fg.startMainAt != null && nowSec < (fg.startMainAt as number))
                    .sort((a, b) => (a.startMainAt as number) - (b.startMainAt as number));
                  const ongoing = online
                    .filter(
                      (fg) =>
                        fg.startMainAt != null &&
                        nowSec >= (fg.startMainAt as number) &&
                        nowSec < (fg.startMainAt as number) + GAME_DURATION_SEC,
                    )
                    .sort(
                      (a, b) =>
                        (a.startMainAt as number) + GAME_DURATION_SEC - nowSec - ((b.startMainAt as number) + GAME_DURATION_SEC - nowSec),
                    );
                  const ended = online
                    .filter((fg) => fg.startMainAt != null && nowSec >= (fg.startMainAt as number) + GAME_DURATION_SEC)
                    .sort((a, b) => (b.startMainAt as number) - (a.startMainAt as number));
                  const unknown = online.filter((fg) => fg.startMainAt == null).sort((a, b) => a.name.localeCompare(b.name));

                  return (
                    <>
                      {upcoming.length > 0 && (
                        <>
                          <div className="flex items-center gap-2 my-2">
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
                            <div className="text-[10px] font-semibold uppercase tracking-widest text-gold/80 px-2">Upcoming</div>
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
                          </div>
                          {upcoming.map((fg) => renderFactoryItem(fg))}
                        </>
                      )}
                      {ongoing.length > 0 && (
                        <>
                          <div className="flex items-center gap-2 my-2">
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
                            <div className="text-[10px] font-semibold uppercase tracking-widest text-gold/80 px-2">Ongoing</div>
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
                          </div>
                          {ongoing.map((fg) => renderFactoryItem(fg))}
                        </>
                      )}
                      {ended.length > 0 && (
                        <>
                          <div className="flex items-center gap-2 my-2">
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
                            <div className="text-[10px] font-semibold uppercase tracking-widest text-gold/80 px-2">Ended</div>
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
                          </div>
                          {ended.map((fg) => renderFactoryItem(fg))}
                        </>
                      )}
                      {unknown.length > 0 && (
                        <>
                          <div className="flex items-center gap-2 my-2">
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
                            <div className="text-[10px] font-semibold uppercase tracking-widest text-gold/80 px-2">Unknown</div>
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
                          </div>
                          {unknown.map((fg) => renderFactoryItem(fg))}
                        </>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Saved worlds (right) */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
                <div className="text-xs font-semibold uppercase tracking-widest text-gold/80 px-2">Saved Games</div>
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
                    <p className="text-sm text-gold/60">No saved games yet</p>
                    <p className="text-xs text-gold/40 mt-1">Enter a world name to begin your conquest</p>
                  </div>
                )}
                {saved.map((s) => {
                  const isOnline = isGameOnline(s);

                  return (
                    <div
                      key={s}
                      className={`group relative rounded-lg border-2 p-4 transition-all duration-200 cursor-pointer ${
                        selected === s
                          ? isOnline
                            ? "border-gold bg-gold/10 shadow-lg shadow-gold/20"
                            : "border-danger/50 bg-danger/5 shadow-lg shadow-danger/10"
                          : isOnline
                            ? "border-gold/20 bg-brown/40 hover:bg-brown/60 hover:border-gold/40"
                            : "border-danger/40 bg-danger/5 hover:bg-danger/10"
                      }`}
                      onClick={() => setSelected(s)}
                      onDoubleClick={() => handleDoubleClick(s)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="truncate font-bold text-gold text-base">{s}</div>
                            {selected === s && (
                              <div className="flex-shrink-0 p-1 rounded-full bg-gold/20">
                                <Check className="w-3 h-3 text-gold" />
                              </div>
                            )}
                          </div>
                          <div className="font-mono text-xs text-gold/50 truncate">api.cartridge.gg/x/{s}/torii</div>
                          {isOnline && savedTimes[s] != null && (
                            (() => {
                              const t = savedTimes[s] as number;
                              const endT = t + GAME_DURATION_SEC;
                              const content =
                                nowSec < t
                                  ? `Starts in ${formatCountdown(t - nowSec)}`
                                  : nowSec < endT
                                    ? `Ongoing — ${formatCountdown(endT - nowSec)} left`
                                    : `Ended at ${new Date(endT * 1000).toLocaleString()}`;
                              return (
                                <div className="text-sm md:text-base text-white font-semibold mt-1">{`Game time: ${content}`}</div>
                              );
                            })()
                          )}
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
                  );
                })}
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
