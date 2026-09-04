import { forwardRef, type Ref, useState } from "react";
import { createPortal } from "react-dom";

import {
  BLITZ_CARD_DIMENSIONS,
  BlitzHighlightPlayer,
  formatOrdinal,
  getSecondaryLabel,
  truncateText,
} from "../lib/blitz-highlight";
import {
  BLITZ_CARD_FONT_IMPORT,
  BLITZ_CARD_BASE_STYLES,
  BLITZ_CARD_GOLD_THEME,
  BLITZ_CARD_SILVER_THEME,
  BLITZ_CARD_BRONZE_THEME,
  BLITZ_CARD_EMERALD_THEME,
  BLITZ_CARD_NEUTRAL_THEME,
  blitzNumberFormatter,
  formatBlitzRankParts,
} from "../lib/blitz-card-shared";

type BlitzCardTheme = "gold" | "silver" | "bronze" | "neutral" | "emerald";

const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const HIGHLIGHT_CARD_STYLES = `
  ${BLITZ_CARD_FONT_IMPORT}
  ${BLITZ_CARD_BASE_STYLES}
  ${BLITZ_CARD_GOLD_THEME}
  ${BLITZ_CARD_SILVER_THEME}
  ${BLITZ_CARD_BRONZE_THEME}
  ${BLITZ_CARD_EMERALD_THEME}
  ${BLITZ_CARD_NEUTRAL_THEME}

  .blitz-card-root .points {
    position: absolute;
    left: 32px;
    top: 50%;
    transform: translateY(-50%);
    width: 330px;
    height: 244px;
    z-index: 4;
  }

  .blitz-card-root .points-label {
    position: absolute;
    left: 0;
    top: 0;
    width: 127px;
    font-family: "IM Fell English", serif;
    font-style: italic;
    font-size: 24px;
    line-height: 30px;
    text-align: right;
    color: #ffffff;
  }

  .blitz-card-root .points-value {
    position: absolute;
    left: 0;
    top: 34px;
    width: 237px;
    font-family: "Montserrat", sans-serif;
    font-weight: 800;
    font-size: 64px;
    line-height: 78px;
    color: var(--points-color);
  }

  .blitz-card-root .stat-tiles {
    left: 0;
    top: 124px;
  }

  .blitz-card-root .stat-rifts {
    left: 0;
    top: 196px;
  }

  .blitz-card-root .stat-crates {
    left: 155px;
    top: 124px;
  }

  .blitz-card-root .stat-hs-taken {
    left: 133px;
    top: 196px;
  }

  .blitz-card-root .stat-hs-held {
    left: 272px;
    top: 196px;
  }

  .blitz-card-root .rank-main {
    position: absolute;
    width: 290px;
    height: 219px;
    left: 515px;
    top: calc(50% - 109.5px - 40px);
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 8px;
    z-index: 4;
  }

  .blitz-card-root .rank-number {
    font-family: "Montserrat", sans-serif;
    font-weight: 800;
    font-size: 312px;
    line-height: 1;
    display: inline-block;
    background: var(--rank-gradient);
    -webkit-text-fill-color: transparent;
    -webkit-background-clip: text;
    background-clip: text;
    text-fill-color: transparent;
  }

  .blitz-card-root .rank-suffix {
    font-family: "Montserrat", sans-serif;
    font-weight: 800;
    font-size: 120px;
    line-height: 1;
    display: inline-block;
    background: var(--suffix-gradient);
    -webkit-text-fill-color: transparent;
    -webkit-background-clip: text;
    background-clip: text;
    text-fill-color: transparent;
  }

  .blitz-card-root.card-silver .rank-main {
    width: 396px;
    left: 462px;
  }

  .blitz-card-root.card-emerald .rank-main {
    width: 514px;
    left: 403px;
  }

  .blitz-card-root.card-neutral .rank-main {
    width: 498px;
    left: 411px;
  }

  .blitz-card-root.card-bronze .rank-main {
    width: 389px;
    left: 466px;
  }
`;

