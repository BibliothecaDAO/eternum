import { z } from "zod";

import {
  entityIdSchema,
  mapLocationSchema,
  messageContentSchema,
  metadataSchema,
  playerIdSchema,
  timestampSchema,
  zoneIdSchema,
} from "./shared";

const NOTE_TITLE_MAX_LENGTH = 120;

export const noteTitleSchema = z
  .string()
  .trim()
  .min(1, "Note title is required.")
  .max(NOTE_TITLE_MAX_LENGTH, "Note title is too long.");

export const noteSchema = z.object({
  id: entityIdSchema,
  authorId: playerIdSchema,
  zoneId: zoneIdSchema,
  title: noteTitleSchema,
  content: messageContentSchema.max(1000),
  location: mapLocationSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema.optional(),
  expiresAt: timestampSchema.optional(),
  metadata: metadataSchema.optional(),
});

export const noteCreateSchema = z.object({
  zoneId: zoneIdSchema,
  title: noteTitleSchema,
  content: messageContentSchema.max(1000),
  location: mapLocationSchema,
  expiresAt: timestampSchema.optional(),
  metadata: metadataSchema.optional(),
});

export const noteUpdateSchema = z.object({
  id: entityIdSchema,
  title: noteTitleSchema.optional(),
  content: messageContentSchema.max(1000).optional(),
  expiresAt: timestampSchema.optional(),
  metadata: metadataSchema.optional(),
});

export const noteDeleteSchema = z.object({
  id: entityIdSchema,
});

export const noteListQuerySchema = z.object({
  zoneId: zoneIdSchema,
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
  since: timestampSchema.optional(),
});

export interface PlayerNote extends z.infer<typeof noteSchema> {}
export interface PlayerNoteCreate extends z.infer<typeof noteCreateSchema> {}
export interface PlayerNoteUpdate extends z.infer<typeof noteUpdateSchema> {}
export interface PlayerNoteListQuery
  extends z.infer<typeof noteListQuerySchema> {}
