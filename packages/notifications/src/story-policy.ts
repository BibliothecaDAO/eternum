import type { NotificationLevel } from "./preferences";
import { includesKind, type NotificationKind } from "./notification-kinds";
import {
  bitcoinAwardCopy,
  battleCopy,
  captureStoryCopy,
  hyperstructurePointsCopy,
  says,
  type StoryCopy,
  transferStoryCopy,
} from "./story-copy";
import type { NativeStoryVariant } from "../../../contracts/l3/world-native/schema/client.gen";

type RecipientSource = "capture" | "owner" | "transferReceiver" | "nativeBattle";
/** A game's mode, as its shard's directory names it. */
export type StoryGameMode = "blitz" | "eternum" | "frontier" | null;
/**
 * A delivered story's kind (which names its level and how long it lives), who it is for, the game modes it is pushed in
 * (every mode when absent), and what its alert says; a story is delivered with its words or not at all.
 */
type StoryRule =
  | {
      kind: NotificationKind;
      recipients: RecipientSource;
      copy: StoryCopy;
      modes?: readonly StoryGameMode[];
    }
  | { excluded: string };

/** Fights between players. Frontier ships none: its battles are the player's own taps against beasts and camps. */
const PLAYER_FIGHTS: readonly StoryGameMode[] = ["blitz", "eternum"];

// Recipient fields are emitted with the action. Never resolve them from present-day structure ownership.
const OWN_ACTION = "The player's own action: the Feed and the Log show it";
const STORY_RULES = {
  // What happens to the player without their tap.
  BattleEvent: { kind: "fights", recipients: "nativeBattle", copy: battleCopy, modes: PLAYER_FIGHTS },
  StructureCapturedStory: { kind: "fights", recipients: "capture", copy: captureStoryCopy, modes: PLAYER_FIGHTS },
  SeasonEnded: {
    kind: "results",
    recipients: "owner",
    copy: says("The season is over", "see where you finished."),
  },
  BlitzFinalized: {
    kind: "results",
    recipients: "owner",
    copy: says("Your Blitz is settled", "see where you finished."),
  },
  ResourceReceiveArrivalStory: {
    kind: "deliveries",
    recipients: "owner",
    copy: says("Your caravan arrived", "the resources are in your stores."),
  },
  ResourceTransferStory: { kind: "deliveries", recipients: "transferReceiver", copy: transferStoryCopy },
  BitcoinAwardStory: { kind: "bitcoin", recipients: "owner", copy: bitcoinAwardCopy },
  HyperstructurePoints: { kind: "points", recipients: "owner", copy: hyperstructurePointsCopy },

  // The player's own taps: the Feed and the Log tell them, a push would only echo them.
  SitePayout: { excluded: OWN_ACTION },
  SkillPointSpent: { excluded: OWN_ACTION },
  ExplorationReward: { excluded: OWN_ACTION },
  RelicCrafted: { excluded: OWN_ACTION },
  RelicActivated: { excluded: OWN_ACTION },
  ProductionStory: { excluded: OWN_ACTION },
  BuildingPaymentStory: { excluded: OWN_ACTION },
  ResourceBurnStory: { excluded: OWN_ACTION },
  ExplorerCreateStory: { excluded: OWN_ACTION },
  ExplorerAddStory: { excluded: OWN_ACTION },
  ExplorerDeleteStory: { excluded: OWN_ACTION },
  GuardAddStory: { excluded: OWN_ACTION },
  GuardDeleteStory: { excluded: OWN_ACTION },
  TroopsTransferred: { excluded: OWN_ACTION },
  RealmCreatedStory: { excluded: OWN_ACTION },
  SpireDiscovered: { excluded: OWN_ACTION },
  BuildingPlacementStory: { excluded: OWN_ACTION },
  StructureLevelUpStory: { excluded: OWN_ACTION },
  RelicChestOpened: { excluded: OWN_ACTION },
  RewardChestOpened: { excluded: OWN_ACTION },

  LordsWithdrawn: { excluded: "The player's own withdrawal needs no notification" },
  SiteUsed: { excluded: "Site use is recorded in Today and the Log" },
} satisfies Record<NativeStoryVariant | "BattleEvent", StoryRule>;

export function storyNotificationRule(story: string): StoryRule {
  if (!Object.hasOwn(STORY_RULES, story)) {
    if (process.env.NODE_ENV !== "production") throw new Error(`Unknown notification story: ${story}`);
    return { excluded: "Unknown story variant" };
  }
  return STORY_RULES[story as keyof typeof STORY_RULES];
}

/** Whether a player at this level is pushed this story in a game of this mode. */
export function includesStoryNotification(level: NotificationLevel, story: string, mode: StoryGameMode): boolean {
  const rule = storyNotificationRule(story);
  return (
    !("excluded" in rule) && (rule.modes === undefined || rule.modes.includes(mode)) && includesKind(level, rule.kind)
  );
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
    // Goods sent to another player: the sender sent them, so only the receiver hears of it.
    transferReceiver: [payload.to_entity_owner_address],
  };
  const sender = rule.recipients === "transferReceiver" ? recipientAddress(payload.from_entity_owner_address) : null;
  return [
    ...new Set(
      sources[rule.recipients]
        .map(recipientAddress)
        .filter((address): address is string => address !== null && address !== sender),
    ),
  ];
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
