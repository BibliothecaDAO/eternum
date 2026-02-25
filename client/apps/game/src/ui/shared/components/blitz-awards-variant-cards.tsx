import { forwardRef, useMemo, useState, type Ref } from "react";
import { createPortal } from "react-dom";

import type { LandingLeaderboardEntry } from "@/services/leaderboard/landing-leaderboard-service";
import type { GameReviewStats } from "@/services/review/game-review-service";
import { displayAddress } from "@/ui/utils/utils";
import { BLITZ_CARD_DIMENSIONS } from "../lib/blitz-highlight";
import {
  BLITZ_CARD_BASE_STYLES,
  BLITZ_CARD_FONT_IMPORT,
  BLITZ_CARD_GOLD_THEME,
  formatBlitzValue as formatValue,
} from "../lib/blitz-card-shared";

type MetricValue = {
  playerAddress: string;
  value: number;
  timestamp?: number;
} | null;

type AwardId =
  | "first-hyperstructure"
  | "first-blood"
  | "first-t3"
  | "most-troops-killed"
  | "highest-explored-tiles"
  | "biggest-structures-owned";

type AwardKind = "time" | "count";

type AwardsCardVariant =
  | "option-one"
  | "option-two"
  | "option-three"
  | "option-four"
  | "option-five"
  | "option-six"
  | "option-seven"
  | "option-eight";

interface BlitzAwardsVariantCardProps {
  worldName: string;
  stats: GameReviewStats;
  leaderboard: LandingLeaderboardEntry[];
  player?: { name: string; address: string } | null;
  variant: AwardsCardVariant;
}

interface BlitzAwardsVariantCardWithSelectorProps extends Omit<BlitzAwardsVariantCardProps, "variant"> {
  className?: string;
  cardRef?: Ref<SVGSVGElement>;
}

interface AwardItem {
  id: AwardId;
  label: string;
  kind: AwardKind;
  metric: MetricValue;
}

interface LeaderboardIdentity {
  displayName: string | null;
}

interface WinnerIdentity {
  normalizedAddress: string;
  name: string;
  address?: string;
}

