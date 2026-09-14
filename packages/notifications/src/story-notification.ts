import { logicalStoryIdentity, parseNotificationPayload, type LocalNotificationPayload } from "./delivery";

/** Shared display content and logical identity for live-page and server delivery. */
export function buildStoryNotification(input: {
  sourceId: string;
  value: Record<string, unknown>;
  owner: string;
  gameName: string;
  target: string;
  now: number;
}): LocalNotificationPayload | null {
  const { story, payload } = readNotificationStory(input.value);
  const createdAt = storyNotificationCreatedAt(input.value);
  if (createdAt + 120_000 <= input.now) return null;
  return parseNotificationPayload(
    {
      version: 1,
      owner: input.owner,
      id: logicalStoryIdentity(input.sourceId, story, input.value, payload),
      title:
        story === "BattleStory" ? "Battle confirmed" : story.replace(/Story$/, "").replace(/([a-z])([A-Z])/g, "$1 $2"),
      body: `${input.gameName}: new confirmed activity involving you.`,
      target: input.target,
      createdAt,
      expiresAt: createdAt + 120_000,
    },
    input.now,
  );
}
export function readNotificationStory(value: Record<string, unknown>): {
  story: string;
  payload: Record<string, unknown>;
} {
  if (!value.story || typeof value.story !== "object" || Array.isArray(value.story))
    throw new Error("Invalid notification story");
  const entries = Object.entries(value.story);
  if (entries.length !== 1) throw new Error("Invalid notification story variant");
  const [story, payload] = entries[0];
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    throw new Error("Invalid notification story payload");
  return { story, payload: payload as Record<string, unknown> };
}

export function storyNotificationCreatedAt(value: Record<string, unknown>): number {
  const timestamp = value.timestamp;
  if (
    !(
      typeof timestamp === "number" ||
      typeof timestamp === "bigint" ||
      (typeof timestamp === "string" && /^(?:0x[0-9a-f]+|[0-9]+)$/i.test(timestamp))
    )
  )
    throw new Error("Invalid story timestamp");
  const createdAt = Number(timestamp) * 1000;
  if (!Number.isSafeInteger(createdAt) || createdAt < 0) throw new Error("Invalid story timestamp");
  return createdAt;
}
