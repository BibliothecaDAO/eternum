export const REFERRAL_POINTS_EXPONENT = 1.3;

export interface ReferralLeaderboardInput {
  referrerAddress: string;
  referrerUsername?: string | null;
  hasPlayed: boolean;
  gamesPlayed: number;
}

export interface ReferralLeaderboardRow {
  rank: number;
  referrerAddress: string;
  referrerUsername: string | null;
  players: number;
  points: number;
}

const roundToTwoDecimals = (value: number): number => Math.round(value * 100) / 100;

export const normalizeReferralAddress = (value: string): string => `0x${value.trim().toLowerCase().replace(/^0x/, "")}`;

export const calculateReferralPoints = (gamesPlayed: number): number => {
  if (!Number.isFinite(gamesPlayed) || gamesPlayed <= 0) {
    return 0;
  }

  return Math.pow(gamesPlayed, REFERRAL_POINTS_EXPONENT);
};

export const validateReferralRelationship = (
  refereeAddress: string,
  referrerAddress: string,
): { ok: true } | { ok: false; reason: string } => {
  if (normalizeReferralAddress(refereeAddress) === normalizeReferralAddress(referrerAddress)) {
    return { ok: false, reason: "Cannot refer yourself." };
  }

  return { ok: true };
};

export const buildReferralLeaderboard = (
  rows: ReferralLeaderboardInput[],
  limit = 100,
): ReferralLeaderboardRow[] => {
  const cappedLimit = Math.max(1, Math.min(limit, 100));

  const aggregated = new Map<string, Omit<ReferralLeaderboardRow, "rank">>();

  for (const row of rows) {
    if (!row.hasPlayed || row.gamesPlayed <= 0) {
      continue;
    }

    const normalizedAddress = normalizeReferralAddress(row.referrerAddress);
    const existing = aggregated.get(normalizedAddress);
    const points = calculateReferralPoints(row.gamesPlayed);

    if (!existing) {
      aggregated.set(normalizedAddress, {
        referrerAddress: normalizedAddress,
        referrerUsername: row.referrerUsername?.trim() || null,
        players: 1,
        points,
      });
      continue;
    }

    aggregated.set(normalizedAddress, {
      ...existing,
      players: existing.players + 1,
      points: existing.points + points,
      referrerUsername: existing.referrerUsername ?? row.referrerUsername?.trim() ?? null,
    });
  }

  return Array.from(aggregated.values())
    .map((entry) => ({
      ...entry,
      points: roundToTwoDecimals(entry.points),
    }))
    .sort((a, b) => {
      if (b.points !== a.points) {
        return b.points - a.points;
      }
      if (b.players !== a.players) {
        return b.players - a.players;
      }
      return a.referrerAddress.localeCompare(b.referrerAddress);
    })
    .slice(0, cappedLimit)
    .map((entry, index) => ({
      rank: index + 1,
      ...entry,
    }));
};
