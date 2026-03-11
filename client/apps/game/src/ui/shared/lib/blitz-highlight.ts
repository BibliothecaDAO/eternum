import { currencyIntlFormat, displayAddress } from "@/ui/utils/utils";
import { buildBlitzShareMessageText } from "@/ui/shared/lib/x-share-messages";

const DEFAULT_FALLBACK_ORIGIN = "https://eternum.game";

export interface BlitzHighlightPlayer {
  rank: number;
  name: string;
  points: number;
  address: string;
  guildName?: string;
  exploredTiles?: number | null;
  exploredTilePoints?: number | null;
  riftsTaken?: number | null;
  riftPoints?: number | null;
  hyperstructuresConquered?: number | null;
  hyperstructurePoints?: number | null;
  relicCratesOpened?: number | null;
  relicCratePoints?: number | null;
  campsTaken?: number | null;
  campPoints?: number | null;
  hyperstructuresHeld?: number | null;
  hyperstructuresHeldPoints?: number | null;
}

export const BLITZ_CARD_DIMENSIONS = {
  width: 960,
  height: 540,
};

export const formatOrdinal = (rank: number): string => {
  const positiveRank = Math.max(1, Math.trunc(rank));
  const remainder = positiveRank % 100;

  if (remainder >= 11 && remainder <= 13) {
    return `${positiveRank}th`;
  }

  switch (positiveRank % 10) {
    case 1:
      return `${positiveRank}st`;
    case 2:
      return `${positiveRank}nd`;
    case 3:
      return `${positiveRank}rd`;
    default:
      return `${positiveRank}th`;
  }
};

export const truncateText = (value: string, maxLength: number = 32): string => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(1, maxLength - 1))}…`;
};

export const getSecondaryLabel = (player: BlitzHighlightPlayer): string => {
  if (player.guildName?.trim()) {
    return player.guildName.trim();
  }

  return displayAddress(player.address);
};

interface BlitzShareMessageOptions {
  rank?: number | null;
  points?: number | null;
  eventLabel?: string;
  origin?: string;
}

export const buildBlitzShareMessage = ({
  rank,
  points,
  eventLabel = "Realms Blitz",
}: BlitzShareMessageOptions = {}): string => {
  const placement = rank && rank > 0 ? formatOrdinal(rank) : "a top spot";
  const pointsLabel = currencyIntlFormat(points ?? 0, 0);

  return buildBlitzShareMessageText({
    placement,
    eventLabel,
    pointsLabel,
  });
};

export const BLITZ_DEFAULT_SHARE_ORIGIN = DEFAULT_FALLBACK_ORIGIN;
