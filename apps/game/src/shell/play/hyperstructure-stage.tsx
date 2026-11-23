import "./hyperstructure-stage.css";

import {
  ASPECT_REWARD,
  aspectLordsWorth,
  aspectName,
  formatExact,
  formatShort,
  LORDS,
  type AspectId,
} from "@bibliothecadao/types";
import type { CSSProperties } from "react";

import { aspectVariables } from "@/tokens";
import { AspectMark } from "@/ui/design-system/aspect-mark";
import { Icon } from "@/ui/design-system/icon";
import { ASPECT_PAGE_WORDS, OF, SEASON_WORDS } from "@/ui/design-system/kit/words";

import { RACE_STAGE_COUNT, raceStageOf } from "../season";

const DRAWN_TIERS = 5;
if (RACE_STAGE_COUNT !== DRAWN_TIERS) {
  throw new Error(`HyperstructureArt draws ${DRAWN_TIERS} tiers, expected ${RACE_STAGE_COUNT}`);
}

const HyperstructureArt = ({
  aspect,
  height,
  finishHeight,
  compact = false,
}: {
  aspect: AspectId;
  height: number;
  finishHeight: number;
  compact?: boolean;
}) => {
  const stage = raceStageOf(height, finishHeight);
  const progress = finishHeight > 0 ? Math.max(0, Math.min(1, height / finishHeight)) : 0;
  return (
    <div
      className={compact ? "hyper-art hyper-art--compact" : "hyper-art"}
      style={aspectVariables(aspect) as CSSProperties}
      data-stage={stage}
      aria-hidden="true"
    >
      <svg viewBox="0 0 180 124" className="hyper-art__svg" focusable="false">
        <defs>
          <linearGradient id={`hex-top-${aspect}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="hyper-svg__hex-top-a" />
            <stop offset="100%" className="hyper-svg__hex-top-b" />
          </linearGradient>
          <linearGradient id={`hex-left-${aspect}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="hyper-svg__hex-left-a" />
            <stop offset="100%" className="hyper-svg__hex-left-b" />
          </linearGradient>
          <linearGradient id={`hex-right-${aspect}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="hyper-svg__hex-right-a" />
            <stop offset="100%" className="hyper-svg__hex-right-b" />
          </linearGradient>
          <linearGradient id={`stone-top-${aspect}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="hyper-svg__stone-top-a" />
            <stop offset="100%" className="hyper-svg__stone-top-b" />
          </linearGradient>
        </defs>
        <ellipse cx="90" cy="94" rx="68" ry="18" className="hyper-svg__shadow" />
        <polygon points="24,84 56,104 56,114 24,94" fill={`url(#hex-left-${aspect})`} />
        <polygon points="56,104 124,104 124,114 56,114" className="hyper-svg__hex-front" />
        <polygon points="124,104 156,84 156,94 124,114" fill={`url(#hex-right-${aspect})`} />
        <polygon
          points="56,64 124,64 156,84 124,104 56,104 24,84"
          fill={`url(#hex-top-${aspect})`}
          className="hyper-svg__hex-rim"
        />
        <polygon points="62,69 118,69 144,84 118,99 62,99 36,84" className="hyper-svg__hex-inner" />
        <polygon points="64,74 116,74 130,84 116,94 64,94 50,84" fill={`url(#stone-top-${aspect})`} />
        <polygon points="50,84 64,94 64,99 50,89" className="hyper-svg__stone-left" />
        <polygon points="64,94 116,94 116,99 64,99" className="hyper-svg__stone-front" />
        <polygon points="116,94 130,84 130,89 116,99" className="hyper-svg__stone-right" />
        <polygon points="72,78 108,78 117,84 108,90 72,90 63,84" className="hyper-svg__core-pad" />
        {stage >= 1 && (
          <g>
            <polygon points="68,62 112,62 118,78 62,78" className="hyper-svg__tier-1" />
            <polygon points="72,62 108,62 108,78 72,78" className="hyper-svg__glow-1" />
          </g>
        )}
        {stage >= 2 && (
          <g>
            <polygon points="73,47 107,47 111,62 69,62" className="hyper-svg__tier-2" />
            <rect x="85" y="51" width="10" height="9" rx="1.5" className="hyper-svg__glow-2" />
          </g>
        )}
        {stage >= 3 && (
          <g>
            <polygon points="78,33 102,33 105,47 75,47" className="hyper-svg__tier-3" />
            <rect x="86" y="37" width="8" height="8" rx="1" className="hyper-svg__glow-3" />
          </g>
        )}
        {stage >= 4 && (
          <g>
            <polygon points="82,20 98,20 100,33 80,33" className="hyper-svg__tier-4" />
            <polygon points="86,20 94,20 95,33 85,33" className="hyper-svg__glow-4" />
          </g>
        )}
        {stage >= RACE_STAGE_COUNT && (
          <g>
            <polygon points="90,6 97,20 83,20" className="hyper-svg__spire" />
            <circle cx="90" cy="12" r="5" className="hyper-svg__spire-halo" />
          </g>
        )}
        {progress > 0 && progress < 1 && (
          <line x1="90" y1="84" x2="90" y2={Math.max(14, 78 - progress * 60)} className="hyper-svg__beam" />
        )}
      </svg>
    </div>
  );
};

export const HyperstructureTile = ({
  aspect,
  height,
  finishHeight,
  members,
  own = false,
  winner = false,
  compact = false,
  showWorth = false,
}: {
  aspect: AspectId;
  height: number;
  finishHeight: number;
  members?: number | null;
  own?: boolean;
  winner?: boolean;
  compact?: boolean;
  showWorth?: boolean;
}) => {
  const stage = raceStageOf(height, finishHeight);
  const name = aspectName(aspect);
  const worth = aspectLordsWorth(height, winner);
  return (
    <article
      data-aspect-id={aspect}
      data-own={own || undefined}
      style={aspectVariables(aspect) as CSSProperties}
      className={compact ? "hyper-tile hyper-tile--compact" : "hyper-tile"}
      aria-label={ASPECT_PAGE_WORDS.height(height, finishHeight)}
    >
      <div className="hyper-tile__head">
        <span className="hyper-tile__title">
          <AspectMark aspect={aspect} size={compact ? 22 : 26} decorative />
          <span className="hyper-tile__name">{name}</span>
        </span>
        {showWorth && (
          <span className="hyper-tile__worth">
            <Icon name="lords" size={14} />
            {`${formatShort(worth)} ${LORDS}`}
          </span>
        )}
      </div>
      <HyperstructureArt aspect={aspect} height={height} finishHeight={finishHeight} compact={compact} />
      <div className="hyper-tile__pips" aria-hidden="true">
        {Array.from({ length: RACE_STAGE_COUNT }, (_, index) => (
          <span key={index} className="hyper-tile__pip" data-filled={index < stage || undefined} />
        ))}
      </div>
      <div className="hyper-tile__foot">
        <span className="hyper-tile__height">
          <b className="hyper-tile__count">{formatExact(height)}</b>
          <span className="hyper-tile__goal">{`${OF} ${formatExact(finishHeight)}`}</span>
        </span>
        {members !== undefined && members !== null && (
          <span className="hyper-tile__members">
            <Icon name="person" size={14} />
            {formatExact(members)}
          </span>
        )}
      </div>
    </article>
  );
};

export const RacePoolRuleStrip = () => (
  <p className="hyper-rule">
    <Icon name="lords" size={16} />
    <span>{SEASON_WORDS.poolRule(ASPECT_REWARD.lordsPerHeight, ASPECT_REWARD.finishBonus)}</span>
  </p>
);
