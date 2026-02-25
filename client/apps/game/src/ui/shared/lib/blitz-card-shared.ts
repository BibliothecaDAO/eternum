/**
 * Shared CSS infrastructure for all Blitz card types (highlight, game stats, leaderboard).
 * Contains font imports, background layer styles, branding positions, and theme variables
 * that are common across all 960x540 shareable cards.
 */

import { formatOrdinal } from "./blitz-highlight";

export const blitzNumberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export const formatBlitzValue = (value: number): string => blitzNumberFormatter.format(Math.max(0, Math.round(value)));

export const formatBlitzRankParts = (rank: number | null | undefined): { value: string; suffix: string } => {
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

export const BLITZ_CARD_FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=Montserrat:wght@400;700;800&display=swap');`;

/**
 * Base CSS for `.blitz-card-root` and its shared child elements.
 * Includes: root, background layers, overlays, border frame, corner mark,
 * title stack, CTA, player, powered-by, realms logo, stat label/value.
 */
export const BLITZ_CARD_BASE_STYLES = `
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

  .blitz-card-root.no-player .powered {
    left: 32px;
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
`;

/** Gold theme CSS custom properties for `.blitz-card-root.card-gold`. */
export const BLITZ_CARD_GOLD_THEME = `
  .blitz-card-root.card-gold {
    --overlay-gradient: linear-gradient(148.15deg, rgba(10, 10, 10, 0) 11.96%, #b38728 79.96%);
    --border-glow: rgba(191, 149, 63, 0.18);
    --border-stroke: rgba(255, 255, 255, 0.16);
    --points-color: #bf953f;
    --rank-gradient: linear-gradient(180deg, #fcf6ba 0%, #b38728 50%, #bf953f 100%);
    --suffix-gradient: var(--rank-gradient);
    --ghost-opacity: 0.05;
  }
`;

/** Silver theme CSS custom properties. */
export const BLITZ_CARD_SILVER_THEME = `
  .blitz-card-root.card-silver {
    --overlay-gradient: linear-gradient(148.15deg, rgba(10, 10, 10, 0) 11.96%, #434343 79.96%);
    --border-glow: rgba(172, 172, 172, 0.16);
    --border-stroke: rgba(255, 255, 255, 0.16);
    --points-color: #bdbdbd;
    --rank-gradient: linear-gradient(180deg, #f8f8f8 0%, #acacac 50%, #929292 100%);
    --suffix-gradient: var(--rank-gradient);
    --ghost-opacity: 0.08;
  }
`;

/** Bronze theme CSS custom properties. */
export const BLITZ_CARD_BRONZE_THEME = `
  .blitz-card-root.card-bronze {
    --overlay-gradient: linear-gradient(148.15deg, rgba(10, 10, 10, 0) 11.96%, #6e3a06 79.96%);
    --border-glow: rgba(146, 85, 24, 0.2);
    --border-stroke: rgba(255, 255, 255, 0.16);
    --points-color: #925518;
    --rank-gradient: linear-gradient(180deg, #925518 0%, #6e3a06 50%, #532c04 100%);
    --suffix-gradient: var(--rank-gradient);
    --ghost-opacity: 0.05;
  }
`;

/** Emerald theme CSS custom properties. */
export const BLITZ_CARD_EMERALD_THEME = `
  .blitz-card-root.card-emerald {
    --overlay-gradient: linear-gradient(148.15deg, rgba(10, 10, 10, 0) 11.96%, #4e8b87 79.96%);
    --border-glow: rgba(78, 139, 135, 0.2);
    --border-stroke: rgba(255, 255, 255, 0.16);
    --points-color: #4e7e8b;
    --rank-gradient: linear-gradient(180deg, #7bffe6 0%, #2c4063 50%, #112b26 100%);
    --suffix-gradient: var(--rank-gradient);
    --ghost-opacity: 0.05;
  }
`;

/** Neutral (purple) theme CSS custom properties. */
export const BLITZ_CARD_NEUTRAL_THEME = `
  .blitz-card-root.card-neutral {
    --overlay-gradient: linear-gradient(148.15deg, rgba(10, 10, 10, 0) 11.96%, #691c87 79.96%);
    --border-glow: rgba(105, 28, 135, 0.2);
    --border-stroke: rgba(255, 255, 255, 0.16);
    --points-color: #691c87;
    --rank-gradient: linear-gradient(180deg, #9442b8 0%, #46156d 50%, #230537 100%);
    --suffix-gradient: var(--rank-gradient);
    --ghost-opacity: 0.05;
  }
`;
