import { z } from "zod";

export const ENTITY_ID_MAX_LENGTH = 191;
export const PLAYER_ID_MAX_LENGTH = 191;
export const ZONE_ID_MAX_LENGTH = 128;
export const DISPLAY_NAME_MAX_LENGTH = 64;
export const MESSAGE_MAX_LENGTH = 2000;

export const entityIdSchema = z
  .string()
  .min(1, "Entity id is required.")
  .max(ENTITY_ID_MAX_LENGTH, "Entity id is too long.");

export const playerIdSchema = z
  .string()
  .min(1, "Player id is required.")
  .max(PLAYER_ID_MAX_LENGTH, "Player id is too long.");

export const starknetAddressSchema = z.string().regex(/^0x[0-9a-fA-F]{63,66}$/, "Invalid Starknet address.");

export const zoneIdSchema = z.string().min(1, "Zone id is required.").max(ZONE_ID_MAX_LENGTH, "Zone id is too long.");

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Display name is required.")
  .max(DISPLAY_NAME_MAX_LENGTH, "Display name is too long.");

export const timestampSchema = z.union([
  z.date(),
  z.string().datetime({ offset: true, message: "Invalid timestamp format." }),
]);

export const mapLocationSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite().optional(),
});

export const messageContentSchema = z
  .string()
  .trim()
  .min(1, "Message content is required.")
  .max(MESSAGE_MAX_LENGTH, "Message content is too long.");

export const metadataSchema = z.record(z.string(), z.unknown());

export interface MapLocation extends z.infer<typeof mapLocationSchema> {}
export interface EntityMetadata extends z.infer<typeof metadataSchema> {}