const resolveCardTheme = (rank: number | null | undefined): BlitzCardTheme => {
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

const formatPointsValue = (value: number | null | undefined): string => {
  if (value === null || value === undefined) {
    return "--";
  }

  return blitzNumberFormatter.format(Math.max(0, value));
};

const formatStatLine = (count: number | null | undefined, points: number | null | undefined): string => {
  const hasCount = count !== null && count !== undefined;
  const hasPoints = points !== null && points !== undefined;

  const countLabel = hasCount ? blitzNumberFormatter.format(count ?? 0) : null;
  const compactPoints = hasPoints ? compactFormatter.format(points ?? 0).toLowerCase() : null;
  const pointsLabel = compactPoints ? `${compactPoints} Pts` : null;

  if (countLabel && pointsLabel) {
    return `${countLabel} - ${pointsLabel}`;
  }

  if (countLabel) {
    return countLabel;
  }

  if (pointsLabel) {
    return pointsLabel;
  }

  return "--";
};

interface BlitzHighlightCardProps {
  title: string;
  subtitle: string;
  winnerLine?: string | null;
  highlight?: BlitzHighlightPlayer | null;
}

const BlitzHighlightCard = forwardRef<SVGSVGElement, BlitzHighlightCardProps>(({ title, subtitle, highlight }, ref) => {
  const [portalTarget, setPortalTarget] = useState<SVGGElement | null>(null);
  const theme = resolveCardTheme(highlight?.rank);
  const { value: rankValue, suffix: rankSuffix } = formatBlitzRankParts(highlight?.rank ?? null);
  const highlightPointsValue = formatPointsValue(highlight?.points ?? null);
  const highlightName = highlight ? truncateText(highlight.name, 30) : "player";
  const highlightSecondary = highlight ? truncateText(getSecondaryLabel(highlight), 32) : "0x----";
  const statBreakdown = [
    {
      label: "Tiles Explored",
      count: highlight?.exploredTiles,
      points: highlight?.exploredTilePoints,
    },
    {
      label: "Crates Opened",
      count: highlight?.relicCratesOpened,
      points: highlight?.relicCratePoints,
    },
    {
      label: "Rifts & Camps",
      count: highlight?.riftsTaken,
      points: highlight?.riftPoints,
    },
    {
      label: "HS Taken",
      count: highlight?.hyperstructuresConquered,
      points: highlight?.hyperstructurePoints,
    },
    {
      label: "HS Held",
      count: highlight?.hyperstructuresHeld,
      points: highlight?.hyperstructuresHeldPoints,
    },
  ].map((stat) => ({
    label: stat.label,
    combinedValue: formatStatLine(stat.count ?? null, stat.points ?? null),
  }));

  const cardMarkup = (
    <foreignObject width="100%" height="100%">
      <div className={`blitz-card-root card-${theme}`} aria-label={`${title} ${subtitle} card`}>
        <style dangerouslySetInnerHTML={{ __html: HIGHLIGHT_CARD_STYLES }} />

        <div className="bg-mark" />
        <div className="bg-smoke" />
        <div className="bg-texture" />
        <div className="bg-layer gradient-overlay" />
        <div className="bg-layer dark-overlay" />

        <div className="rank-main" aria-label={highlight ? `${rankValue}${rankSuffix} place` : "Unranked"}>
          <span className="rank-number">{rankValue}</span>
          {rankSuffix ? <span className="rank-suffix">{rankSuffix}</span> : null}
        </div>

        <img className="corner-mark" src="/images/logos/Eternum-Mark-Black.png" alt="Eternum mark" />

        <div className="title-stack">
          <span className="eyebrow">{title}</span>
          <span className="title">{subtitle}</span>
        </div>

        <div className="points">
          <div className="points-label">Points Secured</div>
          <div className="points-value">{highlightPointsValue}</div>

          <div className="stat stat-tiles">
            <div className="stat-label">Tiles Explored</div>
            <div className="stat-value">{statBreakdown[0].combinedValue}</div>
          </div>

          <div className="stat stat-crates">
            <div className="stat-label">Crates Opened</div>
            <div className="stat-value">{statBreakdown[1].combinedValue}</div>
          </div>

          <div className="stat stat-rifts">
            <div className="stat-label">Rifts & Camps</div>
            <div className="stat-value">{statBreakdown[2].combinedValue}</div>
          </div>

          <div className="stat stat-hs-taken">
            <div className="stat-label">HS Taken</div>
            <div className="stat-value">{statBreakdown[3].combinedValue}</div>
          </div>

          <div className="stat stat-hs-held">
            <div className="stat-label">HS Held</div>
            <div className="stat-value">{statBreakdown[4].combinedValue}</div>
          </div>
        </div>

        <div className="cta">
          <div className="cta-title">Play Now</div>
          <div className="cta-subtitle">blitz.realms.world</div>
        </div>

        <div className="player">
          <div className="name">{highlightName}</div>
          <div className="address">{highlightSecondary}</div>
        </div>

        <div className="powered">
          <img src="/images/logos/Starknet.png" alt="Starknet logo" />
          <div className="copy">Powered by Starknet</div>
        </div>

        <img className="realms-logo" src="/images/logos/realms-world-white.svg" alt="Realms World logo" />

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
        aria-label={
          highlight
            ? `${subtitle} highlight card for ${highlightName} at ${formatOrdinal(highlight.rank)} place`
            : `${subtitle} highlight card`
        }
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

BlitzHighlightCard.displayName = "BlitzHighlightCard";

interface BlitzHighlightCardWithSelectorProps extends BlitzHighlightCardProps {
  className?: string;
  cardRef?: Ref<SVGSVGElement>;
  enableCopyButton?: boolean;
}

export const BlitzHighlightCardWithSelector = ({
  className,
  cardRef,
  enableCopyButton = true,
  ...cardProps
}: BlitzHighlightCardWithSelectorProps) => {
  const containerClasses = ["flex w-full flex-col items-center gap-4 lg:flex-row lg:items-start", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={containerClasses}>
      <div className="flex w-full justify-center">
        <BlitzHighlightCard {...cardProps} ref={cardRef} />
      </div>
    </div>
  );
};
