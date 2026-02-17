import { forwardRef, type Ref, useState } from "react";
import { createPortal } from "react-dom";

import type { LandingLeaderboardEntry } from "@/services/leaderboard/landing-leaderboard-service";
import { displayAddress } from "@/ui/utils/utils";
import { BLITZ_CARD_DIMENSIONS, truncateText } from "../lib/blitz-highlight";
import {
  BLITZ_CARD_FONT_IMPORT,
  BLITZ_CARD_BASE_STYLES,
  BLITZ_CARD_GOLD_THEME,
  formatBlitzValue as formatValue,
  formatBlitzRankParts as formatRankParts,
} from "../lib/blitz-card-shared";

const getDisplayName = (entry: LandingLeaderboardEntry): string => {
  const candidate = entry.displayName?.trim();
  return candidate || displayAddress(entry.address);
};

const LEADERBOARD_CARD_STYLES = `
  ${BLITZ_CARD_FONT_IMPORT}
  ${BLITZ_CARD_BASE_STYLES}
  ${BLITZ_CARD_GOLD_THEME}

  .blitz-card-root .podium {
    position: absolute;
    inset: 0;
    z-index: 4;
  }

  .blitz-card-root .podium-entry {
    position: absolute;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .blitz-card-root .podium-first {
    left: 290px;
    top: 75px;
    width: 380px;
    --podium-rank-gradient: linear-gradient(180deg, #fcf6ba 0%, #b38728 50%, #bf953f 100%);
  }

  .blitz-card-root .podium-second {
    left: 40px;
    top: 190px;
    width: 250px;
    --podium-rank-gradient: linear-gradient(180deg, #f8f8f8 0%, #acacac 50%, #929292 100%);
  }

  .blitz-card-root .podium-third {
    left: 680px;
    top: 190px;
    width: 250px;
    --podium-rank-gradient: linear-gradient(180deg, #925518 0%, #6e3a06 50%, #532c04 100%);
  }

  .blitz-card-root .podium-rank-row {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 4px;
  }

  .blitz-card-root .podium-rank-number {
    font-family: "Montserrat", sans-serif;
    font-weight: 800;
    line-height: 1;
    display: inline-block;
    background: var(--podium-rank-gradient);
    -webkit-text-fill-color: transparent;
    -webkit-background-clip: text;
    background-clip: text;
    text-fill-color: transparent;
  }

  .blitz-card-root .podium-rank-suffix {
    font-family: "Montserrat", sans-serif;
    font-weight: 800;
    line-height: 1;
    display: inline-block;
    background: var(--podium-rank-gradient);
    -webkit-text-fill-color: transparent;
    -webkit-background-clip: text;
    background-clip: text;
    text-fill-color: transparent;
  }

  .blitz-card-root .podium-first .podium-rank-number {
    font-size: 200px;
  }

  .blitz-card-root .podium-first .podium-rank-suffix {
    font-size: 80px;
  }

  .blitz-card-root .podium-second .podium-rank-number {
    font-size: 80px;
  }

  .blitz-card-root .podium-second .podium-rank-suffix {
    font-size: 32px;
  }

  .blitz-card-root .podium-third .podium-rank-number {
    font-size: 80px;
  }

  .blitz-card-root .podium-third .podium-rank-suffix {
    font-size: 32px;
  }

  .blitz-card-root .podium-name {
    font-family: "Montserrat", sans-serif;
    font-weight: 700;
    color: #ffffff;
    margin-top: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .blitz-card-root .podium-first .podium-name {
    font-size: 24px;
    line-height: 30px;
  }

  .blitz-card-root .podium-second .podium-name,
  .blitz-card-root .podium-third .podium-name {
    font-size: 16px;
    line-height: 22px;
  }

  .blitz-card-root .podium-address {
    font-family: "IM Fell English", serif;
    font-style: italic;
    color: #ffffff;
    opacity: 0.6;
    margin-top: 2px;
  }

  .blitz-card-root .podium-first .podium-address {
    font-size: 14px;
    line-height: 18px;
  }

  .blitz-card-root .podium-second .podium-address,
  .blitz-card-root .podium-third .podium-address {
    font-size: 12px;
    line-height: 16px;
  }

  .blitz-card-root .podium-points {
    font-family: "Montserrat", sans-serif;
    font-weight: 800;
    margin-top: 6px;
  }

  .blitz-card-root .podium-first .podium-points {
    font-size: 34px;
    line-height: 42px;
    color: var(--points-color);
  }

  .blitz-card-root .podium-second .podium-points {
    font-size: 20px;
    line-height: 26px;
    color: #bdbdbd;
  }

  .blitz-card-root .podium-third .podium-points {
    font-size: 20px;
    line-height: 26px;
    color: #925518;
  }

  .blitz-card-root .empty-leaderboard {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    font-family: "IM Fell English", serif;
    font-style: italic;
    font-size: 24px;
    color: #ffffff;
    opacity: 0.5;
    z-index: 4;
  }
`;

