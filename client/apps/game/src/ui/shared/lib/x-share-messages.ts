import type { GameReviewData } from "@/services/review/game-review-service";
import { AssetRarity } from "@/ui/features/cosmetics/chest-opening/utils/cosmetics";
import { displayAddress } from "@/ui/utils/utils";

type TemplateVariables = {
  // player name and tribe
  attackerNameText: string;
  // player name and tribe
  defenderNameText: string;
  // ex: 5940 T1 Knight
  attackerTroopsText: string;
  // ex: 5940 T1 Knight
  defenderTroopsText: string;
  // game url
  url: string;
  // realm name
  realmName: string;
  // tier emoji
  tierEmoji: string;
  // player name
  addressName: string;
  // 300 diamonds, 100 donkeys, 2000 gold
  raidResources: string;
  // tribe name
  tribeName: string;
  // resource type for village
  resourceType: string;
  // resource probability for village
  resourceProbability: number;
  // resource tier for village
  resourceTier: string;
  // realm resources
  realmResources: string;
  placement: string;
  eventLabel: string;
  pointsLabel: string;
  profileTitle: string;
  shareName: string;
  tierLabel: string;
  mmrLabel: string;
  profileUrl: string;
};

export const formatSocialText = (template: string, variables: Partial<TemplateVariables>): string => {
  return Object.entries(variables).reduce(
    (text, [key, value]) => text.replace(new RegExp(`{${key}}`, "g"), String(value)),
    template,
  );
};

const tweetFooterLines = [
  "@realms_gg",
  "The most insane fully onchain game, live on Starknet",
  "blitz.realms.world",
] as const;

const tweetFooter = tweetFooterLines.join("\n");

export const twitterTemplates = {
  combat: `⚔️ BATTLE DECLARED! ⚔️\n\n{attackerNameText} with {attackerTroopsText}\n\n🗡️ VS 🛡️\n\n{defenderNameText} with {defenderTroopsText}\n\n${tweetFooter}`,
  raid: `🔥 SUCCESSFUL RAID! 🔥\n\n{attackerNameText}\n\n🗡️ VS 🛡️\n\n{defenderNameText} \n\nSpoils of war: {raidResources} 💰\n\n${tweetFooter}`,
  realmSettled: `🏰 REALM SETTLED! 🏰\n\nI, {addressName}, have settled {realmName} in @realms_gg!\n\nThis realm produces: {realmResources} ⛏️\n\n${tweetFooter}`,
  villageResourceReveal: `🛖 NEW VILLAGE SETTLED! 🛖\n\nI, {addressName}, have settled a {resourceType} village in @realms_gg!\n\nWith a {resourceProbability}% chance of finding this {resourceTier} tier resource!{tierEmoji}{tierEmoji}{tierEmoji}\n\n${tweetFooter}`,
  joinedTribe: `⚔️ NEW ALLIANCE FORGED! ⚔️\n\nI, {addressName}, have pledged allegiance to the mighty {tribeName} tribe!\n\n${tweetFooter}`,
  createdTribe: `⚔️ A NEW POWER RISES! ⚔️\n\nI, {addressName}, have founded the {tribeName} tribe!\n\n${tweetFooter}`,
};

const blitzShareTemplate = `Secured {placement} on {eventLabel} with {pointsLabel} pts 👑\n\n${tweetFooter}`;

export const buildBlitzShareMessageText = ({
  placement,
  eventLabel,
  pointsLabel,
}: {
  placement: string;
  eventLabel: string;
  pointsLabel: string;
}): string => {
  return formatSocialText(blitzShareTemplate, {
    placement,
    eventLabel,
    pointsLabel,
  });
};

const profileShareTemplate = `{profileTitle}\n\nPlayer: {shareName}\nTier: {tierLabel}\nMMR: {mmrLabel}\n\n${tweetFooter}`;

export const buildProfileShareMessage = ({
  isOwnProfile,
  shareName,
  tierLabel,
  mmrLabel,
  profileUrl,
}: {
  isOwnProfile: boolean;
  shareName: string;
  tierLabel: string;
  mmrLabel: string;
  profileUrl: string;
}): string => {
  return formatSocialText(profileShareTemplate, {
    profileTitle: isOwnProfile ? "My Realms Blitz profile" : "Realms Blitz profile",
    shareName,
    tierLabel,
    mmrLabel,
    profileUrl,
  });
};

export const buildChestRevealShareMessage = (chestRarity: AssetRarity): string => {
  const normalizedRarity = (chestRarity ?? AssetRarity.Common).toUpperCase();
  return `${normalizedRarity} pull from a Realms Loot Chest! 🗝️\n\n${tweetFooter}`;
};

export type GameReviewShareStep =
  | "finished"
  | "personal"
  | "awards"
  | "map-fingerprint"
  | "leaderboard"
  | "submit-score"
  | "claim-rewards"
  | "next-game";

const reviewNumberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

const formatReviewValue = (value: number): string => {
  return reviewNumberFormatter.format(Math.max(0, Math.round(value)));
};

