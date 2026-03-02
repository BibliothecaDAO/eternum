import { forwardRef, type Ref, useState } from "react";
import { createPortal } from "react-dom";

import { BLITZ_CARD_DIMENSIONS } from "../lib/blitz-highlight";
import {
  BLITZ_CARD_BASE_STYLES,
  BLITZ_CARD_BRONZE_THEME,
  BLITZ_CARD_EMERALD_THEME,
  BLITZ_CARD_FONT_IMPORT,
  BLITZ_CARD_GOLD_THEME,
  BLITZ_CARD_NEUTRAL_THEME,
  BLITZ_CARD_SILVER_THEME,
  formatBlitzRankParts,
  formatBlitzValue as formatValue,
} from "../lib/blitz-card-shared";

const REWARDS_RECAP_CARD_STYLES = `
  ${BLITZ_CARD_FONT_IMPORT}
  ${BLITZ_CARD_BASE_STYLES}
  ${BLITZ_CARD_GOLD_THEME}
  ${BLITZ_CARD_SILVER_THEME}
  ${BLITZ_CARD_BRONZE_THEME}
  ${BLITZ_CARD_EMERALD_THEME}
  ${BLITZ_CARD_NEUTRAL_THEME}

  .blitz-card-root .rank-panel {
    position: absolute;
    right: 64px;
    top: 132px;
    width: 240px;
    z-index: 4;
    text-align: right;
  }

  .blitz-card-root .rank-label {
    font-family: "IM Fell English", serif;
    font-style: italic;
    font-size: 24px;
    line-height: 30px;
    color: #ffffff;
    opacity: 0.75;
  }

  .blitz-card-root .rank-value-row {
    margin-top: 8px;
    display: inline-flex;
    align-items: baseline;
    justify-content: flex-end;
    gap: 4px;
  }

  .blitz-card-root .rank-value {
    font-family: "Montserrat", sans-serif;
    font-weight: 800;
    font-size: 96px;
    line-height: 1;
    background: var(--rank-gradient);
    -webkit-text-fill-color: transparent;
    -webkit-background-clip: text;
    background-clip: text;
    text-fill-color: transparent;
  }

  .blitz-card-root .rank-suffix {
    font-family: "Montserrat", sans-serif;
    font-weight: 800;
    font-size: 44px;
    line-height: 1;
    background: var(--suffix-gradient);
    -webkit-text-fill-color: transparent;
    -webkit-background-clip: text;
    background-clip: text;
    text-fill-color: transparent;
  }

  .blitz-card-root .hero-metric {
    position: absolute;
    left: 32px;
    top: 132px;
    width: 640px;
    z-index: 4;
  }

  .blitz-card-root .hero-label {
    font-family: "IM Fell English", serif;
    font-style: italic;
    font-size: 24px;
    line-height: 30px;
    color: #ffffff;
    opacity: 0.75;
  }

  .blitz-card-root .hero-value-row {
    margin-top: 8px;
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .blitz-card-root .lords-icon {
    width: 54px;
    height: 54px;
    object-fit: contain;
    filter: drop-shadow(0 0 8px rgba(0, 0, 0, 0.35));
  }

  .blitz-card-root .hero-value {
    font-family: "Montserrat", sans-serif;
    font-weight: 800;
    font-size: 84px;
    line-height: 1;
    letter-spacing: -0.012em;
    font-variant-numeric: tabular-nums lining-nums;
    font-feature-settings:
      "tnum" 1,
      "lnum" 1;
    background: var(--rank-gradient);
    -webkit-text-fill-color: transparent;
    -webkit-background-clip: text;
    background-clip: text;
    text-fill-color: transparent;
  }

  .blitz-card-root .reward-grid {
    position: absolute;
    left: 32px;
    top: 304px;
    width: 640px;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
    z-index: 4;
  }

  .blitz-card-root .reward-card {
    border: 1px solid rgba(255, 255, 255, 0.34);
    background: rgba(0, 0, 0, 0.42);
    border-radius: 14px;
    padding: 14px 16px;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.06),
      0 10px 30px rgba(0, 0, 0, 0.28);
  }

  .blitz-card-root .reward-label {
    font-family: "IM Fell English", serif;
    font-style: italic;
    font-size: 18px;
    line-height: 22px;
    color: #ffffff;
    opacity: 0.75;
  }

  .blitz-card-root .reward-value {
    margin-top: 8px;
    font-family: "Montserrat", sans-serif;
    font-weight: 800;
    font-size: 58px;
    line-height: 1;
    letter-spacing: -0.01em;
    font-variant-numeric: tabular-nums lining-nums;
    font-feature-settings:
      "tnum" 1,
      "lnum" 1;
    color: var(--points-color);
  }
`;

