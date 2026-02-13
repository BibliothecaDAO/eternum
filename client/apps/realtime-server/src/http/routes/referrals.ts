import { randomUUID } from "crypto";

import { and, eq, gt, sql } from "drizzle-orm";
import { type Context, Hono } from "hono";

import {
  referralCreateSchema,
  referralLeaderboardQuerySchema,
  referralStatsQuerySchema,
  referralVerifyBodySchema,
} from "@bibliothecadao/types";
import { db } from "../../db/client";
import { referrals } from "../../db/schema/referrals";
import {
  buildReferralLeaderboard,
  calculateReferralPoints,
  normalizeReferralAddress,
  validateReferralRelationship,
} from "../../services/referrals/referral-leaderboard";
import type { AppEnv } from "../middleware/auth";
import { requirePlayerSession } from "../middleware/auth";
import { formatZodError } from "../utils/zod";

const STARKNET_ADDRESS_REGEX = /^0x[a-fA-F0-9]{1,64}$/;

const roundToTwoDecimals = (value: number): number => Math.round(value * 100) / 100;

const readVerifyKey = (c: Context<AppEnv>): string | null =>
  c.req.header("x-referral-verify-key") ?? c.req.header("x-verify-key") ?? null;

const requireVerifyKey = (c: Context<AppEnv>): boolean => {
  const expected = process.env.REFERRAL_VERIFY_API_KEY;
  if (!expected) {
    return false;
  }

  const received = readVerifyKey(c);
  return received === expected;
};

const referralRoutes = new Hono<AppEnv>();

referralRoutes.use("/*", async (c, next) => {
  if (process.env.REFERRALS_ENABLED === "false") {
    return c.json({ error: "Referrals are disabled." }, 404);
  }

  await next();
});

referralRoutes.post("/", requirePlayerSession, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = referralCreateSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(formatZodError(parsed.error), 400);
  }

  const payload = parsed.data;
  const session = c.get("playerSession")!;

  const relationship = validateReferralRelationship(payload.refereeAddress, payload.referrerAddress);
  if (!relationship.ok) {
    return c.json({ error: relationship.reason }, 400);
  }

  const sessionWallet = session.walletAddress?.trim() ?? "";
  if (sessionWallet && STARKNET_ADDRESS_REGEX.test(sessionWallet)) {
    const normalizedSessionWallet = normalizeReferralAddress(sessionWallet);
    if (normalizedSessionWallet !== payload.refereeAddress) {
      return c.json({ error: "Referee address must match the authenticated wallet address." }, 403);
    }
  }

  const [created] = await db
    .insert(referrals)
    .values({
      id: randomUUID(),
      refereeAddress: payload.refereeAddress,
      referrerAddress: payload.referrerAddress,
      refereeUsername: payload.refereeUsername ?? session.displayName ?? null,
      referrerUsername: payload.referrerUsername ?? null,
      source: payload.source,
      hasPlayed: false,
      gamesPlayed: 0,
      updatedAt: new Date(),
    })
    .onConflictDoNothing({
      target: referrals.refereeAddress,
    })
    .returning();

  if (!created) {
    return c.json({ error: "Referral already exists for this wallet." }, 409);
  }

  return c.json({ success: true, data: created }, 201);
});

referralRoutes.get("/leaderboard", async (c) => {
  const parsed = referralLeaderboardQuerySchema.safeParse({
    limit: c.req.query("limit") ? Number(c.req.query("limit")) : undefined,
  });

  if (!parsed.success) {
    return c.json(formatZodError(parsed.error), 400);
  }

  const rows = await db
    .select({
      referrerAddress: referrals.referrerAddress,
      referrerUsername: referrals.referrerUsername,
      hasPlayed: referrals.hasPlayed,
      gamesPlayed: referrals.gamesPlayed,
    })
    .from(referrals)
    .where(and(eq(referrals.hasPlayed, true), gt(referrals.gamesPlayed, 0)));

  const data = buildReferralLeaderboard(rows, parsed.data.limit ?? 50);
  return c.json({ data });
});

referralRoutes.get("/stats", async (c) => {
  const parsed = referralStatsQuerySchema.safeParse({
    referrerAddress: c.req.query("referrerAddress") ?? undefined,
  });

  if (!parsed.success) {
    return c.json(formatZodError(parsed.error), 400);
  }

  const session = c.get("playerSession");
  const fallbackAddress = session?.walletAddress && STARKNET_ADDRESS_REGEX.test(session.walletAddress)
    ? normalizeReferralAddress(session.walletAddress)
    : null;
  const referrerAddress = parsed.data.referrerAddress ?? fallbackAddress;

  if (!referrerAddress) {
    return c.json({ error: "Provide referrerAddress query or authenticate with a wallet address." }, 400);
  }

  const rows = await db
    .select({
      referrerAddress: referrals.referrerAddress,
      referrerUsername: referrals.referrerUsername,
      hasPlayed: referrals.hasPlayed,
      gamesPlayed: referrals.gamesPlayed,
    })
    .from(referrals)
    .where(sql`lower(${referrals.referrerAddress}) = ${referrerAddress}`);

  let referrerUsername: string | null = null;
  let referredPlayers = 0;
  let verifiedPlayers = 0;
  let totalGamesPlayed = 0;
  let totalPoints = 0;

  for (const row of rows) {
    referredPlayers += 1;
    if (!referrerUsername && row.referrerUsername) {
      referrerUsername = row.referrerUsername;
    }

    if (row.hasPlayed && row.gamesPlayed > 0) {
      verifiedPlayers += 1;
      totalGamesPlayed += row.gamesPlayed;
      totalPoints += calculateReferralPoints(row.gamesPlayed);
    }
  }

  return c.json({
    data: {
      referrerAddress,
      referrerUsername,
      referredPlayers,
      verifiedPlayers,
      totalGamesPlayed,
      totalPoints: roundToTwoDecimals(totalPoints),
    },
  });
});

referralRoutes.post("/verify", async (c) => {
  if (!requireVerifyKey(c)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = referralVerifyBodySchema.safeParse(body);

  if (!parsed.success) {
    return c.json(formatZodError(parsed.error), 400);
  }

  let updated = 0;

  for (const update of parsed.data.updates) {
    const [row] = await db
      .update(referrals)
      .set({
        gamesPlayed: update.gamesPlayed,
        hasPlayed: update.gamesPlayed > 0,
        verifiedAt: update.gamesPlayed > 0 ? new Date() : null,
        lastCheckedBlock: update.lastCheckedBlock ?? null,
        updatedAt: new Date(),
      })
      .where(eq(referrals.refereeAddress, update.refereeAddress))
      .returning({ id: referrals.id });

    if (row) {
      updated += 1;
    }
  }

  return c.json({ success: true, updated, total: parsed.data.updates.length });
});

referralRoutes.get("/verify/status", async (c) => {
  if (!requireVerifyKey(c)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const [totals] = await db
    .select({
      total: sql<number>`count(*)::int`,
      verified: sql<number>`count(*) FILTER (WHERE ${referrals.hasPlayed} = true)::int`,
    })
    .from(referrals);

  const total = totals?.total ?? 0;
  const verified = totals?.verified ?? 0;

  return c.json({
    data: {
      total,
      verified,
      unverified: Math.max(0, total - verified),
    },
  });
});

export default referralRoutes;
