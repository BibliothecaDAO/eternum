import * as Schema from "effect/Schema";
import { decodeNotification } from "./validation";

export const NOTIFICATION_LEVELS = ["off", "important", "standard", "all"] as const;
export type NotificationLevel = (typeof NOTIFICATION_LEVELS)[number];

export const NOTIFICATION_LEVEL_DESCRIPTIONS: Record<NotificationLevel, string> = {
  off: "No game notifications.",
  important: "Battles, structure captures, day-end reminders and direct messages involving you.",
  standard: "Important activity, settlements, buildings, upgrades, rewards and arrivals.",
  all: "Standard activity plus production, transfers and troop activity.",
};

export const includesDirectMessageNotification = (level: NotificationLevel): boolean => level !== "off";

export interface NotificationPreferences {
  owner: string;
  level: NotificationLevel;
  revision: number;
}

const levelSchema = Schema.Literals(NOTIFICATION_LEVELS);
const preferenceChangeSchema = Schema.Struct({
  level: levelSchema,
  revision: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 2147483647 })),
});
const preferencesSchema = Schema.Struct({
  owner: Schema.String.check(Schema.isMinLength(1)),
  ...preferenceChangeSchema.fields,
});
export const isNotificationLevel = Schema.is(levelSchema);

export function parseNotificationPreferenceChange(value: unknown): { level: NotificationLevel; revision: number } {
  return decodeNotification(preferenceChangeSchema, value, "invalid_preferences");
}

export function parseNotificationPreferences(value: unknown): NotificationPreferences {
  return decodeNotification(preferencesSchema, value, "invalid_preferences");
}
