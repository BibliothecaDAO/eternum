import { describe, expect, it } from "vitest";
import { Hono } from "hono";

import type { ReferralCreatePayload } from "@bibliothecadao/types";
import { attachPlayerSession, type AppEnv } from "../../middleware/auth";
import { createReferralRoutes, type ReferralRepository } from "../referrals";

type ReferralRecord = {
  id: string;
  refereeAddress: string;
  referrerAddress: string;
  refereeUsername: string | null;
  referrerUsername: string | null;
  source: string;
  hasPlayed: boolean;
  gamesPlayed: number;
  lastCheckedBlock: number | null;
  verifiedAt: Date | null;
  updatedAt: Date;
};

const createInMemoryRepo = (seed: ReferralRecord[] = []): ReferralRepository => {
  const rows = new Map<string, ReferralRecord>(seed.map((row) => [row.refereeAddress, row]));

  return {
    async createReferral(input) {
      if (rows.has(input.refereeAddress)) {
        return null;
      }

      const next: ReferralRecord = {
        id: input.id,
        refereeAddress: input.refereeAddress,
        referrerAddress: input.referrerAddress,
        refereeUsername: input.refereeUsername,
        referrerUsername: input.referrerUsername,
        source: input.source,
        hasPlayed: input.hasPlayed,
        gamesPlayed: input.gamesPlayed,
        lastCheckedBlock: null,
        verifiedAt: null,
        updatedAt: input.updatedAt,
      };

      rows.set(next.refereeAddress, next);
      return next;
    },
    async listLeaderboardRows() {
      return Array.from(rows.values()).map((row) => ({
        referrerAddress: row.referrerAddress,
        referrerUsername: row.referrerUsername,
        hasPlayed: row.hasPlayed,
        gamesPlayed: row.gamesPlayed,
      }));
    },
    async listReferrerRows(referrerAddress) {
      return Array.from(rows.values())
        .filter((row) => row.referrerAddress === referrerAddress)
        .map((row) => ({
          referrerAddress: row.referrerAddress,
          referrerUsername: row.referrerUsername,
          hasPlayed: row.hasPlayed,
          gamesPlayed: row.gamesPlayed,
        }));
    },
    async updateReferralVerification(input) {
      const row = rows.get(input.refereeAddress);
      if (!row) {
        return false;
      }

      row.gamesPlayed = input.gamesPlayed;
      row.hasPlayed = input.gamesPlayed > 0;
      row.verifiedAt = input.gamesPlayed > 0 ? new Date() : null;
      row.lastCheckedBlock = input.lastCheckedBlock ?? null;
      row.updatedAt = input.updatedAt;
      return true;
    },
    async getVerificationTotals() {
      const all = Array.from(rows.values());
      const verified = all.filter((row) => row.hasPlayed).length;
      return {
        total: all.length,
        verified,
      };
    },
  };
};

const buildApp = (repo: ReferralRepository) => {
  const app = new Hono<AppEnv>();
  app.use("*", attachPlayerSession);
  app.route(
    "/api/referrals",
    createReferralRoutes({
      repo,
      referralsEnabled: true,
      verifyApiKey: "test-secret",
    }),
  );
  return app;
};

const createPayload = (overrides: Partial<ReferralCreatePayload> = {}): ReferralCreatePayload => ({
  refereeAddress: "0xaaa",
  referrerAddress: "0xbbb",
  source: "dashboard",
  ...overrides,
});

describe("referral routes", () => {
  it("rejects referral creation when wallet identity is missing", async () => {
    const app = buildApp(createInMemoryRepo());

    const response = await app.request("/api/referrals", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-player-id": "player-1",
      },
      body: JSON.stringify(createPayload()),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: "A valid wallet address is required.",
    });
  });

  it("creates referrals and blocks duplicates", async () => {
    const app = buildApp(createInMemoryRepo());

    const first = await app.request("/api/referrals", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-player-id": "player-1",
        "x-wallet-address": "0xaaa",
      },
      body: JSON.stringify(createPayload()),
    });

    expect(first.status).toBe(201);

    const second = await app.request("/api/referrals", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-player-id": "player-1",
        "x-wallet-address": "0xaaa",
      },
      body: JSON.stringify(createPayload()),
    });

    expect(second.status).toBe(409);
  });

  it("returns aggregated leaderboard rows", async () => {
    const app = buildApp(
      createInMemoryRepo([
        {
          id: "r1",
          refereeAddress: "0x1",
          referrerAddress: "0xabc",
          refereeUsername: null,
          referrerUsername: "alpha",
          source: "dashboard",
          hasPlayed: true,
          gamesPlayed: 2,
          lastCheckedBlock: null,
          verifiedAt: null,
          updatedAt: new Date(),
        },
        {
          id: "r2",
          refereeAddress: "0x2",
          referrerAddress: "0xabc",
          refereeUsername: null,
          referrerUsername: null,
          source: "dashboard",
          hasPlayed: true,
          gamesPlayed: 3,
          lastCheckedBlock: null,
          verifiedAt: null,
          updatedAt: new Date(),
        },
      ]),
    );

    const response = await app.request("/api/referrals/leaderboard");
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      rank: 1,
      referrerAddress: "0xabc",
      players: 2,
    });
  });

  it("enforces verify auth and applies updates", async () => {
    const app = buildApp(
      createInMemoryRepo([
        {
          id: "r1",
          refereeAddress: "0xaaa",
          referrerAddress: "0xabc",
          refereeUsername: null,
          referrerUsername: null,
          source: "dashboard",
          hasPlayed: false,
          gamesPlayed: 0,
          lastCheckedBlock: null,
          verifiedAt: null,
          updatedAt: new Date(),
        },
      ]),
    );

    const unauthorized = await app.request("/api/referrals/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        updates: [{ refereeAddress: "0xaaa", gamesPlayed: 4 }],
      }),
    });

    expect(unauthorized.status).toBe(401);

    const authorized = await app.request("/api/referrals/verify", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-referral-verify-key": "test-secret",
      },
      body: JSON.stringify({
        updates: [{ refereeAddress: "0xaaa", gamesPlayed: 4, lastCheckedBlock: 100 }],
      }),
    });

    expect(authorized.status).toBe(200);
    expect(await authorized.json()).toMatchObject({ updated: 1, total: 1 });

    const status = await app.request("/api/referrals/verify/status", {
      headers: { "x-referral-verify-key": "test-secret" },
    });

    expect(status.status).toBe(200);
    expect(await status.json()).toMatchObject({
      data: {
        total: 1,
        verified: 1,
        unverified: 0,
      },
    });
  });
});
