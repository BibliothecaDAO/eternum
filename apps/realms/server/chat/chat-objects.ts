/**
 * The chat objects, by the class name Cloudflare lists each namespace under, and how many one retention call names.
 * The deploy reads both (deploy/first/publish.ts) without loading the Worker, so this module imports nothing.
 */
export const CHAT_OBJECT_CLASSES = ["ChatRoom", "ChatInbox"] as const;
export type ChatObjectClass = (typeof CHAT_OBJECT_CLASSES)[number];

/** The most objects one call names: each is a subrequest, and a Worker request has a thousand. */
export const CHAT_RETENTION_BATCH = 100;
