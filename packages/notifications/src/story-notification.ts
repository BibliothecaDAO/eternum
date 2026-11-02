import { logicalStoryIdentity, parseNotificationPayload, type LocalNotificationPayload } from "./delivery";
import type { NotificationCopy } from "./story-copy";
import { kindTag, lifetimeOf } from "./notification-kinds";
import { storyNotificationRule } from "./story-policy";

/** Shared display content and logical identity for live-page and server delivery. */
export function buildStoryNotification(input: {
  sourceId: string;
  /** The history model the value came from; StoryEvent unless it is a native battle or raid. */
  model?: string;
  /** The account the alert is for, which native battles and raids need to tell victory from defeat. */
  recipient?: string;
  value: Record<string, unknown>;
  owner: string;
  gameName: string;
  target: string;
  now: number;
}): LocalNotificationPayload | null {
  const read = readHistoryStory(input.model ?? "StoryEvent", input.value);
  if (!read) throw new Error(`Not a notification story: ${input.model}`);
  const { story, payload } = read;
  const rule = storyNotificationRule(story);
  if ("excluded" in rule) throw new Error(`Not a notified story: ${story}`);
  const createdAt = storyNotificationCreatedAt(input.value);
  const expiresAt = createdAt + lifetimeOf(rule.kind);
  if (expiresAt <= input.now) return null;
  const copy = rule.copy({ payload, recipient: input.recipient });
  return parseNotificationPayload(
    {
      version: 1,
      owner: input.owner,
      id: logicalStoryIdentity(input.sourceId, story, input.value, payload),
      title: copy.title,
      body: `${input.gameName}: ${copy.body}`,
      tag: kindTag(rule.kind, input.target),
      target: input.target,
      createdAt,
      expiresAt,
      kind: rule.kind,
    },
    input.now,
  );
}

/** One voice for live-page and background game alerts: the copy each delivered story's rule names. */
export function storyNotificationCopy(
  story: string,
  payload: Record<string, unknown>,
  recipient?: string,
): NotificationCopy {
  const rule = storyNotificationRule(story);
  if ("excluded" in rule) throw new Error(`Not a notified story: ${story}`);
  return rule.copy({ payload, recipient });
}

/**
 * A story from the history cursor: a StoryEvent names its variant inside the value, while a native battle or raid is
 * its own event whose value is the payload. The cursor also carries events that are not stories (recorded executions,
 * batch progress, points); those are null.
 */
export function readHistoryStory(
  model: string,
  value: Record<string, unknown>,
): { story: string; payload: Record<string, unknown> } | null {
  if (model === "BattleEvent" || model === "RaidEvent") return { story: model, payload: value };
  if (model !== "StoryEvent") return null;
  return readNotificationStory(value);
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
