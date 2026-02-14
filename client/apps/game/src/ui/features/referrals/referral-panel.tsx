import { useQuery } from "@tanstack/react-query";
import { useAccount } from "@starknet-react/core";
import { Copy, Trophy, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { fetchReferralLeaderboard, fetchReferralStats } from "./referral-api";
import { createReferralLink, normalizeReferralAddress } from "./referral-storage";

const REFERRAL_LEADERBOARD_LIMIT = 10;

const copyText = async (value: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
};

export const ReferralPanel = () => {
  const { address, isConnected } = useAccount();
  const [copied, setCopied] = useState(false);

  const normalizedAddress = useMemo(() => (address ? normalizeReferralAddress(address) : null), [address]);

  const referralLink = useMemo(() => {
    if (!normalizedAddress) {
      return "";
    }

    return createReferralLink(normalizedAddress);
  }, [normalizedAddress]);

  const statsQuery = useQuery({
    queryKey: ["referrals", "stats", normalizedAddress],
    enabled: Boolean(normalizedAddress),
    queryFn: async () => fetchReferralStats(normalizedAddress!),
  });

  const leaderboardQuery = useQuery({
    queryKey: ["referrals", "leaderboard", REFERRAL_LEADERBOARD_LIMIT],
    queryFn: async () => fetchReferralLeaderboard(REFERRAL_LEADERBOARD_LIMIT),
  });

  const handleCopy = async () => {
    if (!referralLink) {
      return;
    }

    const didCopy = await copyText(referralLink);
    setCopied(didCopy);
    if (didCopy) {
      window.setTimeout(() => setCopied(false), 1600);
    }
  };

  if (!isConnected || !normalizedAddress) {
    return (
      <section className="rounded-2xl border border-gold/10 bg-black/40 p-5">
        <h3 className="text-base font-semibold text-gold">Referral Program</h3>
        <p className="mt-2 text-sm text-gold/60">Connect your wallet to generate your referral link and track progress.</p>
      </section>
    );
  }

  const stats = statsQuery.data;

  return (
    <section className="space-y-4 rounded-2xl border border-gold/10 bg-black/40 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gold">Referral Program</h3>
          <p className="text-xs text-gold/60">Invite players and earn points when they actually play.</p>
        </div>
      </div>

      <div className="rounded-xl border border-gold/10 bg-black/30 p-3">
        <p className="mb-2 text-xs uppercase tracking-wide text-gold/50">Your Referral Link</p>
        <div className="flex gap-2">
          <input
            value={referralLink}
            readOnly
            className="w-full rounded-lg border border-gold/15 bg-black/50 px-3 py-2 text-xs text-gold/80"
          />
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="inline-flex items-center gap-1 rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-xs font-semibold text-gold transition hover:bg-gold/20"
          >
            <Copy className="h-3.5 w-3.5" />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-gold/10 bg-black/30 p-3">
          <p className="text-xs text-gold/50">Referred</p>
          <p className="text-lg font-semibold text-gold">{stats?.referredPlayers ?? 0}</p>
        </div>
        <div className="rounded-xl border border-gold/10 bg-black/30 p-3">
          <p className="text-xs text-gold/50">Verified</p>
          <p className="text-lg font-semibold text-gold">{stats?.verifiedPlayers ?? 0}</p>
        </div>
        <div className="rounded-xl border border-gold/10 bg-black/30 p-3">
          <p className="text-xs text-gold/50">Points</p>
          <p className="text-lg font-semibold text-gold">{stats?.totalPoints ?? 0}</p>
        </div>
      </div>

      <div className="rounded-xl border border-gold/10 bg-black/30 p-3">
        <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-gold/50">
          <Trophy className="h-3.5 w-3.5" />
          Top Referrers
        </div>
        {leaderboardQuery.isLoading ? (
          <p className="text-sm text-gold/60">Loading leaderboard...</p>
        ) : leaderboardQuery.data && leaderboardQuery.data.length > 0 ? (
          <ul className="space-y-2">
            {leaderboardQuery.data.map((entry) => (
              <li key={`${entry.referrerAddress}-${entry.rank}`} className="flex items-center justify-between text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="w-6 text-gold/50">#{entry.rank}</span>
                  <span className="truncate text-gold/80">{entry.referrerUsername || entry.referrerAddress}</span>
                </div>
                <div className="flex items-center gap-3 text-gold/60">
                  <span>{entry.points} pts</span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {entry.players}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gold/60">No verified referrals yet.</p>
        )}
      </div>

      {statsQuery.isError && <p className="text-xs text-red-300">Unable to load your referral stats right now.</p>}
      {leaderboardQuery.isError && <p className="text-xs text-red-300">Unable to load referral leaderboard right now.</p>}
    </section>
  );
};
