export const NOTIFICATION_LEVELS = ["off", "important", "standard", "all"] as const;
export type NotificationLevel = (typeof NOTIFICATION_LEVELS)[number];

export const NOTIFICATION_LEVEL_DESCRIPTIONS: Record<NotificationLevel, string> = {
  off: "No game notifications.",
  important: "Battles and structure captures involving you.",
  standard: "Important activity, settlements, buildings, upgrades, rewards and arrivals.",
  all: "Standard activity plus production, transfers and troop activity.",
};

export interface NotificationPreferences {
  owner: string;
  level: NotificationLevel;
  revision: number;
}

export function isNotificationLevel(value: unknown): value is NotificationLevel {
  return NOTIFICATION_LEVELS.some((level) => level === value);
}

export function parseNotificationPreferenceChange(value: unknown): { level: NotificationLevel; revision: number } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_preferences");
  const input = value as Record<string, unknown>;
  if (
    Object.keys(input).some((key) => key !== "level" && key !== "revision") ||
    !isNotificationLevel(input.level) ||
    !Number.isSafeInteger(input.revision) ||
    (input.revision as number) < 0 ||
    (input.revision as number) > 2147483647
  ) {
    throw new Error("invalid_preferences");
  }
  return { level: input.level, revision: input.revision as number };
}

export function parseNotificationPreferences(value: unknown): NotificationPreferences {
  if (!value || typeof value !== "object") throw new Error("invalid_preferences");
  const { owner, ...change } = value as Record<string, unknown>;
  if (typeof owner !== "string" || !owner) throw new Error("invalid_preferences");
  return { owner, ...parseNotificationPreferenceChange(change) };
}