interface BlitzLeaderboardCardProps {
  worldName: string;
  topPlayers: LandingLeaderboardEntry[];
  player?: { name: string; address: string } | null;
}

const PodiumEntry = ({ entry, positionClass }: { entry: LandingLeaderboardEntry; positionClass: string }) => {
  const { value: rankValue, suffix: rankSuffix } = formatRankParts(entry.rank);
  const name = truncateText(getDisplayName(entry), 20);

  return (
    <div className={`podium-entry ${positionClass}`}>
      <div className="podium-rank-row">
        <span className="podium-rank-number">{rankValue}</span>
        {rankSuffix && <span className="podium-rank-suffix">{rankSuffix}</span>}
      </div>
      <div className="podium-name">{name}</div>
      <div className="podium-address">{displayAddress(entry.address)}</div>
      <div className="podium-points">{formatValue(entry.points)} pts</div>
    </div>
  );
};

const BlitzLeaderboardCard = forwardRef<SVGSVGElement, BlitzLeaderboardCardProps>(
  ({ worldName, topPlayers, player }, ref) => {
    const [portalTarget, setPortalTarget] = useState<SVGGElement | null>(null);

    const first = topPlayers.find((p) => p.rank === 1) ?? topPlayers[0] ?? null;
    const second = topPlayers.find((p) => p.rank === 2) ?? topPlayers[1] ?? null;
    const third = topPlayers.find((p) => p.rank === 3) ?? topPlayers[2] ?? null;

    const cardMarkup = (
      <foreignObject width="100%" height="100%">
        <div className="blitz-card-root card-gold" aria-label={`${worldName} Final Leaderboard card`}>
          <style dangerouslySetInnerHTML={{ __html: LEADERBOARD_CARD_STYLES }} />

          <div className="bg-mark" />
          <div className="bg-smoke" />
          <div className="bg-texture" />
          <div className="bg-layer gradient-overlay" />
          <div className="bg-layer dark-overlay" />

          <img className="corner-mark" src="/images/logos/Eternum-Mark-Black.png" alt="Eternum mark" />

          <div className="title-stack">
            <span className="eyebrow">{worldName}</span>
            <span className="title">Final Leaderboard</span>
          </div>

          <img className="realms-logo" src="/images/logos/realms-world-white.svg" alt="Realms World logo" />

          <div className="podium">
            {topPlayers.length === 0 ? (
              <div className="empty-leaderboard">Leaderboard data is not available yet.</div>
            ) : (
              <>
                {second && <PodiumEntry entry={second} positionClass="podium-second" />}
                {first && <PodiumEntry entry={first} positionClass="podium-first" />}
                {third && <PodiumEntry entry={third} positionClass="podium-third" />}
              </>
            )}
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
          aria-label={`${worldName} final leaderboard card`}
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

BlitzLeaderboardCard.displayName = "BlitzLeaderboardCard";

interface BlitzLeaderboardCardWithSelectorProps extends BlitzLeaderboardCardProps {
  className?: string;
  cardRef?: Ref<SVGSVGElement>;
}

export const BlitzLeaderboardCardWithSelector = ({
  className,
  cardRef,
  ...cardProps
}: BlitzLeaderboardCardWithSelectorProps) => {
  const containerClasses = ["flex w-full flex-col items-center gap-4", className].filter(Boolean).join(" ");

  return (
    <div className={containerClasses}>
      <div className="flex w-full justify-center">
        <BlitzLeaderboardCard {...cardProps} ref={cardRef} />
      </div>
    </div>
  );
};
