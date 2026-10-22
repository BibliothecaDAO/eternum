import { NOTIFICATION_LEVELS, type NotificationLevel } from "./preferences";
import {
  bankLiquidityCopy,
  bankSwapCopy,
  bitcoinAwardCopy,
  battleCopy,
  buildingStoryCopy,
  captureStoryCopy,
  explorationRewardCopy,
  hyperstructurePointsCopy,
  levelUpCopy,
  raidStoryCopy,
  rewardChestCopy,
  says,
  sitePayoutCopy,
  spireDiscoveredCopy,
  type StoryCopy,
  tierBoughtCopy,
  transferStoryCopy,
} from "./story-copy";
import type { NativeStoryVariant } from "../../../contracts/l3/world-native/schema/client.gen";

type RecipientSource = "capture" | "owner" | "transfer" | "nativeBattle" | "raid";
/** A delivered story's level, who it is for, and what its alert says; a story is delivered with its words or not at all. */
type StoryRule =
  | { level: Exclude<NotificationLevel, "off">; recipients: RecipientSource; copy: StoryCopy }
  | { excluded: string };

// Recipient fields are emitted with the action. Never resolve them from present-day structure ownership.
const STORY_RULES = {
  BitcoinAwardStory: { level: "all", recipients: "owner", copy: bitcoinAwardCopy },
  TradeCreated: {
    level: "all",
    recipients: "owner",
    copy: says("Your trade is listed", "Merchants can now take your offer."),
  },
  TradeAccepted: {
    level: "all",
    recipients: "owner",
    copy: says("A trade was filled", "The goods have changed hands."),
  },
  TradeCancelled: {
    level: "all",
    recipients: "owner",
    copy: says("Your trade was withdrawn", "The offer is off the market."),
  },
  BankSwap: { level: "all", recipients: "owner", copy: bankSwapCopy },
  BankLiquidity: { level: "all", recipients: "owner", copy: bankLiquidityCopy },
  HyperstructurePoints: { level: "all", recipients: "owner", copy: hyperstructurePointsCopy },
  SitePayout: { level: "all", recipients: "owner", copy: sitePayoutCopy },
  TierBought: { level: "all", recipients: "owner", copy: tierBoughtCopy },
  ExplorationReward: { level: "all", recipients: "owner", copy: explorationRewardCopy },
  SeasonEnded: { level: "all", recipients: "owner", copy: says("The season has ended", "The final standings are in.") },
  FaithPledged: {
    level: "all",
    recipients: "owner",
    copy: says("Faith pledged", "A realm's faith now flows to a wonder."),
  },
  FaithRemoved: { level: "all", recipients: "owner", copy: says("Faith withdrawn", "A pledge to a wonder has ended.") },
  BlitzFinalized: {
    level: "all",
    recipients: "owner",
    copy: says("The Blitz is settled", "The final results are in."),
  },
  RelicCrafted: { level: "all", recipients: "owner", copy: says("A relic is forged", "It waits in your stores.") },
  RelicActivated: {
    level: "all",
    recipients: "owner",
    copy: says("Relic activated", "Your relic's effect was applied."),
  },

  BattleEvent: { level: "important", recipients: "nativeBattle", copy: battleCopy },
  StructureCapturedStory: { level: "important", recipients: "capture", copy: captureStoryCopy },
  RaidEvent: { level: "important", recipients: "raid", copy: raidStoryCopy },
  RealmCreatedStory: {
    level: "standard",
    recipients: "owner",
    copy: says("A new realm rises", "Your banner now flies over fresh lands."),
  },
  SpireDiscovered: { level: "standard", recipients: "owner", copy: spireDiscoveredCopy },
  BuildingPlacementStory: { level: "standard", recipients: "owner", copy: buildingStoryCopy },
  StructureLevelUpStory: { level: "standard", recipients: "owner", copy: levelUpCopy },
  ResourceReceiveArrivalStory: {
    level: "standard",
    recipients: "owner",
    copy: says("The caravan has arrived", "Fresh supplies have reached their destination."),
  },
  RelicChestOpened: {
    level: "standard",
    recipients: "owner",
    copy: says("A crate is open", "Your army has pulled relics from the fog."),
  },
  RewardChestOpened: { level: "standard", recipients: "owner", copy: rewardChestCopy },
  ProductionStory: {
    level: "all",
    recipients: "owner",
    copy: says("The workshops are humming", "Production has started."),
  },
  BuildingPaymentStory: {
    level: "all",
    recipients: "owner",
    copy: says("Construction is underway", "The builders have their materials and their orders."),
  },
  ResourceTransferStory: { level: "all", recipients: "transfer", copy: transferStoryCopy },
  ResourceBurnStory: {
    level: "all",
    recipients: "owner",
    copy: says("Resources burned", "They are gone from your stores."),
  },
  ExplorerCreateStory: {
    level: "all",
    recipients: "owner",
    copy: says("An army answers the call", "New troops stand ready beyond the walls."),
  },
  ExplorerAddStory: {
    level: "all",
    recipients: "owner",
    copy: says("Reinforcements have arrived", "Fresh troops have joined your army."),
  },
  ExplorerDeleteStory: {
    level: "all",
    recipients: "owner",
    copy: says("An army was disbanded", "Its troops and what it carried are gone."),
  },
  GuardAddStory: {
    level: "all",
    recipients: "owner",
    copy: says("The walls are reinforced", "Fresh defenders have taken their posts."),
  },
  GuardDeleteStory: {
    level: "all",
    recipients: "owner",
    copy: says("A guard was dismissed", "Its troops have left the walls for good."),
  },
  TroopsTransferred: {
    level: "all",
    recipients: "owner",
    copy: says("Troops have moved", "Your troops have joined their new post."),
  },
  FaithPointsClaimedStory: { excluded: "Recipient and notification UX deferred" },
  LordsWithdrawn: { excluded: "The player's own withdrawal needs no notification" },
  SiteUsed: { excluded: "Site use is recorded in Today and the Log" },
} satisfies Record<NativeStoryVariant | "BattleEvent" | "RaidEvent", StoryRule>;

export function storyNotificationRule(story: string): StoryRule {
  if (!Object.hasOwn(STORY_RULES, story)) {
    if (process.env.NODE_ENV !== "production") throw new Error(`Unknown notification story: ${story}`);
    return { excluded: "Unknown story variant" };
  }
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
    capture: [owner, payload.previous_owner],
    nativeBattle: [
      (payload.attacker as Record<string, unknown> | undefined)?.player,
      (payload.defender as Record<string, unknown> | undefined)?.player,
    ],
    raid: [payload.player, payload.target_owner],
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