const formatLordsWonDisplay = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "0";

  const [whole, fractional] = trimmed.split(".");
  if (!fractional) return whole;

  const limitedFractional = fractional.slice(0, 2).replace(/0+$/, "");
  return limitedFractional ? `${whole}.${limitedFractional}` : whole;
};

const isAwardsShareStep = (step: GameReviewShareStep): boolean => step === "awards";

const isTimeFocusedAwardsShareStep = (step: GameReviewShareStep): boolean => step === "awards";

const normalizeAddress = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const prefixed = trimmed.startsWith("0x") || trimmed.startsWith("0X") ? trimmed : `0x${trimmed}`;
    const parsed = BigInt(prefixed);
    if (parsed === 0n) return null;
    return `0x${parsed.toString(16)}`.toLowerCase();
  } catch {
    return null;
  }
};

const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return "None";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = total % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m ${remaining}s`;
  return `${remaining}s`;
};

export const buildGameReviewStepShareMessage = ({
  step,
  data,
  nextGameName,
}: {
  step: GameReviewShareStep;
  data: GameReviewData;
  nextGameName?: string | null;
}): string => {
  const worldLabel = data.worldName;

  if (isAwardsShareStep(step)) {
    const leaderboardNames = new Map<string, string>();
    for (const entry of data.leaderboard) {
      const normalized = normalizeAddress(entry.address);
      if (!normalized) continue;
      leaderboardNames.set(normalized, entry.displayName?.trim() || displayAddress(normalized));
    }

    const resolveWinnerName = (
      metric: { playerAddress: string; value: number } | null,
      formatter: (value: number) => string,
    ): string => {
      if (!metric) return "None";
      const normalized = normalizeAddress(metric.playerAddress);
      if (!normalized) return "None";
      const name = leaderboardNames.get(normalized) || displayAddress(normalized);
      return `${name} (${formatter(metric.value)})`;
    };

    const includeOnlyTimeMetrics = isTimeFocusedAwardsShareStep(step);

    return [
      `${worldLabel} Blitz Awards on @realms_gg:`,
      `First Blood: ${resolveWinnerName(data.stats.firstBlood, formatDuration)}`,
      `First T3 Troops: ${resolveWinnerName(data.stats.timeToFirstT3Seconds, formatDuration)}`,
      `First Hyperstructure: ${resolveWinnerName(data.stats.timeToFirstHyperstructureSeconds, formatDuration)}`,
      ...(includeOnlyTimeMetrics
        ? []
        : [
            `Most Troops Killed: ${resolveWinnerName(data.stats.mostTroopsKilled, formatReviewValue)}`,
            `Highest Explored Tiles: ${resolveWinnerName(data.stats.highestExploredTiles, formatReviewValue)}`,
            `Most Structures Owned: ${resolveWinnerName(data.stats.biggestStructuresOwned, formatReviewValue)}`,
          ]),
      "",
      ...tweetFooterLines,
    ].join("\n");
  }

  if (step === "leaderboard") {
    const podiumLines = data.topPlayers.map((entry) => {
      const name = (entry.displayName?.trim() || displayAddress(entry.address)).trim();
      return `#${entry.rank} ${name} - ${formatReviewValue(entry.points)} pts`;
    });
    return [
      `Final standings for ${worldLabel} on Realms Blitz`,
      "",
      ...(podiumLines.length > 0 ? podiumLines : ["Top players are in!"]),
      "",
      "Can you dethrone the champions?",
      "",
      ...tweetFooterLines,
    ].join("\n");
  }

  if (step === "map-fingerprint") {
    if (!data.mapSnapshot.available) {
      return "";
    }

    return [
      `${worldLabel} final map fingerprint`,
      "",
      "Can you leave your own mark on the next map?",
      "",
      ...tweetFooterLines,
    ].join("\n");
  }

  if (step === "personal" && data.personalScore) {
    return [
      `${worldLabel} personal result:`,
      `Rank #${data.personalScore.rank} with ${formatReviewValue(data.personalScore.points)} points.`,
      "",
      ...tweetFooterLines,
    ].join("\n");
  }

  if (step === "claim-rewards" && data.rewards) {
    const finalRank =
      typeof data.personalScore?.rank === "number" &&
      Number.isFinite(data.personalScore.rank) &&
      data.personalScore.rank > 0
        ? `#${Math.trunc(data.personalScore.rank)}`
        : "Unranked";
    const lordsWon = formatLordsWonDisplay(data.rewards.lordsWonFormatted);

    return [
      `${worldLabel} rewards recap on Realms Blitz:`,
      `Final rank: ${finalRank}`,
      `$LORDS won: +${lordsWon}`,
      `Chests won: +${formatReviewValue(data.rewards.chestsClaimedEstimate)}`,
      "",
      ...tweetFooterLines,
    ].join("\n");
  }

  if (step === "next-game" && nextGameName) {
    return [`Next game: ${nextGameName}`, "Registration is open on Realms Blitz.", "", ...tweetFooterLines].join("\n");
  }

  return [`${worldLabel} review is complete.`, "", ...tweetFooterLines].join("\n");
};