const normalizeAddress = (value: string | null | undefined): string | null => {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const hex = trimmed.startsWith("0x") || trimmed.startsWith("0X") ? trimmed : `0x${trimmed}`;
    const parsed = BigInt(hex);
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

const formatOptionSixDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return "None";

  const total = Math.floor(seconds);
  if (total < 60) return `${total}s`;

  if (total < 3600) {
    const minutes = Math.floor(total / 60);
    const remainingSeconds = total % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  if (total < 86400) {
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  return `${days}d ${String(hours).padStart(2, "0")}h`;
};

const formatAwardValue = (metric: MetricValue, kind: AwardKind): string => {
  if (!metric) return "None";
  return kind === "time" ? formatDuration(metric.value) : formatValue(metric.value);
};

const getHeroValueSizeClass = (value: string): string => {
  const compactLength = value.replace(/\s+/g, "").length;
  if (compactLength >= 9) return "award-hero-value-sm";
  if (compactLength >= 7) return "award-hero-value-md";
  return "award-hero-value-lg";
};

const getOptionSixValueSizeClass = (value: string): string => {
  const compactLength = value.replace(/\s+/g, "").length;
  if (compactLength >= 11) return "option-six-value-xxs";
  if (compactLength >= 9) return "option-six-value-xs";
  if (compactLength >= 8) return "option-six-value-sm";
  if (compactLength >= 7) return "option-six-value-md";
  if (compactLength >= 6) return "option-six-value-lg";
  return "option-six-value-xl";
};

const buildLeaderboardIdentityLookup = (leaderboard: LandingLeaderboardEntry[]): Map<string, LeaderboardIdentity> => {
  const byAddress = new Map<string, LeaderboardIdentity>();

  for (const entry of leaderboard) {
    const normalized = normalizeAddress(entry.address);
    if (!normalized) continue;
    const displayName = entry.displayName?.trim() || null;
    byAddress.set(normalized, {
      displayName,
    });
  }

  return byAddress;
};

const resolveWinner = (
  metric: MetricValue,
  identityByAddress: Map<string, LeaderboardIdentity>,
): WinnerIdentity | null => {
  if (!metric) return null;

  const normalizedAddress = normalizeAddress(metric.playerAddress);
  if (!normalizedAddress) return null;

  const identity = identityByAddress.get(normalizedAddress);
  const displayName = identity?.displayName?.trim() || null;

  if (displayName) {
    return {
      normalizedAddress,
      name: displayName,
    };
  }

  return {
    normalizedAddress,
    name: "Player",
    address: displayAddress(normalizedAddress),
  };
};

const AWARDS_CARD_BASE_STYLES = `
  ${BLITZ_CARD_FONT_IMPORT}
  ${BLITZ_CARD_BASE_STYLES}
  ${BLITZ_CARD_GOLD_THEME}

  .blitz-card-root .awards-grid {
    position: absolute;
    left: 44px;
    top: 114px;
    width: 872px;
    display: grid;
    column-gap: 16px;
    row-gap: 12px;
    z-index: 4;
  }

  .blitz-card-root .award {
    min-height: 0;
    background: transparent;
    border-radius: 0;
    padding: 2px 4px;
    box-shadow: none;
    display: flex;
    flex-direction: column;
  }

  .blitz-card-root .award-title {
    font-family: "IM Fell English", serif;
    font-style: italic;
    font-size: 16px;
    line-height: 20px;
    color: #ffffff;
    opacity: 0.84;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .blitz-card-root .award-hero .award-title {
    font-size: 18px;
    line-height: 23px;
  }

  .blitz-card-root .award-side .award-title {
    font-size: 17px;
    line-height: 22px;
  }

  .blitz-card-root .award-empty .award-title {
    opacity: 0.68;
  }

  .blitz-card-root .award-value {
    margin-top: 3px;
    font-family: "Montserrat", sans-serif;
    font-weight: 800;
    font-size: 54px;
    line-height: 58px;
    color: #ffffff;
    white-space: nowrap;
    font-variant-numeric: tabular-nums lining-nums;
    text-shadow: 0 4px 20px rgba(2, 2, 2, 0.28);
  }

  .blitz-card-root .award-hero .award-value {
    margin-top: 7px;
    font-size: 96px;
    line-height: 100px;
  }

  .blitz-card-root .award-side .award-value {
    margin-top: 4px;
    font-size: 52px;
    line-height: 56px;
  }

  .blitz-card-root .award-bottom .award-value {
    margin-top: 2px;
    font-size: 52px;
    line-height: 54px;
  }

  .blitz-card-root .award-highlight-value .award-value {
    background: var(--rank-gradient);
    -webkit-text-fill-color: transparent;
    -webkit-background-clip: text;
    background-clip: text;
    text-fill-color: transparent;
  }

  .blitz-card-root .award-empty .award-value {
    color: #d8d8d8;
    opacity: 0.84;
  }

  .blitz-card-root .award-empty.award-hero .award-value {
    font-size: 82px;
    line-height: 86px;
  }

  .blitz-card-root .award-empty.award-side .award-value {
    font-size: 44px;
    line-height: 48px;
  }

  .blitz-card-root .award-empty.award-bottom .award-value {
    font-size: 42px;
    line-height: 46px;
  }

  .blitz-card-root .award-no-t3 .award-value {
    color: #d0d0d0;
    opacity: 0.74;
  }

  .blitz-card-root .award-winner-row {
    margin-top: 3px;
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-width: 0;
  }

  .blitz-card-root .award-hero .award-winner-row {
    margin-top: 7px;
  }

  .blitz-card-root .award-side .award-winner-row {
    margin-top: 4px;
  }

  .blitz-card-root .award-winner {
    font-family: "IM Fell English", serif;
    font-style: normal;
    font-weight: 400;
    font-size: 18px;
    line-height: 22px;
    color: #ffffff;
    min-width: 0;
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .blitz-card-root .award-bottom .award-winner {
    font-size: 16px;
    line-height: 20px;
  }

  .blitz-card-root .award-address {
    font-family: "IM Fell English", serif;
    font-style: italic;
    font-size: 13px;
    line-height: 16px;
    color: #ffffff;
    opacity: 0.74;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .blitz-card-root .award-bottom .award-address {
    font-size: 12px;
    line-height: 15px;
  }
`;

const OPTION_ONE_STYLES = `
  .blitz-card-root.variant-option-one .awards-grid {
    grid-template-columns: repeat(12, minmax(0, 1fr));
    grid-template-rows: 142px 122px 106px;
  }

  .blitz-card-root.variant-option-one .award-first-hyperstructure {
    grid-column: 1 / span 7;
    grid-row: 1 / span 2;
  }

  .blitz-card-root.variant-option-one .award-first-blood {
    grid-column: 8 / span 5;
    grid-row: 1;
  }

  .blitz-card-root.variant-option-one .award-first-t3 {
    grid-column: 8 / span 5;
    grid-row: 2;
  }

  .blitz-card-root.variant-option-one .award-most-troops-killed {
    grid-column: 1 / span 4;
    grid-row: 3;
  }

  .blitz-card-root.variant-option-one .award-highest-explored-tiles {
    grid-column: 5 / span 4;
    grid-row: 3;
  }

  .blitz-card-root.variant-option-one .award-biggest-structures-owned {
    grid-column: 9 / span 4;
    grid-row: 3;
    padding-top: 6px;
  }

  .blitz-card-root.variant-option-one .award-first-hyperstructure,
  .blitz-card-root.variant-option-one .award-first-blood,
  .blitz-card-root.variant-option-one .award-first-t3 {
    border: 1px solid rgba(237, 182, 74, 0.26);
    border-radius: 14px;
    background: linear-gradient(135deg, rgba(47, 34, 12, 0.34), rgba(17, 15, 12, 0.14));
    padding: 14px 16px;
  }

  .blitz-card-root.variant-option-one .award-bottom {
    transform: translateY(-16px);
  }

  .blitz-card-root.variant-option-one .award-hero .award-value {
    font-size: 102px;
    line-height: 106px;
  }

  .blitz-card-root.variant-option-one .award-side .award-value {
    font-size: 54px;
    line-height: 58px;
  }

  .blitz-card-root.variant-option-one .award-bottom .award-value {
    font-size: 50px;
    line-height: 52px;
  }
`;

const OPTION_TWO_STYLES = `
  .blitz-card-root.variant-option-two .awards-grid {
    grid-template-columns: repeat(12, minmax(0, 1fr));
    grid-template-rows: 156px 132px 108px;
    row-gap: 14px;
  }

  .blitz-card-root.variant-option-two .award-first-hyperstructure {
    grid-column: 3 / span 8;
    grid-row: 1;
    align-items: center;
    text-align: center;
    border: 1px solid rgba(237, 182, 74, 0.22);
    border-radius: 14px;
    background: linear-gradient(180deg, rgba(58, 44, 20, 0.32), rgba(19, 17, 14, 0.12));
    padding: 14px 16px;
  }

  .blitz-card-root.variant-option-two .award-first-hyperstructure .award-winner-row {
    justify-content: center;
  }

  .blitz-card-root.variant-option-two .award-first-blood {
    grid-column: 1 / span 4;
    grid-row: 2;
  }

  .blitz-card-root.variant-option-two .award-first-t3 {
    grid-column: 9 / span 4;
    grid-row: 2;
  }

  .blitz-card-root.variant-option-two .award-first-blood,
  .blitz-card-root.variant-option-two .award-first-t3 {
    transform: translateY(-26px);
    border: 1px solid rgba(237, 182, 74, 0.2);
    border-radius: 12px;
    background: linear-gradient(135deg, rgba(44, 34, 14, 0.28), rgba(12, 12, 12, 0.1));
    padding: 10px 12px;
  }

  .blitz-card-root.variant-option-two .award-most-troops-killed {
    grid-column: 1 / span 4;
    grid-row: 3;
  }

  .blitz-card-root.variant-option-two .award-highest-explored-tiles {
    grid-column: 5 / span 4;
    grid-row: 3;
  }

  .blitz-card-root.variant-option-two .award-biggest-structures-owned {
    grid-column: 9 / span 4;
    grid-row: 3;
  }

  .blitz-card-root.variant-option-two .award-bottom {
    transform: translateY(-24px);
  }

  .blitz-card-root.variant-option-two .award-hero .award-value {
    font-size: 94px;
    line-height: 98px;
  }

  .blitz-card-root.variant-option-two .award-side .award-value {
    font-size: 50px;
    line-height: 54px;
  }

  .blitz-card-root.variant-option-two .award-bottom .award-value {
    font-size: 48px;
    line-height: 50px;
  }
`;

const OPTION_THREE_STYLES = `
  .blitz-card-root.variant-option-three .awards-grid {
    top: 104px;
    height: 336px;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    grid-template-rows: 122px 98px 92px;
    row-gap: 16px;
    align-content: start;
  }

  .blitz-card-root.variant-option-three .award-first-hyperstructure {
    grid-column: 1 / span 7;
    grid-row: 1 / span 2;
    padding-top: 6px;
  }

  .blitz-card-root.variant-option-three .award-first-blood {
    grid-column: 8 / span 5;
    grid-row: 1;
    padding-top: 4px;
  }

  .blitz-card-root.variant-option-three .award-first-t3 {
    grid-column: 8 / span 5;
    grid-row: 2;
    padding-top: 0;
    margin-top: -12px;
  }

  .blitz-card-root.variant-option-three .award-first-blood,
  .blitz-card-root.variant-option-three .award-first-t3 {
    padding-left: 16px;
    transform: translateX(18px);
  }

  .blitz-card-root.variant-option-three .award-most-troops-killed {
    grid-column: 1 / span 4;
    grid-row: 3;
  }

  .blitz-card-root.variant-option-three .award-highest-explored-tiles {
    grid-column: 5 / span 4;
    grid-row: 3;
  }

  .blitz-card-root.variant-option-three .award-biggest-structures-owned {
    grid-column: 9 / span 4;
    grid-row: 3;
    padding-top: 2px;
  }

  .blitz-card-root.variant-option-three .award-bottom {
    transform: translateY(0);
  }

  .blitz-card-root.variant-option-three .award-hero .award-value.award-hero-value-lg {
    font-size: 96px;
    line-height: 100px;
  }

  .blitz-card-root.variant-option-three .award-hero .award-value.award-hero-value-md {
    font-size: 86px;
    line-height: 90px;
  }

  .blitz-card-root.variant-option-three .award-hero .award-value.award-hero-value-sm {
    font-size: 78px;
    line-height: 82px;
  }

  .blitz-card-root.variant-option-three .award-side .award-value {
    font-size: 42px;
    line-height: 46px;
  }

  .blitz-card-root.variant-option-three .award-side .award-title {
    font-size: 18px;
    line-height: 24px;
    padding-bottom: 2px;
    overflow: visible;
    text-overflow: clip;
  }

  .blitz-card-root.variant-option-three .award-side .award-winner {
    font-size: 18px;
    line-height: 22px;
  }

  .blitz-card-root.variant-option-three .award-side .award-winner-row {
    margin-top: 2px;
  }

  .blitz-card-root.variant-option-three .award-bottom .award-title {
    font-size: 14px;
    line-height: 17px;
  }

  .blitz-card-root.variant-option-three .award-bottom .award-value {
    font-size: 38px;
    line-height: 42px;
  }

  .blitz-card-root.variant-option-three .award-bottom .award-winner-row {
    margin-top: 2px;
  }

  .blitz-card-root.variant-option-three .award-bottom .award-winner {
    font-size: 14px;
    line-height: 17px;
  }

  .blitz-card-root.variant-option-three .player .name {
    font-size: 29px;
    line-height: 36px;
    opacity: 0.9;
  }
`;

const OPTION_FOUR_STYLES = `
  .blitz-card-root.variant-option-four .awards-grid {
    top: 104px;
    height: 334px;
    position: relative;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    grid-template-rows: 124px 164px;
    row-gap: 6px;
    align-content: start;
  }

  .blitz-card-root.variant-option-four .awards-grid::after {
    content: "";
    position: absolute;
    left: 518px;
    top: 18px;
    bottom: 8px;
    width: 1px;
    pointer-events: none;
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0) 0%,
      rgba(237, 182, 74, 0.12) 14%,
      rgba(255, 255, 255, 0.14) 50%,
      rgba(237, 182, 74, 0.12) 86%,
      rgba(255, 255, 255, 0) 100%
    );
  }

  .blitz-card-root.variant-option-four .award-first-hyperstructure {
    grid-column: 1 / span 7;
    grid-row: 1;
    padding-top: 12px;
  }

  .blitz-card-root.variant-option-four .award-first-hyperstructure .award-title {
    font-size: 19px;
    line-height: 25px;
    padding-bottom: 2px;
    opacity: 0.9;
    overflow: visible;
    text-overflow: clip;
  }

  .blitz-card-root.variant-option-four .award-first-blood {
    grid-column: 8 / span 5;
    grid-row: 1;
    padding-top: 12px;
    padding-left: 8px;
  }

  .blitz-card-root.variant-option-four .award-most-troops-killed {
    grid-column: 1 / span 4;
    grid-row: 2;
    align-self: end;
  }

  .blitz-card-root.variant-option-four .award-highest-explored-tiles {
    grid-column: 5 / span 3;
    grid-row: 2;
    align-self: end;
  }

  .blitz-card-root.variant-option-four .award-first-t3 {
    grid-column: 8 / span 5;
    grid-row: 2;
    align-self: end;
    padding-left: 8px;
  }

  .blitz-card-root.variant-option-four .award-hero .award-value.award-hero-value-lg {
    font-size: 92px;
    line-height: 96px;
  }

  .blitz-card-root.variant-option-four .award-hero .award-value.award-hero-value-md {
    font-size: 84px;
    line-height: 88px;
  }

  .blitz-card-root.variant-option-four .award-hero .award-value.award-hero-value-sm {
    font-size: 76px;
    line-height: 80px;
  }

  .blitz-card-root.variant-option-four .award-side .award-title {
    font-size: 19px;
    line-height: 24px;
  }

  .blitz-card-root.variant-option-four .award-side .award-value {
    font-size: 52px;
    line-height: 56px;
  }

  .blitz-card-root.variant-option-four .award-side .award-winner {
    font-size: 19px;
    line-height: 23px;
  }

  .blitz-card-root.variant-option-four .award-side .award-winner-row {
    margin-top: 4px;
  }

  .blitz-card-root.variant-option-four .award-bottom .award-title {
    font-size: 15px;
    line-height: 18px;
  }

  .blitz-card-root.variant-option-four .award-bottom .award-value {
    font-size: 40px;
    line-height: 44px;
  }

  .blitz-card-root.variant-option-four .award-bottom .award-winner {
    font-size: 14px;
    line-height: 17px;
  }
`;

const OPTION_FIVE_STYLES = `
  .blitz-card-root.variant-option-five .awards-grid {
    top: 104px;
    height: 334px;
    position: relative;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    grid-template-rows: 124px 164px;
    row-gap: 6px;
    align-content: start;
  }

  .blitz-card-root.variant-option-five .awards-grid::after {
    content: "";
    position: absolute;
    left: 518px;
    top: 18px;
    bottom: 8px;
    width: 1px;
    pointer-events: none;
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0) 0%,
      rgba(237, 182, 74, 0.12) 14%,
      rgba(255, 255, 255, 0.14) 50%,
      rgba(237, 182, 74, 0.12) 86%,
      rgba(255, 255, 255, 0) 100%
    );
  }

  .blitz-card-root.variant-option-five .award-first-hyperstructure {
    grid-column: 1 / span 7;
    grid-row: 1;
    padding-top: 12px;
  }

  .blitz-card-root.variant-option-five .award-first-hyperstructure .award-title {
    font-size: 19px;
    line-height: 25px;
    padding-bottom: 2px;
    opacity: 0.9;
    overflow: visible;
    text-overflow: clip;
  }

  .blitz-card-root.variant-option-five .award-most-troops-killed {
    grid-column: 8 / span 5;
    grid-row: 1;
    padding-top: 12px;
    padding-left: 8px;
  }

  .blitz-card-root.variant-option-five .award-first-blood {
    grid-column: 1 / span 4;
    grid-row: 2;
    align-self: end;
  }

  .blitz-card-root.variant-option-five .award-first-t3 {
    grid-column: 5 / span 3;
    grid-row: 2;
    align-self: end;
  }

  .blitz-card-root.variant-option-five .award-highest-explored-tiles {
    grid-column: 8 / span 5;
    grid-row: 2;
    align-self: end;
    padding-left: 8px;
  }

  .blitz-card-root.variant-option-five .award-hero .award-value.award-hero-value-lg {
    font-size: 92px;
    line-height: 96px;
  }

  .blitz-card-root.variant-option-five .award-hero .award-value.award-hero-value-md {
    font-size: 84px;
    line-height: 88px;
  }

  .blitz-card-root.variant-option-five .award-hero .award-value.award-hero-value-sm {
    font-size: 76px;
    line-height: 80px;
  }

  .blitz-card-root.variant-option-five .award-side .award-title {
    font-size: 19px;
    line-height: 24px;
  }

  .blitz-card-root.variant-option-five .award-side .award-value {
    font-size: 52px;
    line-height: 56px;
  }

  .blitz-card-root.variant-option-five .award-side .award-winner {
    font-size: 19px;
    line-height: 23px;
  }

  .blitz-card-root.variant-option-five .award-side .award-winner-row {
    margin-top: 4px;
  }

  .blitz-card-root.variant-option-five .award-bottom .award-title {
    font-size: 15px;
    line-height: 18px;
  }

  .blitz-card-root.variant-option-five .award-bottom .award-value {
    font-size: 40px;
    line-height: 44px;
  }

  .blitz-card-root.variant-option-five .award-bottom .award-winner {
    font-size: 14px;
    line-height: 17px;
  }
`;

const OPTION_SIX_STYLES = `
  .blitz-card-root.variant-option-six .awards-grid {
    left: 60px;
    width: 872px;
    top: 118px;
    height: 304px;
    position: relative;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-template-rows: 304px;
    column-gap: 28px;
  }

  .blitz-card-root.variant-option-six .bg-mark {
    opacity: 0.03;
  }

  .blitz-card-root.variant-option-six .awards-grid::before,
  .blitz-card-root.variant-option-six .awards-grid::after {
    content: "";
    position: absolute;
    top: 28px;
    bottom: 28px;
    width: 1px;
    pointer-events: none;
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0) 0%,
      rgba(237, 182, 74, 0.13) 18%,
      rgba(255, 255, 255, 0.18) 50%,
      rgba(237, 182, 74, 0.13) 82%,
      rgba(255, 255, 255, 0) 100%
    );
  }

  .blitz-card-root.variant-option-six .awards-grid::before {
    left: 33.333%;
  }

  .blitz-card-root.variant-option-six .awards-grid::after {
    left: 66.666%;
  }

  .blitz-card-root.variant-option-six .award-first-hyperstructure {
    grid-column: 1;
    grid-row: 1;
  }

  .blitz-card-root.variant-option-six .award-first-blood {
    grid-column: 2;
    grid-row: 1;
  }

  .blitz-card-root.variant-option-six .award-first-t3 {
    grid-column: 3;
    grid-row: 1;
  }

  .blitz-card-root.variant-option-six .award-first-hyperstructure,
  .blitz-card-root.variant-option-six .award-first-blood,
  .blitz-card-root.variant-option-six .award-first-t3 {
    border: none;
    border-radius: 0;
    background: transparent;
    padding: 22px 16px;
    align-items: center;
    text-align: center;
    justify-content: center;
  }

  .blitz-card-root.variant-option-six .award-title {
    font-size: 24px;
    line-height: 30px;
    opacity: 0.92;
  }

  .blitz-card-root.variant-option-six .award-index {
    margin-bottom: 6px;
    font-family: "Montserrat", sans-serif;
    font-weight: 700;
    font-size: 11px;
    line-height: 13px;
    letter-spacing: 1.6px;
    color: rgba(237, 182, 74, 0.58);
    text-transform: uppercase;
  }

  .blitz-card-root.variant-option-six .award-value,
  .blitz-card-root.variant-option-six .award-hero .award-value,
  .blitz-card-root.variant-option-six .award-side .award-value {
    margin-top: 12px;
    font-size: 56px;
    line-height: 58px;
    white-space: nowrap;
  }

  .blitz-card-root.variant-option-six .award-value.option-six-value-xl {
    font-size: 58px;
    line-height: 60px;
  }

  .blitz-card-root.variant-option-six .award-value.option-six-value-lg {
    font-size: 52px;
    line-height: 54px;
  }

  .blitz-card-root.variant-option-six .award-value.option-six-value-md {
    font-size: 48px;
    line-height: 50px;
  }

  .blitz-card-root.variant-option-six .award-value.option-six-value-sm {
    font-size: 43px;
    line-height: 46px;
    letter-spacing: -0.4px;
  }

  .blitz-card-root.variant-option-six .award-value.option-six-value-xs {
    font-size: 39px;
    line-height: 42px;
    letter-spacing: -0.6px;
  }

  .blitz-card-root.variant-option-six .award-value.option-six-value-xxs {
    font-size: 35px;
    line-height: 38px;
    letter-spacing: -0.8px;
  }

  .blitz-card-root.variant-option-six .award-winner-row {
    margin-top: 10px;
    justify-content: center;
  }

  .blitz-card-root.variant-option-six .award-winner {
    font-size: 23px;
    line-height: 29px;
  }
`;

const OPTION_SEVEN_STYLES = `
  .blitz-card-root.variant-option-seven .awards-grid {
    top: 122px;
    height: 300px;
    position: relative;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    grid-template-rows: 120px 120px;
    row-gap: 60px;
    align-content: start;
  }

  .blitz-card-root.variant-option-seven .awards-grid::before {
    content: "";
    position: absolute;
    left: 74px;
    right: 74px;
    top: 150px;
    height: 2px;
    background: linear-gradient(
      90deg,
      rgba(237, 182, 74, 0.18) 0%,
      rgba(255, 255, 255, 0.52) 50%,
      rgba(237, 182, 74, 0.18) 100%
    );
    pointer-events: none;
  }

  .blitz-card-root.variant-option-seven .award-first-blood {
    grid-column: 1 / span 4;
    grid-row: 1;
  }

  .blitz-card-root.variant-option-seven .award-first-t3 {
    grid-column: 5 / span 4;
    grid-row: 2;
  }

  .blitz-card-root.variant-option-seven .award-first-hyperstructure {
    grid-column: 9 / span 4;
    grid-row: 1;
  }

  .blitz-card-root.variant-option-seven .award-first-hyperstructure,
  .blitz-card-root.variant-option-seven .award-first-blood,
  .blitz-card-root.variant-option-seven .award-first-t3 {
    position: relative;
    border: 1px solid rgba(237, 182, 74, 0.3);
    border-radius: 18px;
    background: linear-gradient(140deg, rgba(55, 40, 16, 0.35), rgba(12, 14, 18, 0.4));
    padding: 12px 16px;
    justify-content: center;
  }

  .blitz-card-root.variant-option-seven .award-first-blood::after,
  .blitz-card-root.variant-option-seven .award-first-hyperstructure::after,
  .blitz-card-root.variant-option-seven .award-first-t3::after {
    content: "";
    position: absolute;
    left: 50%;
    width: 24px;
    height: 24px;
    border-radius: 999px;
    border: 2px solid rgba(237, 182, 74, 0.95);
    background: rgba(8, 11, 16, 0.92);
    transform: translateX(-50%);
  }

  .blitz-card-root.variant-option-seven .award-first-blood::after,
  .blitz-card-root.variant-option-seven .award-first-hyperstructure::after {
    bottom: -42px;
  }

  .blitz-card-root.variant-option-seven .award-first-t3::after {
    top: -42px;
  }

  .blitz-card-root.variant-option-seven .award-title {
    font-size: 24px;
    line-height: 29px;
    opacity: 0.92;
  }

  .blitz-card-root.variant-option-seven .award-hero .award-title {
    font-size: 24px;
    line-height: 29px;
  }

  .blitz-card-root.variant-option-seven .award-value,
  .blitz-card-root.variant-option-seven .award-side .award-value,
  .blitz-card-root.variant-option-seven .award-hero .award-value {
    margin-top: 8px;
    font-size: 68px;
    line-height: 72px;
  }

  .blitz-card-root.variant-option-seven .award-winner-row {
    margin-top: 4px;
  }

  .blitz-card-root.variant-option-seven .award-winner {
    font-size: 30px;
    line-height: 34px;
  }
`;

const OPTION_EIGHT_STYLES = `
  .blitz-card-root.variant-option-eight .awards-grid {
    top: 118px;
    height: 316px;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    grid-template-rows: 152px 152px;
    row-gap: 12px;
    align-content: start;
  }

  .blitz-card-root.variant-option-eight .award-first-hyperstructure {
    grid-column: 1 / span 8;
    grid-row: 1 / span 2;
  }

  .blitz-card-root.variant-option-eight .award-first-blood {
    grid-column: 9 / span 4;
    grid-row: 1;
  }

  .blitz-card-root.variant-option-eight .award-first-t3 {
    grid-column: 9 / span 4;
    grid-row: 2;
  }

  .blitz-card-root.variant-option-eight .award-first-hyperstructure,
  .blitz-card-root.variant-option-eight .award-first-blood,
  .blitz-card-root.variant-option-eight .award-first-t3 {
    border: 1px solid rgba(237, 182, 74, 0.3);
    border-radius: 20px;
    background: linear-gradient(145deg, rgba(62, 45, 17, 0.36), rgba(13, 16, 23, 0.42));
    padding: 16px 18px;
    justify-content: center;
  }

  .blitz-card-root.variant-option-eight .award-hero .award-title {
    font-size: 34px;
    line-height: 40px;
    opacity: 0.94;
  }

  .blitz-card-root.variant-option-eight .award-hero .award-value,
  .blitz-card-root.variant-option-eight .award-hero .award-value.award-hero-value-lg,
  .blitz-card-root.variant-option-eight .award-hero .award-value.award-hero-value-md,
  .blitz-card-root.variant-option-eight .award-hero .award-value.award-hero-value-sm {
    margin-top: 18px;
    font-size: 118px;
    line-height: 122px;
  }

  .blitz-card-root.variant-option-eight .award-hero .award-winner-row {
    margin-top: 12px;
  }

  .blitz-card-root.variant-option-eight .award-hero .award-winner {
    font-size: 40px;
    line-height: 44px;
  }

  .blitz-card-root.variant-option-eight .award-side .award-title {
    font-size: 34px;
    line-height: 40px;
    opacity: 0.94;
  }

  .blitz-card-root.variant-option-eight .award-side .award-value {
    margin-top: 12px;
    font-size: 72px;
    line-height: 76px;
  }

  .blitz-card-root.variant-option-eight .award-side .award-winner {
    font-size: 34px;
    line-height: 38px;
  }
`;

const AWARDS_CARD_VARIANT_STYLES: Record<AwardsCardVariant, string> = {
  "option-one": OPTION_ONE_STYLES,
  "option-two": OPTION_TWO_STYLES,
  "option-three": OPTION_THREE_STYLES,
  "option-four": OPTION_FOUR_STYLES,
  "option-five": OPTION_FIVE_STYLES,
  "option-six": OPTION_SIX_STYLES,
  "option-seven": OPTION_SEVEN_STYLES,
  "option-eight": OPTION_EIGHT_STYLES,
};

const AWARDS_CARD_VARIANT_ROOT_CLASS: Record<AwardsCardVariant, string> = {
  "option-one": "variant-option-one",
  "option-two": "variant-option-two",
  "option-three": "variant-option-three",
  "option-four": "variant-option-four",
  "option-five": "variant-option-five",
  "option-six": "variant-option-six",
  "option-seven": "variant-option-seven",
  "option-eight": "variant-option-eight",
};

const BlitzAwardsVariantCard = forwardRef<SVGSVGElement, BlitzAwardsVariantCardProps>(
  ({ worldName, stats, leaderboard, player, variant }, ref) => {
    const [portalTarget, setPortalTarget] = useState<SVGGElement | null>(null);
    const cardStyles = useMemo(() => `${AWARDS_CARD_BASE_STYLES}\n${AWARDS_CARD_VARIANT_STYLES[variant]}`, [variant]);
    const leaderboardIdentityLookup = useMemo(() => buildLeaderboardIdentityLookup(leaderboard), [leaderboard]);

    const awards = useMemo<AwardItem[]>(() => {
      const baseAwards: AwardItem[] = [
        {
          id: "first-hyperstructure",
          label: "First Hyperstructure",
          kind: "time",
          metric: stats.timeToFirstHyperstructureSeconds,
        },
        {
          id: "first-blood",
          label: "First Blood",
          kind: "time",
          metric: stats.firstBlood,
        },
        {
          id: "first-t3",
          label: "First T3 Troops",
          kind: "time",
          metric: stats.timeToFirstT3Seconds,
        },
        {
          id: "most-troops-killed",
          label: "Most Troops Killed",
          kind: "count",
          metric: stats.mostTroopsKilled,
        },
        {
          id: "highest-explored-tiles",
          label: "Highest Explored Tiles",
          kind: "count",
          metric: stats.highestExploredTiles,
        },
        {
          id: "biggest-structures-owned",
          label: "Most Structures Owned",
          kind: "count",
          metric: stats.biggestStructuresOwned,
        },
      ];

      if (variant === "option-six" || variant === "option-seven" || variant === "option-eight") {
        return baseAwards.filter(
          (award) => award.id === "first-hyperstructure" || award.id === "first-blood" || award.id === "first-t3",
        );
      }

      if (variant === "option-four" || variant === "option-five") {
        return baseAwards.filter((award) => award.id !== "biggest-structures-owned");
      }

      return baseAwards;
    }, [stats, variant]);

    const winnersByAward = useMemo(() => {
      return awards.map((award) => resolveWinner(award.metric, leaderboardIdentityLookup));
    }, [awards, leaderboardIdentityLookup]);

    const cardMarkup = (
      <foreignObject width="100%" height="100%">
        <div
          className={`blitz-card-root card-gold ${AWARDS_CARD_VARIANT_ROOT_CLASS[variant]}`}
          aria-label={`${worldName} Blitz Awards ${variant} card`}
        >
          <style dangerouslySetInnerHTML={{ __html: cardStyles }} />

          <div className="bg-mark" />
          <div className="bg-smoke" />
          <div className="bg-texture" />
          <div className="bg-layer gradient-overlay" />
          <div className="bg-layer dark-overlay" />

          <img className="corner-mark" src="/images/logos/Eternum-Mark-Black.png" alt="Eternum mark" />

          <div className="title-stack">
            <span className="eyebrow">{worldName}</span>
            <span className="title">Blitz Awards</span>
          </div>

          <img className="realms-logo" src="/images/logos/realms-world-white.svg" alt="Realms World logo" />

          <div className="awards-grid">
            {awards.map((award, index) => {
              const winner = winnersByAward[index];
              const isEmpty = award.metric == null;
              const isHighlightValue =
                (award.id === "first-blood" || award.id === "first-t3" || award.id === "first-hyperstructure") && !isEmpty;
              const isHero = award.id === "first-hyperstructure";
              const isSide = award.id === "first-blood" || award.id === "first-t3";
              const isNoT3 = award.id === "first-t3" && isEmpty;
              const rawDisplayValue = isNoT3
                ? "No T3"
                : variant === "option-six" && award.kind === "time"
                  ? formatOptionSixDuration(award.metric?.value ?? Number.NaN)
                  : formatAwardValue(award.metric, award.kind);
              const displayValue = rawDisplayValue;
              const heroValueSizeClass = isHero ? getHeroValueSizeClass(displayValue) : "";
              const optionSixValueSizeClass =
                variant === "option-six" && award.kind === "time" ? getOptionSixValueSizeClass(rawDisplayValue) : "";
              const optionSixMetricIndex =
                variant === "option-six" ? (award.id === "first-hyperstructure" ? "01" : award.id === "first-blood" ? "02" : "03") : null;
              const cardClasses = [
                "award",
                `award-${award.id}`,
                isHero ? "award-hero" : "",
                isSide ? "award-side" : "",
                !isHero && !isSide ? "award-bottom" : "",
                isNoT3 ? "award-no-t3" : "",
                isHighlightValue ? "award-highlight-value" : "",
                isEmpty ? "award-empty" : "",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <div key={award.id} className={cardClasses}>
                  {optionSixMetricIndex ? <div className="award-index">{optionSixMetricIndex}</div> : null}
                  <div className="award-title">{award.label}</div>
                  <div className={["award-value", heroValueSizeClass, optionSixValueSizeClass].filter(Boolean).join(" ")}>
                    {displayValue}
                  </div>
                  {winner ? (
                    <div className="award-winner-row">
                      <div className="award-winner">{winner.name}</div>
                      {winner.address ? <div className="award-address">{winner.address}</div> : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {player && (
            <div className="player">
              <div className="name">{player.name}</div>
              <div className="address">{player.address}</div>
            </div>
          )}

          <div className="cta">
            <div className="cta-title">Play Now</div>
            <div className="cta-subtitle">blitz.realms.world</div>
          </div>

          <div className="powered">
            <img src="/images/logos/Starknet.png" alt="Starknet logo" />
            <div className="copy">Powered by Starknet</div>
          </div>

          <div className="bg-layer border-frame" />
        </div>
      </foreignObject>
    );

    return (
      <>
        <svg
          ref={ref}
          xmlns="http://www.w3.org/2000/svg"
          viewBox={`0 0 ${BLITZ_CARD_DIMENSIONS.width} ${BLITZ_CARD_DIMENSIONS.height}`}
          width={BLITZ_CARD_DIMENSIONS.width}
          height={BLITZ_CARD_DIMENSIONS.height}
          className="h-auto w-full max-w-[960px]"
          role="img"
          aria-label={`${worldName} Blitz Awards ${variant} card`}
          style={{
            filter: "drop-shadow(0 32px 70px rgba(1, 11, 18, 0.64))",
          }}
        >
          <g ref={setPortalTarget} />
        </svg>
        {portalTarget ? createPortal(cardMarkup, portalTarget) : null}
      </>
    );
  },
);

BlitzAwardsVariantCard.displayName = "BlitzAwardsVariantCard";

const BlitzAwardsVariantCardWithSelector = ({
  className,
  cardRef,
  variant,
  ...cardProps
}: BlitzAwardsVariantCardWithSelectorProps & { variant: AwardsCardVariant }) => {
  const containerClasses = ["flex w-full flex-col items-center gap-4", className].filter(Boolean).join(" ");

  return (
    <div className={containerClasses}>
      <div className="flex w-full justify-center">
        <BlitzAwardsVariantCard {...cardProps} variant={variant} ref={cardRef} />
      </div>
    </div>
  );
};

export const BlitzAwardsOptionSixCardWithSelector = ({
  className,
  cardRef,
  ...cardProps
}: BlitzAwardsVariantCardWithSelectorProps) => {
  return (
    <BlitzAwardsVariantCardWithSelector
      className={className}
      cardRef={cardRef}
      variant="option-six"
      {...cardProps}
    />
  );
};
