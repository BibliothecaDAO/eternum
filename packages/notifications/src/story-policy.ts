import { NOTIFICATION_LEVELS, type NotificationLevel } from "./preferences";

type RecipientSource = "owner" | "explorer" | "battle" | "transfer";
type StoryRule = { level: Exclude<NotificationLevel, "off">; recipients: RecipientSource } | { excluded: string };

// Recipient fields are emitted with the action. Never resolve them from present-day structure ownership.
const STORY_RULES = {
  BattleStory: { level: "important", recipients: "battle" },
  RealmCreatedStory: { level: "standard", recipients: "owner" },
  BuildingPlacementStory: { level: "standard", recipients: "owner" },
  StructureLevelUpStory: { level: "standard", recipients: "owner" },
  ExplorerExtractRewardStory: { level: "standard", recipients: "explorer" },
  ResourceReceiveArrivalStory: { level: "standard", recipients: "owner" },
  ProductionStory: { level: "all", recipients: "owner" },
  BuildingPaymentStory: { level: "all", recipients: "owner" },
  ResourceTransferStory: { level: "all", recipients: "transfer" },
  ResourceBurnStory: { level: "all", recipients: "owner" },
  ExplorerMoveStory: { level: "all", recipients: "explorer" },
  ExplorerCreateStory: { level: "all", recipients: "owner" },
  ExplorerAddStory: { level: "all", recipients: "owner" },
  ExplorerDeleteStory: { level: "all", recipients: "owner" },
  ExplorerExplorerSwapStory: { level: "all", recipients: "owner" },
  ExplorerGuardSwapStory: { level: "all", recipients: "owner" },
  GuardExplorerSwapStory: { level: "all", recipients: "owner" },
  GuardAddStory: { level: "all", recipients: "owner" },
  GuardDeleteStory: { level: "all", recipients: "owner" },
  PointsRegisteredStory: { excluded: "Leaderboard activity" },
  PrizeDistributionFinalStory: { excluded: "Trial distribution does not identify season recipients" },
  FaithPledgedStory: { excluded: "Recipient and notification UX deferred" },
  FaithRemovedStory: { excluded: "Recipient and notification UX deferred" },
  FaithPointsClaimedStory: { excluded: "Recipient and notification UX deferred" },
  BitcoinMineProductionStory: { excluded: "Recipient and notification UX deferred" },
  BitcoinPhaseLotteryStory: { excluded: "Recipient and notification UX deferred" },
} satisfies Record<string, StoryRule>;

export function storyNotificationRule(story: string): StoryRule {
  if (!Object.hasOwn(STORY_RULES, story)) throw new Error(`Unknown notification story: ${story}`);
  return STORY_RULES[story as keyof typeof STORY_RULES];
}

export function includesStoryNotification(level: NotificationLevel, story: string): boolean {
  const rule = storyNotificationRule(story);
  return !("excluded" in rule) && NOTIFICATION_LEVELS.indexOf(level) >= NOTIFICATION_LEVELS.indexOf(rule.level);
}

export function storyRecipients(story: string, owner: unknown, payload: Record<string, unknown>): string[] {
  const rule = storyNotificationRule(story);
  if ("excluded" in rule) return [];
  const sources = {
    owner: [owner],
    explorer: [payload.explorer_owner],
    battle: [payload.attacker_owner_address, payload.defender_owner_address],
    transfer: [payload.from_entity_owner_address, payload.to_entity_owner_address],
  };
  return [...new Set(sources[rule.recipients].map(recipientAddress).filter((address) => address !== null))];
}

function recipientAddress(value: unknown): string | null {
  if (value === null) return null;
  const valid =
    typeof value === "bigint" ||
    (typeof value === "number" && Number.isSafeInteger(value)) ||
    (typeof value === "string" && /^(0x[\da-f]+|\d+)$/i.test(value));
  if (!valid) throw new Error("Story recipient must be an event-time address");
  const address = BigInt(value as string | number | bigint);
  if (address < 0n || address >= 1n << 251n) throw new Error("Story recipient is out of range");
  return address === 0n ? null : `0x${address.toString(16)}`;
}
