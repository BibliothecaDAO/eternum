import { z } from "zod";

export const ENTITY_ID_MAX_LENGTH = 191;
export const PLAYER_ID_MAX_LENGTH = 191;
export const ZONE_ID_MAX_LENGTH = 128;
export const DISPLAY_NAME_MAX_LENGTH = 64;
export const MESSAGE_MAX_LENGTH = 2000;
const METADATA_MAX_KEYS = 20;
const METADATA_MAX_BYTES = 4096;
const METADATA_MAX_DEPTH = 3;

export const entityIdSchema = z
  .string()
  .min(1, "Entity id is required.")
  .max(ENTITY_ID_MAX_LENGTH, "Entity id is too long.");

export const playerIdSchema = z
  .string()
  .min(1, "Player id is required.")
  .max(PLAYER_ID_MAX_LENGTH, "Player id is too long.")
  .refine((value) => !value.includes("|"), "Player id contains a reserved delimiter.");

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

const metadataDepth = (value: unknown, depth = 0): number => {
  if (value === null || typeof value !== "object") return depth;
  const children = Array.isArray(value) ? value : Object.values(value);
  return children.reduce((maximum, child) => Math.max(maximum, metadataDepth(child, depth + 1)), depth);
};

export const metadataSchema = z.record(z.string(), z.unknown()).superRefine((value, context) => {
  if (Object.keys(value).length > METADATA_MAX_KEYS) {
    context.addIssue({ code: "custom", message: `Metadata cannot contain more than ${METADATA_MAX_KEYS} keys.` });
  }
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > METADATA_MAX_BYTES) {
    context.addIssue({ code: "custom", message: `Metadata cannot exceed ${METADATA_MAX_BYTES} bytes.` });
  }
  if (metadataDepth(value) > METADATA_MAX_DEPTH) {
    context.addIssue({ code: "custom", message: `Metadata cannot exceed depth ${METADATA_MAX_DEPTH}.` });
  }
});

export interface MapLocation extends z.infer<typeof mapLocationSchema> {}
export interface EntityMetadata extends z.infer<typeof metadataSchema> {}
