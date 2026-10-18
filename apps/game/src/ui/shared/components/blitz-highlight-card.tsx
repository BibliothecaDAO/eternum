import { formatExact, formatPoints } from "@bibliothecadao/types";
import { FONTS } from "@/tokens";
import { forwardRef, type Ref, useState } from "react";
import { createPortal } from "react-dom";

import {
  BLITZ_CARD_DIMENSIONS,
  BLITZ_CARD_PORTRAIT_DIMENSIONS,
  BlitzHighlightPlayer,
  formatOrdinal,
  getSecondaryLabel,
  truncateText,
} from "../lib/blitz-highlight";
import {
  BLITZ_CARD_FONT_FACES,
  BLITZ_CARD_BASE_STYLES,
  BLITZ_CARD_GOLD_THEME,
  BLITZ_CARD_SILVER_THEME,
  BLITZ_CARD_BRONZE_THEME,
  BLITZ_CARD_EMERALD_THEME,
  BLITZ_CARD_NEUTRAL_THEME,
  formatBlitzRankParts,
} from "../lib/blitz-card-shared";
import { APP_HOST } from "@/config/app-address";

type BlitzCardTheme = "gold" | "silver" | "bronze" | "neutral" | "emerald";

const HIGHLIGHT_CARD_STYLES = `
  ${BLITZ_CARD_FONT_FACES}
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
    width: 237px;
    font-family: ${FONTS.body};
    font-size: 24px;
    line-height: 30px;
    white-space: nowrap;
    color: #ffffff;
  }

  .blitz-card-root .points-value {
    position: absolute;
    left: 0;
    top: 34px;
    width: 237px;
    font-family: ${FONTS.body};
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
    font-family: ${FONTS.body};
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
    font-family: ${FONTS.body};
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

  /* Portrait: the same parts stacked in a 340 px column, every word at 15 px or more. After the themes, so it wins. */
  .blitz-card-root.layout-portrait {
    width: ${BLITZ_CARD_PORTRAIT_DIMENSIONS.width}px;
    height: ${BLITZ_CARD_PORTRAIT_DIMENSIONS.height}px;
  }

  .blitz-card-root.layout-portrait .corner-mark {
    left: 20px;
    top: 20px;
    width: 46px;
    height: 40px;
  }

  .blitz-card-root.layout-portrait .title-stack {
    left: 76px;
    top: 18px;
  }

  .blitz-card-root.layout-portrait .title-stack .eyebrow {
    font-size: 15px;
    line-height: 18px;
  }

  .blitz-card-root.layout-portrait .title-stack .title {
    font-size: 24px;
    line-height: 30px;
  }

  .blitz-card-root.layout-portrait .realms-logo {
    left: 256px;
    top: 22px;
    width: 64px;
    height: 36px;
  }

  .blitz-card-root.layout-portrait .rank-main {
    left: 0;
    top: 76px;
    width: 100%;
    height: 150px;
  }

  .blitz-card-root.layout-portrait .rank-number {
    font-size: 150px;
  }

  .blitz-card-root.layout-portrait .rank-suffix {
    font-size: 60px;
  }

  .blitz-card-root.layout-portrait .points {
    left: 20px;
    top: 236px;
    transform: none;
    width: 300px;
    height: 262px;
  }

  .blitz-card-root.layout-portrait .points-label {
    width: 300px;
    font-size: 18px;
    line-height: 22px;
  }

  .blitz-card-root.layout-portrait .points-value {
    top: 24px;
    font-size: 48px;
    line-height: 56px;
  }

  .blitz-card-root.layout-portrait .stat-label {
    font-size: 15px;
    line-height: 19px;
  }

  .blitz-card-root.layout-portrait .stat-value {
    font-size: 18px;
    line-height: 22px;
  }

  .blitz-card-root.layout-portrait .stat-tiles {
    left: 0;
    top: 96px;
  }

  .blitz-card-root.layout-portrait .stat-crates {
    left: 160px;
    top: 96px;
  }

  .blitz-card-root.layout-portrait .stat-rifts {
    left: 0;
    top: 156px;
  }

  .blitz-card-root.layout-portrait .stat-hs-taken {
    left: 160px;
    top: 156px;
  }

  .blitz-card-root.layout-portrait .stat-hs-held {
    left: 0;
    top: 216px;
  }

  .blitz-card-root.layout-portrait .player {
    left: 20px;
    top: 516px;
    width: 150px;
    height: 54px;
  }

  .blitz-card-root.layout-portrait .player .name {
    font-size: 24px;
    line-height: 30px;
    margin-top: 0;
  }

  .blitz-card-root.layout-portrait .player .address,
  .blitz-card-root.layout-portrait .cta-subtitle,
  .blitz-card-root.layout-portrait .powered .copy {
    font-size: 15px;
    line-height: 19px;
  }

  .blitz-card-root.layout-portrait .cta {
    left: 180px;
    top: 516px;
    width: 140px;
    height: 54px;
    justify-content: flex-start;
  }

  .blitz-card-root.layout-portrait .cta-title {
    font-size: 24px;
    line-height: 30px;
    margin-top: 0;
  }

  .blitz-card-root.layout-portrait .powered,
  .blitz-card-root.layout-portrait.no-player .powered {
    left: 20px;
    top: 584px;
    width: 300px;
    height: 26px;
    flex-direction: row;
    align-items: center;
    gap: 10px;
  }

  .blitz-card-root.layout-portrait .powered img {
    width: 100px;
    height: 24px;
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

  return formatExact(Math.max(0, value));
};

const formatStatLine = (count: number | null | undefined, points: number | null | undefined): string => {
  const hasCount = count !== null && count !== undefined;
  const hasPoints = points !== null && points !== undefined;

  const countLabel = hasCount ? formatExact(count ?? 0) : null;
  const pointsLabel = hasPoints ? formatPoints(points ?? 0) : null;

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

/** The card's two arrangements of the same parts: landscape (shared as an image), and portrait for a phone's page. */
export type BlitzCardLayout = "landscape" | "portrait";

interface BlitzHighlightCardProps {
  title: string;
  subtitle: string;
  winnerLine?: string | null;
  highlight?: BlitzHighlightPlayer | null;
  layout?: BlitzCardLayout;
}

const BlitzHighlightCard = forwardRef<SVGSVGElement, BlitzHighlightCardProps>(
  ({ title, subtitle, highlight, layout = "landscape" }, ref) => {
    const dimensions = layout === "portrait" ? BLITZ_CARD_PORTRAIT_DIMENSIONS : BLITZ_CARD_DIMENSIONS;
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
        label: "Hyperstructures taken",
        count: highlight?.hyperstructuresConquered,
        points: highlight?.hyperstructurePoints,
      },
      {
        label: "Hyperstructures held",
        count: highlight?.hyperstructuresHeld,
        points: highlight?.hyperstructuresHeldPoints,
      },
    ].map((stat) => ({
      label: stat.label,
      combinedValue: formatStatLine(stat.count ?? null, stat.points ?? null),
    }));

    const cardMarkup = (
      <foreignObject width="100%" height="100%">
        <div
          className={`blitz-card-root card-${theme}${layout === "portrait" ? " layout-portrait" : ""}`}
          aria-label={`${title} ${subtitle} card`}
        >
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
              <div className="stat-label">Hyperstructures taken</div>
              <div className="stat-value">{statBreakdown[3].combinedValue}</div>
            </div>

            <div className="stat stat-hs-held">
              <div className="stat-label">Hyperstructures held</div>
              <div className="stat-value">{statBreakdown[4].combinedValue}</div>
            </div>
          </div>

          <div className="cta">
            <div className="cta-title">Play Now</div>
            <div className="cta-subtitle">{APP_HOST}</div>
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
          viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
          width={dimensions.width}
          height={dimensions.height}
          className={layout === "portrait" ? "h-auto w-full" : "h-auto w-full max-w-[960px]"}
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
  },
);

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
