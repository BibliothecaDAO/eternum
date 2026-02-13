import { z } from "zod";

import { DISPLAY_NAME_MAX_LENGTH } from "./chat/shared";

export const starknetReferralAddressSchema = z
  .string()
  .trim()
  .regex(/^0x[a-fA-F0-9]{1,64}$/, "Invalid Starknet address format.")
  .transform((value) => `0x${value.slice(2).toLowerCase()}`);

export const referralSourceSchema = z.enum(["dashboard", "landing", "direct", "unknown"]);

export const referralCreateSchema = z.object({
  refereeAddress: starknetReferralAddressSchema,
  referrerAddress: starknetReferralAddressSchema,
  refereeUsername: z.string().trim().max(DISPLAY_NAME_MAX_LENGTH).optional(),
  referrerUsername: z.string().trim().max(DISPLAY_NAME_MAX_LENGTH).optional(),
  source: referralSourceSchema.optional().default("unknown"),
});

export const referralLeaderboardQuerySchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
});

export const referralLeaderboardEntrySchema = z.object({
  rank: z.number().int().min(1),
  referrerAddress: starknetReferralAddressSchema,
  referrerUsername: z.string().trim().max(DISPLAY_NAME_MAX_LENGTH).nullable().optional(),
  players: z.number().int().min(0),
  points: z.number().min(0),
});

export const referralStatsQuerySchema = z.object({
  referrerAddress: starknetReferralAddressSchema.optional(),
});

export const referralStatsSchema = z.object({
  referrerAddress: starknetReferralAddressSchema,
  referrerUsername: z.string().trim().max(DISPLAY_NAME_MAX_LENGTH).nullable().optional(),
  referredPlayers: z.number().int().min(0),
  verifiedPlayers: z.number().int().min(0),
  totalGamesPlayed: z.number().int().min(0),
  totalPoints: z.number().min(0),
});

export const referralVerifyBodySchema = z.object({
  updates: z
    .array(
      z.object({
        refereeAddress: starknetReferralAddressSchema,
        gamesPlayed: z.number().int().min(0),
        lastCheckedBlock: z.number().int().min(0).optional(),
      }),
    )
    .min(1)
    .max(500),
});

export interface ReferralCreatePayload extends z.infer<typeof referralCreateSchema> {}
export interface ReferralLeaderboardEntry extends z.infer<typeof referralLeaderboardEntrySchema> {}
export interface ReferralStats extends z.infer<typeof referralStatsSchema> {}
