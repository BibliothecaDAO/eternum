const REALTIME_SERVER_URL = (import.meta.env.VITE_PUBLIC_REALTIME_URL as string | undefined) ?? "http://localhost:8080";

export interface ReferralCreatePayload {
  refereeAddress: string;
  referrerAddress: string;
  refereeUsername?: string;
  referrerUsername?: string;
  source?: "dashboard" | "landing" | "direct" | "unknown";
}

export interface ReferralLeaderboardEntry {
  rank: number;
  referrerAddress: string;
  referrerUsername?: string | null;
  players: number;
  points: number;
}

export interface ReferralStats {
  referrerAddress: string;
  referrerUsername?: string | null;
  referredPlayers: number;
  verifiedPlayers: number;
  totalGamesPlayed: number;
  totalPoints: number;
}

export interface ReferralSessionHeaders {
  playerId: string;
  walletAddress: string;
  displayName?: string | null;
}

const STARKNET_ADDRESS_REGEX = /^0x[a-fA-F0-9]{1,64}$/;

const normalizeAddress = (value: string): string => `0x${value.trim().toLowerCase().replace(/^0x/, "")}`;

const isValidAddress = (value: unknown): value is string => typeof value === "string" && STARKNET_ADDRESS_REGEX.test(value);

const toSessionHeaders = (session: ReferralSessionHeaders): HeadersInit => {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "x-player-id": session.playerId,
    "x-wallet-address": session.walletAddress,
  };

  if (session.displayName?.trim()) {
    headers["x-player-name"] = session.displayName.trim();
  }

  return headers;
};

const parseError = async (response: Response): Promise<string> => {
  const body = await response.json().catch(() => null);
  return body?.error ?? `Request failed with status ${response.status}`;
};

const parseLeaderboardEntries = (value: unknown): ReferralLeaderboardEntry[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((row): ReferralLeaderboardEntry | null => {
      if (typeof row !== "object" || row === null) {
        return null;
      }

      const candidate = row as Record<string, unknown>;
      if (
        typeof candidate.rank !== "number" ||
        !isValidAddress(candidate.referrerAddress) ||
        typeof candidate.players !== "number" ||
        typeof candidate.points !== "number"
      ) {
        return null;
      }

      return {
        rank: candidate.rank,
        referrerAddress: normalizeAddress(candidate.referrerAddress),
        referrerUsername: typeof candidate.referrerUsername === "string" ? candidate.referrerUsername : null,
        players: candidate.players,
        points: candidate.points,
      };
    })
    .filter((row): row is ReferralLeaderboardEntry => row !== null);
};

const parseStats = (value: unknown): ReferralStats => {
  if (typeof value !== "object" || value === null) {
    throw new Error("Invalid referral stats payload");
  }

  const candidate = value as Record<string, unknown>;
  if (
    !isValidAddress(candidate.referrerAddress) ||
    typeof candidate.referredPlayers !== "number" ||
    typeof candidate.verifiedPlayers !== "number" ||
    typeof candidate.totalGamesPlayed !== "number" ||
    typeof candidate.totalPoints !== "number"
  ) {
    throw new Error("Invalid referral stats payload");
  }

  return {
    referrerAddress: normalizeAddress(candidate.referrerAddress),
    referrerUsername: typeof candidate.referrerUsername === "string" ? candidate.referrerUsername : null,
    referredPlayers: candidate.referredPlayers,
    verifiedPlayers: candidate.verifiedPlayers,
    totalGamesPlayed: candidate.totalGamesPlayed,
    totalPoints: candidate.totalPoints,
  };
};

export const submitReferral = async (
  payload: ReferralCreatePayload,
  session: ReferralSessionHeaders,
): Promise<{ status: "created" | "duplicate" }> => {
  const response = await fetch(`${REALTIME_SERVER_URL}/api/referrals`, {
    method: "POST",
    headers: toSessionHeaders(session),
    body: JSON.stringify(payload),
  });

  if (response.status === 409) {
    return { status: "duplicate" };
  }

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return { status: "created" };
};

export const fetchReferralLeaderboard = async (limit = 20): Promise<ReferralLeaderboardEntry[]> => {
  const response = await fetch(`${REALTIME_SERVER_URL}/api/referrals/leaderboard?limit=${encodeURIComponent(limit)}`);

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const body = (await response.json()) as { data?: unknown };
  return parseLeaderboardEntries(body.data);
};

export const fetchReferralStats = async (referrerAddress: string): Promise<ReferralStats> => {
  const response = await fetch(
    `${REALTIME_SERVER_URL}/api/referrals/stats?referrerAddress=${encodeURIComponent(referrerAddress)}`,
  );

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const body = (await response.json()) as { data?: unknown };
  return parseStats(body.data);
};
