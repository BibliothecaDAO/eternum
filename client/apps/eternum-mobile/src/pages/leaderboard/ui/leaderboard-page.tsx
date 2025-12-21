import { useLeaderboardStore } from "@/features/leaderboard";
import { displayAddress, currencyIntlFormat } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { useAccount } from "@starknet-react/core";
import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export function LeaderboardPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { address } = useAccount();

  const entries = useLeaderboardStore((state) => state.entries);
  const isFetching = useLeaderboardStore((state) => state.isFetching);
  const error = useLeaderboardStore((state) => state.error);
  const lastUpdatedAt = useLeaderboardStore((state) => state.lastUpdatedAt);
  const playerEntries = useLeaderboardStore((state) => state.playerEntries);
  const fetchLeaderboard = useLeaderboardStore((state) => state.fetchLeaderboard);
  const fetchPlayerEntry = useLeaderboardStore((state) => state.fetchPlayerEntry);

  useEffect(() => {
    void fetchLeaderboard({ force: false, limit: 50 });
  }, [fetchLeaderboard]);

  useEffect(() => {
    if (address) {
      void fetchPlayerEntry(address, { force: false });
    }
  }, [address, fetchPlayerEntry]);

  const normalizedAddress = address?.toLowerCase();
  const playerEntry = normalizedAddress ? (playerEntries[normalizedAddress]?.data ?? null) : null;

  const filteredEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return entries;
    return entries.filter((entry) => {
      const name = entry.displayName?.toLowerCase() ?? "";
      return name.includes(query) || entry.address.toLowerCase().includes(query);
    });
  }, [entries, searchQuery]);

  const lastUpdatedLabel = lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString() : "—";

  return (
    <div className="min-h-screen space-y-4 bg-gradient-to-br from-background to-muted/20 p-4 pb-24">
      <Card className="space-y-3 border-border/60 bg-card/80 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Leaderboard</h1>
            <p className="text-xs text-muted-foreground">Active game standings.</p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => fetchLeaderboard({ force: true, limit: 50 })}
            disabled={isFetching}
          >
            <RefreshCw className={`mr-2 h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Last updated: {lastUpdatedLabel}</span>
        </div>
        <Input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search by player or address"
        />
      </Card>

      {error ? (
        <Card className="border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</Card>
      ) : null}

      {playerEntry ? (
        <Card className="border-border/60 bg-card/80 p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Your rank</div>
          <div className="mt-2 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">
                #{playerEntry.rank} {playerEntry.displayName ?? displayAddress(playerEntry.address)}
              </div>
              <div className="text-xs text-muted-foreground">{displayAddress(playerEntry.address)}</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold">{currencyIntlFormat(playerEntry.points, 2)}</div>
              <div className="text-xs text-muted-foreground">points</div>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="space-y-2">
        {filteredEntries.length === 0 ? (
          <Card className="border-border/60 bg-card/80 p-4 text-sm text-muted-foreground">No players found.</Card>
        ) : (
          filteredEntries.map((entry) => (
            <Card key={entry.address} className="flex items-center justify-between border-border/60 bg-card/80 p-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold">
                  #{entry.rank} {entry.displayName ?? displayAddress(entry.address)}
                </div>
                <div className="text-xs text-muted-foreground">{displayAddress(entry.address)}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold">{currencyIntlFormat(entry.points, 2)}</div>
                <div className="text-[10px] text-muted-foreground">points</div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
