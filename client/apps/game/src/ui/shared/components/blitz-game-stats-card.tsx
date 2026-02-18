import { forwardRef, type Ref, useState } from "react";
import { createPortal } from "react-dom";

import type { GameReviewStats } from "@/services/review/game-review-service";
import { BLITZ_CARD_DIMENSIONS } from "../lib/blitz-highlight";
import {
  BLITZ_CARD_FONT_IMPORT,
  BLITZ_CARD_BASE_STYLES,
  BLITZ_CARD_GOLD_THEME,
  formatBlitzValue as formatValue,
} from "../lib/blitz-card-shared";

const GAME_STATS_CARD_STYLES = `
  ${BLITZ_CARD_FONT_IMPORT}
  ${BLITZ_CARD_BASE_STYLES}
  ${BLITZ_CARD_GOLD_THEME}

  .blitz-card-root .hero-metric {
    position: absolute;
    left: 32px;
    top: 120px;
    z-index: 4;
  }

  .blitz-card-root .hero-label {
    font-family: "IM Fell English", serif;
    font-style: italic;
    font-size: 22px;
    line-height: 28px;
    color: #ffffff;
    opacity: 0.75;
  }

  .blitz-card-root .hero-value {
    margin-top: 4px;
    font-family: "Montserrat", sans-serif;
    font-weight: 800;
    font-size: 72px;
    line-height: 88px;
    background: var(--rank-gradient);
    -webkit-text-fill-color: transparent;
    -webkit-background-clip: text;
    background-clip: text;
    text-fill-color: transparent;
  }

  .blitz-card-root .stats-grid {
    position: absolute;
    left: 32px;
    top: 264px;
    display: grid;
    grid-template-columns: repeat(3, 148px);
    gap: 12px 24px;
    z-index: 4;
  }

  .blitz-card-root .stats-grid .stat {
    position: relative;
  }

  .blitz-card-root .stats-grid .stat-label {
    font-size: 14px;
    line-height: 18px;
  }

  .blitz-card-root .stats-grid .stat-value {
    font-size: 26px;
    line-height: 32px;
    color: #ffffff;
    opacity: 1;
  }

  .blitz-card-root .troop-section {
    position: absolute;
    left: 560px;
    top: 120px;
    z-index: 4;
  }

  .blitz-card-root .troop-label {
    font-family: "IM Fell English", serif;
    font-style: italic;
    font-size: 22px;
    line-height: 28px;
    color: #ffffff;
    opacity: 0.75;
  }

  .blitz-card-root .troop-hero-value {
    margin-top: 4px;
    font-family: "Montserrat", sans-serif;
    font-weight: 800;
    font-size: 48px;
    line-height: 58px;
    background: var(--rank-gradient);
    -webkit-text-fill-color: transparent;
    -webkit-background-clip: text;
    background-clip: text;
    text-fill-color: transparent;
  }

  .blitz-card-root .troop-breakdown {
    font-family: "IM Fell English", serif;
    font-style: italic;
    font-size: 14px;
    line-height: 18px;
    color: #ffffff;
    opacity: 0.5;
    margin-top: 8px;
  }
`;

interface BlitzGameStatsCardProps {
  worldName: string;
  stats: GameReviewStats;
  player?: { name: string; address: string } | null;
}

const BlitzGameStatsCard = forwardRef<SVGSVGElement, BlitzGameStatsCardProps>(({ worldName, stats, player }, ref) => {
  const [portalTarget, setPortalTarget] = useState<SVGGElement | null>(null);
  const totalTroops = stats.totalT1TroopsCreated + stats.totalT2TroopsCreated + stats.totalT3TroopsCreated;
  const troopBreakdown = `T1: ${formatValue(stats.totalT1TroopsCreated)} · T2: ${formatValue(stats.totalT2TroopsCreated)} · T3: ${formatValue(stats.totalT3TroopsCreated)}`;

  const cardMarkup = (
    <foreignObject width="100%" height="100%">
      <div className="blitz-card-root card-gold" aria-label={`${worldName} Game Stats card`}>
        <style dangerouslySetInnerHTML={{ __html: GAME_STATS_CARD_STYLES }} />

        <div className="bg-mark" />
        <div className="bg-smoke" />
        <div className="bg-texture" />
        <div className="bg-layer gradient-overlay" />
        <div className="bg-layer dark-overlay" />

        <img className="corner-mark" src="/images/logos/Eternum-Mark-Black.png" alt="Eternum mark" />

        <div className="title-stack">
          <span className="eyebrow">{worldName}</span>
          <span className="title">Game Stats</span>
        </div>

        <img className="realms-logo" src="/images/logos/realms-world-white.svg" alt="Realms World logo" />

        <div className="hero-metric">
          <div className="hero-label">Total Transactions</div>
          <div className="hero-value">{formatValue(stats.totalTransactions)}</div>
        </div>

        <div className="stats-grid">
          <div className="stat">
            <div className="stat-label">Players</div>
            <div className="stat-value">{formatValue(stats.numberOfPlayers)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Tiles Explored</div>
            <div className="stat-value">{formatValue(stats.totalTilesExplored)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Dead Troops</div>
            <div className="stat-value">{formatValue(stats.totalDeadTroops)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Camps Taken</div>
            <div className="stat-value">{formatValue(stats.totalCampsTaken)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Essence Rifts</div>
            <div className="stat-value">{formatValue(stats.totalEssenceRiftsTaken)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Hyperstructures</div>
            <div className="stat-value">{formatValue(stats.totalHyperstructuresTaken)}</div>
          </div>
        </div>

        <div className="troop-section">
          <div className="troop-label">Troops Created</div>
          <div className="troop-hero-value">{formatValue(totalTroops)}</div>
          <div className="troop-breakdown">{troopBreakdown}</div>
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
        aria-label={`${worldName} game stats card`}
        style={{
          filter: "drop-shadow(0 32px 70px rgba(1, 11, 18, 0.64))",
        }}
      >
        <g ref={setPortalTarget} />
      </svg>
      {portalTarget ? createPortal(cardMarkup, portalTarget) : null}
    </>
  );
});

BlitzGameStatsCard.displayName = "BlitzGameStatsCard";

interface BlitzGameStatsCardWithSelectorProps extends BlitzGameStatsCardProps {
  className?: string;
  cardRef?: Ref<SVGSVGElement>;
}

export const BlitzGameStatsCardWithSelector = ({
  className,
  cardRef,
  ...cardProps
}: BlitzGameStatsCardWithSelectorProps) => {
  const containerClasses = ["flex w-full flex-col items-center gap-4", className].filter(Boolean).join(" ");

  return (
    <div className={containerClasses}>
      <div className="flex w-full justify-center">
        <BlitzGameStatsCard {...cardProps} ref={cardRef} />
      </div>
    </div>
  );
};