type BlitzCardTheme = "gold" | "silver" | "bronze" | "neutral" | "emerald";

interface BlitzRewardsRecapCardProps {
  worldName: string;
  lordsWon: string;
  chestsWon: number;
  eliteTicketsWon: number;
  rank: number | null;
  player?: { name: string; address: string } | null;
}

const resolveCardTheme = (rank: number | null): BlitzCardTheme => {
  if (!rank || rank < 1) {
    return "gold";
  }

  if (rank === 1) {
    return "gold";
  }

  if (rank === 2) {
    return "silver";
  }

  if (rank === 3) {
    return "bronze";
  }

  if (rank >= 4 && rank <= 10) {
    return "neutral";
  }

  return "emerald";
};

const BlitzRewardsRecapCard = forwardRef<SVGSVGElement, BlitzRewardsRecapCardProps>(
  ({ worldName, lordsWon, chestsWon, eliteTicketsWon, rank, player }, ref) => {
    const [portalTarget, setPortalTarget] = useState<SVGGElement | null>(null);
    const { value: rankValue, suffix: rankSuffix } = formatBlitzRankParts(rank);
    const theme = resolveCardTheme(rank);
    const safeEliteTickets = eliteTicketsWon > 0 ? 1 : 0;

    const cardMarkup = (
      <foreignObject width="100%" height="100%">
        <div
          className={`blitz-card-root card-${theme} ${player ? "" : "no-player"}`}
          aria-label={`${worldName} rewards recap card`}
        >
          <style dangerouslySetInnerHTML={{ __html: REWARDS_RECAP_CARD_STYLES }} />

          <div className="bg-mark" />
          <div className="bg-smoke" />
          <div className="bg-texture" />
          <div className="bg-layer gradient-overlay" />
          <div className="bg-layer dark-overlay" />

          <img className="corner-mark" src="/images/logos/Eternum-Mark-Black.png" alt="Eternum mark" />

          <div className="title-stack">
            <span className="eyebrow">{worldName}</span>
            <span className="title">Rewards Recap</span>
          </div>

          <img className="realms-logo" src="/images/logos/realms-world-white.svg" alt="Realms World logo" />

          <div className="rank-panel">
            <div className="rank-label">Final Rank</div>
            <div className="rank-value-row">
              <span className="rank-value">{rankValue}</span>
              {rankSuffix ? <span className="rank-suffix">{rankSuffix}</span> : null}
            </div>
          </div>

          <div className="hero-metric">
            <div className="hero-label">$LORDS won</div>
            <div className="hero-value-row">
              <img className="lords-icon" src="/tokens/lords.png" alt="LORDS token icon" />
              <div className="hero-value">+{lordsWon}</div>
            </div>
          </div>

          <div className="reward-grid">
            <div className="reward-card">
              <div className="reward-label">Chests won</div>
              <div className="reward-value">+{formatValue(chestsWon)}</div>
            </div>
            <div className="reward-card">
              <div className="reward-label">Elite tickets won</div>
              <div className="reward-value">+{safeEliteTickets}</div>
            </div>
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
          aria-label={`${worldName} rewards recap card`}
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

BlitzRewardsRecapCard.displayName = "BlitzRewardsRecapCard";

interface BlitzRewardsRecapCardWithSelectorProps extends BlitzRewardsRecapCardProps {
  className?: string;
  cardRef?: Ref<SVGSVGElement>;
}

export const BlitzRewardsRecapCardWithSelector = ({
  className,
  cardRef,
  ...cardProps
}: BlitzRewardsRecapCardWithSelectorProps) => {
  const containerClasses = ["flex w-full flex-col items-center gap-4", className].filter(Boolean).join(" ");

  return (
    <div className={containerClasses}>
      <div className="flex w-full justify-center">
        <BlitzRewardsRecapCard {...cardProps} ref={cardRef} />
      </div>
    </div>
  );
};
