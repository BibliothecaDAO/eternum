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

const HERO_LEFT_AWARDS_CARD_STYLES = `
  ${BLITZ_CARD_FONT_IMPORT}
  ${BLITZ_CARD_BASE_STYLES}
  ${BLITZ_CARD_GOLD_THEME}

  .blitz-card-root .awards-grid {
    position: absolute;
    left: 44px;
    top: 98px;
    width: 872px;
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    grid-template-rows: 122px 108px 94px;
    column-gap: 12px;
    row-gap: 10px;
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

  .blitz-card-root .award-first-hyperstructure {
    grid-column: 1 / span 4;
    grid-row: 1 / span 2;
    padding-top: 14px;
  }

  .blitz-card-root .award-first-blood {
    grid-column: 5 / span 2;
    grid-row: 1;
    padding-top: 14px;
  }

  .blitz-card-root .award-first-t3 {
    grid-column: 5 / span 2;
    grid-row: 2;
  }

  .blitz-card-root .award-most-troops-killed {
    grid-column: 1 / span 2;
    grid-row: 3;
  }

  .blitz-card-root .award-highest-explored-tiles {
    grid-column: 3 / span 2;
    grid-row: 3;
  }

  .blitz-card-root .award-biggest-structures-owned {
    grid-column: 5 / span 2;
    grid-row: 3;
    padding-top: 7px;
  }

  .blitz-card-root .award-bottom {
    transform: translateY(-24px);
  }

  .blitz-card-root .award-empty {
    background: transparent;
    box-shadow: none;
  }

  .blitz-card-root .award-title {
    font-family: "IM Fell English", serif;
    font-style: italic;
    font-size: 15px;
    line-height: 19px;
    color: #ffffff;
    opacity: 0.8;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .blitz-card-root .award-hero .award-title {
    font-size: 19px;
    line-height: 24px;
  }

  .blitz-card-root .award-side .award-title {
    font-size: 17px;
    line-height: 22px;
  }

  .blitz-card-root .award-empty .award-title {
    opacity: 0.64;
  }

  .blitz-card-root .award-value {
    margin-top: 4px;
    font-family: "Montserrat", sans-serif;
    font-weight: 800;
    font-size: 34px;
    line-height: 38px;
    color: #ffffff;
    white-space: nowrap;
    font-variant-numeric: tabular-nums lining-nums;
  }

  .blitz-card-root .award-hero .award-value {
    margin-top: 6px;
    font-size: 90px;
    line-height: 94px;
  }

  .blitz-card-root .award-side .award-value {
    margin-top: 5px;
    font-size: 40px;
    line-height: 44px;
  }

  .blitz-card-root .award-first-blood .award-value {
    font-size: 46px;
    line-height: 50px;
  }

  .blitz-card-root .award-highlight-value .award-value {
    background: var(--rank-gradient);
    -webkit-text-fill-color: transparent;
    -webkit-background-clip: text;
    background-clip: text;
    text-fill-color: transparent;
  }

  .blitz-card-root .award-empty .award-value {
    color: #d9d9d9;
    opacity: 0.88;
  }

  .blitz-card-root .award-empty.award-hero .award-value {
    font-size: 76px;
    line-height: 80px;
  }

  .blitz-card-root .award-empty.award-side .award-value {
    font-size: 34px;
    line-height: 38px;
  }

  .blitz-card-root .award-no-t3 .award-value {
    color: #d0d0d0;
    opacity: 0.72;
  }

  .blitz-card-root .award-empty.award-bottom .award-value {
    font-size: 30px;
    line-height: 34px;
  }

  .blitz-card-root .award-winner-row {
    margin-top: 4px;
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .blitz-card-root .award-hero .award-winner-row,
  .blitz-card-root .award-side .award-winner-row {
    gap: 8px;
    margin-top: 8px;
  }

  .blitz-card-root .award-side .award-winner-row {
    margin-top: 4px;
  }

  .blitz-card-root .award-winner {
    font-family: "IM Fell English", serif;
    font-style: normal;
    font-weight: 400;
    font-size: 20px;
    line-height: 24px;
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

  .blitz-card-root .award-side .award-winner {
    font-size: 18px;
    line-height: 22px;
  }

  .blitz-card-root .award-address {
    font-family: "IM Fell English", serif;
    font-style: italic;
    font-size: 14px;
    line-height: 18px;
    color: #ffffff;
    opacity: 0.78;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .blitz-card-root .award-bottom .award-address {
    font-size: 12px;
    line-height: 15px;
    opacity: 0.72;
  }

  .blitz-card-root .award-side .award-address {
    font-size: 13px;
    line-height: 16px;
    opacity: 0.74;
  }
`;

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

interface BlitzAwardsHeroLeftCardProps {
  worldName: string;
  stats: GameReviewStats;
  leaderboard: LandingLeaderboardEntry[];
  player?: { name: string; address: string } | null;
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

const formatAwardValue = (metric: MetricValue, kind: AwardKind): string => {
  if (!metric) return "None";
  return kind === "time" ? formatDuration(metric.value) : formatValue(metric.value);
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

const BlitzAwardsHeroLeftCard = forwardRef<SVGSVGElement, BlitzAwardsHeroLeftCardProps>(
  ({ worldName, stats, leaderboard, player }, ref) => {
    const [portalTarget, setPortalTarget] = useState<SVGGElement | null>(null);
    const leaderboardIdentityLookup = useMemo(() => buildLeaderboardIdentityLookup(leaderboard), [leaderboard]);

    const awards = useMemo<AwardItem[]>(
      () => [
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
      ],
      [stats],
    );

    const winnersByAward = useMemo(() => {
      return awards.map((award) => resolveWinner(award.metric, leaderboardIdentityLookup));
    }, [awards, leaderboardIdentityLookup]);

    const cardMarkup = (
      <foreignObject width="100%" height="100%">
        <div className="blitz-card-root card-gold" aria-label={`${worldName} Blitz Awards hero-left card`}>
          <style dangerouslySetInnerHTML={{ __html: HERO_LEFT_AWARDS_CARD_STYLES }} />

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
              const displayValue = isNoT3 ? "No T3" : formatAwardValue(award.metric, award.kind);
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
                  <div className="award-title">{award.label}</div>
                  <div className="award-value">{displayValue}</div>
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
          aria-label={`${worldName} blitz awards hero-left card`}
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

BlitzAwardsHeroLeftCard.displayName = "BlitzAwardsHeroLeftCard";

interface BlitzAwardsHeroLeftCardWithSelectorProps extends BlitzAwardsHeroLeftCardProps {
  className?: string;
  cardRef?: Ref<SVGSVGElement>;
}

export const BlitzAwardsHeroLeftCardWithSelector = ({
  className,
  cardRef,
  ...cardProps
}: BlitzAwardsHeroLeftCardWithSelectorProps) => {
  const containerClasses = ["flex w-full flex-col items-center gap-4", className].filter(Boolean).join(" ");

  return (
    <div className={containerClasses}>
      <div className="flex w-full justify-center">
        <BlitzAwardsHeroLeftCard {...cardProps} ref={cardRef} />
      </div>
    </div>
  );
};
