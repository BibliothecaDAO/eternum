import { forwardRef, type Ref, useState } from "react";
import { createPortal } from "react-dom";

import {
  BLITZ_CARD_DIMENSIONS,
  BlitzHighlightPlayer,
  formatOrdinal,
  getSecondaryLabel,
  truncateText,
} from "../lib/blitz-highlight";

type BlitzCardTheme = "gold" | "silver" | "bronze" | "neutral" | "emerald";

const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const CARD_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=Montserrat:wght@400;700;800&display=swap');

  .blitz-card-root {
    position: relative;
    width: 960px;
    height: 540px;
    background: #000000;
    overflow: hidden;
    color: #ffffff;
    font-family:
      "Montserrat",
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      sans-serif;
    box-shadow: 0 40px 120px rgba(0, 0, 0, 0.65);
    --overlay-gradient: linear-gradient(148.15deg, rgba(10, 10, 10, 0) 11.96%, #b38728 79.96%);
    --border-glow: rgba(191, 149, 63, 0.18);
    --border-stroke: rgba(255, 255, 255, 0.16);
    --points-color: #bf953f;
    --rank-gradient: linear-gradient(180deg, #fcf6ba 0%, #b38728 50%, #bf953f 100%);
    --suffix-gradient: var(--rank-gradient);
    --ghost-opacity: 0.05;
  }

  .blitz-card-root .bg-layer,
  .blitz-card-root .bg-mark,
  .blitz-card-root .bg-smoke,
  .blitz-card-root .bg-texture,
  .blitz-card-root .cover-image {
    position: absolute;
    pointer-events: none;
  }

  .blitz-card-root .bg-layer {
    inset: 0;
  }

  .blitz-card-root .cover-image {
    inset: 0;
    background-size: cover;
    background-position: center;
    opacity: 0.18;
    z-index: 0;
  }

  .blitz-card-root .bg-mark {
    width: 927px;
    height: 812px;
    left: -486px;
    top: -136px;
    background: url("/images/logos/Eternum-Mark-Black.png") center/contain no-repeat;
    opacity: 0.05;
    filter: invert(1) brightness(1.6);
    z-index: 1;
  }

  .blitz-card-root .bg-smoke {
    width: 1198px;
    height: 724px;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%) rotate(180deg);
    background: url("/images/score-cards/smoke.png") center/cover no-repeat;
    opacity: 0.05;
    z-index: 1;
  }

  .blitz-card-root .bg-texture {
    width: 1282px;
    height: 854px;
    left: 50%;
    top: -148px;
    transform: translateX(-50%);
    background: url("/images/score-cards/texture.jpg") center/cover no-repeat;
    mix-blend-mode: lighten;
    opacity: 0.3;
    z-index: 1;
  }

  .blitz-card-root .gradient-overlay {
    background: var(--overlay-gradient);
    mix-blend-mode: exclusion;
    opacity: 0.5;
    z-index: 2;
  }

  .blitz-card-root .dark-overlay {
    background: radial-gradient(
      120% 120% at 50% 50%,
      rgba(0, 0, 0, 0) 0%,
      rgba(0, 0, 0, 0.65) 60%,
      rgba(0, 0, 0, 0.8) 100%
    );
    mix-blend-mode: multiply;
    opacity: 0.8;
    z-index: 3;
  }

  .blitz-card-root .border-frame {
    inset: -7px;
    border: 1px solid var(--border-stroke);
    box-shadow:
      inset 0 0 40px var(--border-glow),
      0 0 0 1px rgba(0, 0, 0, 0.35);
    z-index: 6;
  }

  .blitz-card-root .corner-mark {
    position: absolute;
    width: 73px;
    height: 64px;
    left: 32px;
    top: 32px;
    object-fit: contain;
    filter: invert(1);
    opacity: 0.92;
    z-index: 4;
  }

  .blitz-card-root .title-stack {
    position: absolute;
    left: 130px;
    top: 33px;
    display: flex;
    flex-direction: column;
    gap: 0;
    align-items: flex-start;
    font-family: "IM Fell English", serif;
    z-index: 4;
  }

  .blitz-card-root .title-stack .eyebrow {
    font-size: 16px;
    line-height: 20px;
    font-style: italic;
    color: #ffffff;
    opacity: 0.75;
  }

  .blitz-card-root .title-stack .title {
    font-size: 32px;
    line-height: 41px;
    font-weight: 400;
    color: #ffffff;
  }

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

  .blitz-card-root .stat {
    position: absolute;
  }

  .blitz-card-root .stat-label {
    font-family: "IM Fell English", serif;
    font-style: italic;
    font-size: 16px;
    line-height: 20px;
    color: #ffffff;
    opacity: 0.75;
  }

  .blitz-card-root .stat-value {
    margin-top: 4px;
    font-family: "Montserrat", sans-serif;
    font-weight: 800;
    font-size: 20px;
    line-height: 24px;
    color: #ffffff;
    opacity: 0.75;
    white-space: nowrap;
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

  .blitz-card-root .cta {
    position: absolute;
    width: 192px;
    height: 72px;
    left: 736px;
    top: 436px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: 4px;
    font-family: "IM Fell English", serif;
    z-index: 4;
  }

  .blitz-card-root .cta-title {
    font-size: 40px;
    line-height: 51px;
    color: #ffffff;
    margin-top: -4px;
  }

  .blitz-card-root .cta-subtitle {
    font-size: 20px;
    line-height: 25px;
    font-style: italic;
    color: #ffffff;
    opacity: 0.75;
  }

  .blitz-card-root .player {
    position: absolute;
    width: 140px;
    height: 62px;
    left: 32px;
    top: 446px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    font-family: "IM Fell English", serif;
    z-index: 4;
  }

  .blitz-card-root .player .name {
    font-size: 32px;
    line-height: 41px;
    color: #ffffff;
    margin-top: -4px;
  }

  .blitz-card-root .player .address {
    font-size: 20px;
    line-height: 25px;
    font-style: italic;
    color: #ffffff;
    opacity: 0.75;
  }

  .blitz-card-root .powered {
    position: absolute;
    width: 149px;
    height: 62px;
    left: 196px;
    top: 446px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 11px;
    color: #ffffff;
    z-index: 4;
  }

  .blitz-card-root .powered img {
    width: 134px;
    height: 31px;
    object-fit: contain;
  }

  .blitz-card-root .powered .copy {
    font-family: "IM Fell English", serif;
    font-style: italic;
    font-size: 16px;
    line-height: 20px;
    color: #ffffff;
    opacity: 0.75;
  }

  .blitz-card-root .realms-logo {
    position: absolute;
    width: 93px;
    height: 52px;
    left: 835px;
    top: 36px;
    object-fit: contain;
    z-index: 4;
    filter: drop-shadow(0 0 4px rgba(0, 0, 0, 0.4));
  }

  .blitz-card-root.card-gold {
    --overlay-gradient: linear-gradient(148.15deg, rgba(10, 10, 10, 0) 11.96%, #b38728 79.96%);
    --border-glow: rgba(191, 149, 63, 0.18);
    --border-stroke: rgba(255, 255, 255, 0.16);
    --points-color: #bf953f;
    --rank-gradient: linear-gradient(180deg, #fcf6ba 0%, #b38728 50%, #bf953f 100%);
    --suffix-gradient: var(--rank-gradient);
    --ghost-opacity: 0.05;
  }

  .blitz-card-root.card-silver {
    --overlay-gradient: linear-gradient(148.15deg, rgba(10, 10, 10, 0) 11.96%, #434343 79.96%);
    --border-glow: rgba(172, 172, 172, 0.16);
    --border-stroke: rgba(255, 255, 255, 0.16);
    --points-color: #bdbdbd;
    --rank-gradient: linear-gradient(180deg, #f8f8f8 0%, #acacac 50%, #929292 100%);
    --suffix-gradient: var(--rank-gradient);
    --ghost-opacity: 0.08;
  }

  .blitz-card-root.card-emerald {
    --overlay-gradient: linear-gradient(148.15deg, rgba(10, 10, 10, 0) 11.96%, #4e8b87 79.96%);
    --border-glow: rgba(78, 139, 135, 0.2);
    --border-stroke: rgba(255, 255, 255, 0.16);
    --points-color: #4e7e8b;
    --rank-gradient: linear-gradient(180deg, #7bffe6 0%, #2c4063 50%, #112b26 100%);
    --suffix-gradient: var(--rank-gradient);
    --ghost-opacity: 0.05;
  }

  .blitz-card-root.card-neutral {
    --overlay-gradient: linear-gradient(148.15deg, rgba(10, 10, 10, 0) 11.96%, #691c87 79.96%);
    --border-glow: rgba(105, 28, 135, 0.2);
    --border-stroke: rgba(255, 255, 255, 0.16);
    --points-color: #691c87;
    --rank-gradient: linear-gradient(180deg, #9442b8 0%, #46156d 50%, #230537 100%);
    --suffix-gradient: var(--rank-gradient);
    --ghost-opacity: 0.05;
  }

  .blitz-card-root.card-bronze {
    --overlay-gradient: linear-gradient(148.15deg, rgba(10, 10, 10, 0) 11.96%, #6e3a06 79.96%);
    --border-glow: rgba(146, 85, 24, 0.2);
    --border-stroke: rgba(255, 255, 255, 0.16);
    --points-color: #925518;
    --rank-gradient: linear-gradient(180deg, #925518 0%, #6e3a06 50%, #532c04 100%);
    --suffix-gradient: var(--rank-gradient);
    --ghost-opacity: 0.05;
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

const formatRankParts = (rank: number | null | undefined): { value: string; suffix: string } => {
  if (!rank || rank < 1) {
    return { value: "--", suffix: "" };
  }

  const ordinal = formatOrdinal(rank).toUpperCase();
  const match = ordinal.match(/^(\d+)(ST|ND|RD|TH)$/);

  if (!match) {
    return { value: `${rank}`, suffix: "" };
  }

  return { value: match[1], suffix: match[2] };
};

const formatPointsValue = (value: number | null | undefined): string => {
  if (value === null || value === undefined) {
    return "--";
  }

  return numberFormatter.format(Math.max(0, value));
};

const formatStatLine = (count: number | null | undefined, points: number | null | undefined): string => {
  const hasCount = count !== null && count !== undefined;
  const hasPoints = points !== null && points !== undefined;

  const countLabel = hasCount ? numberFormatter.format(count ?? 0) : null;
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

export const BlitzHighlightCard = forwardRef<SVGSVGElement, BlitzHighlightCardProps>(
  ({ title, subtitle, highlight }, ref) => {
    const [portalTarget, setPortalTarget] = useState<SVGGElement | null>(null);
    const theme = resolveCardTheme(highlight?.rank);
    const { value: rankValue, suffix: rankSuffix } = formatRankParts(highlight?.rank ?? null);
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
        <div
          xmlns="http://www.w3.org/1999/xhtml"
          className={`blitz-card-root card-${theme}`}
          aria-label={`${title} ${subtitle} card`}
        >
          <style dangerouslySetInnerHTML={{ __html: CARD_STYLES }} />

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
            <div className="cta-subtitle">dev.blitz.realms.world</div>
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
