import { RefreshButton } from "@/ui/design-system/atoms/refresh-button";
import { displayAddress } from "@/ui/utils/utils";
import { fetchFaithLeaderboard, type FaithLeaderboardEntry } from "@/services/leaderboard/faith-leaderboard-service";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const AUTO_REFRESH_INTERVAL_MS = 30_000;

const formatIntegerWithCommas = (value: number): string => value.toLocaleString("en-US");

const formatBigIntWithCommas = (value: bigint): string => {
  const sign = value < 0n ? "-" : "";
  const digits = (value < 0n ? -value : value).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${grouped}`;
};

const isZeroAddress = (address: string): boolean => {
  return /^0x0+$/i.test(address.trim());
};

const buildOwnerLabel = (entry: FaithLeaderboardEntry): string => {
  if (entry.ownerName?.trim()) {
    return entry.ownerName.trim();
  }

  if (isZeroAddress(entry.ownerAddress)) {
    return "Unclaimed";
  }

  return displayAddress(entry.ownerAddress);
};

export const FaithLeaderboardPanel = () => {
  const [entries, setEntries] = useState<FaithLeaderboardEntry[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  const requestInFlightRef = useRef(false);

  const loadLeaderboard = useCallback(async (mode: "initial" | "refresh") => {
    if (requestInFlightRef.current) {
      return;
    }

    requestInFlightRef.current = true;

    if (mode === "initial") {
      setIsInitialLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      const nextEntries = await fetchFaithLeaderboard();
      setEntries(nextEntries);
      setError(null);
      setLastUpdatedAt(Date.now());
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Failed to load faith leaderboard.";
      setError(message);
    } finally {
      requestInFlightRef.current = false;
      if (mode === "initial") {
        setIsInitialLoading(false);
      } else {
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadLeaderboard("initial");
  }, [loadLeaderboard]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadLeaderboard("refresh");
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadLeaderboard]);

  const updatedLabel = useMemo(() => {
    if (!lastUpdatedAt) {
      return "Not synced yet";
    }

    return new Date(lastUpdatedAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }, [lastUpdatedAt]);

  const hasEntries = entries.length > 0;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-gold">Faith Leaderboard</span>
          <span className="text-[11px] text-gold/65">Last update: {updatedLabel}</span>
          <span className="text-[10px] text-gold/50">Total FP includes estimated unclaimed points from FP/sec.</span>
        </div>
        <RefreshButton
          onClick={() => {
            void loadLeaderboard("refresh");
          }}
          isLoading={isRefreshing}
          disabled={isInitialLoading || isRefreshing}
          size="md"
          aria-label="Refresh faith leaderboard"
        />
      </div>

      {isInitialLoading ? (
        <div className="flex h-full items-center justify-center text-xs text-gold/70">Loading faith leaderboard...</div>
      ) : error ? (
        <div className="rounded-lg border border-red-400/25 bg-red-950/20 p-3 text-xs text-red-200/90">{error}</div>
      ) : !hasEntries ? (
        <div className="flex h-full items-center justify-center text-xs text-gold/70">
          No wonder faith data found for this world.
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-gold/15 bg-black/30">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="sticky top-0 z-10 bg-[#1d160e] text-gold/80">
              <tr>
                <th className="px-3 py-2 text-center font-semibold">#</th>
                <th className="px-3 py-2 font-semibold">Wonder</th>
                <th className="px-3 py-2 font-semibold">Owner</th>
                <th className="px-3 py-2 text-right font-semibold">Total FP</th>
                <th className="px-3 py-2 text-right font-semibold">FP/sec</th>
                <th className="px-3 py-2 text-right font-semibold">Followers</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.wonderId.toString()} className="border-t border-gold/10 text-gold/90">
                  <td className="px-3 py-2 text-center">{entry.rank}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col">
                      <span className="font-semibold text-gold">{entry.wonderName}</span>
                      <span className="text-[11px] text-gold/60">Wonder #{entry.wonderId.toString()}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col">
                      <span className="font-medium text-gold">{buildOwnerLabel(entry)}</span>
                      <span className="text-[11px] text-gold/60">
                        {isZeroAddress(entry.ownerAddress) ? "No owner recorded" : displayAddress(entry.ownerAddress)}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{formatBigIntWithCommas(entry.totalFaithPoints)}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatIntegerWithCommas(entry.faithPointsPerSecond)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{formatIntegerWithCommas(entry.followerCount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
