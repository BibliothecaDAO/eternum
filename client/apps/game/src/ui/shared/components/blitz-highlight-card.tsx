import { forwardRef } from "react";

import eternumLogoWhite from "../../../../../eternum-mobile/public/images/eternum-logo-white.svg";

import { currencyIntlFormat } from "@/ui/utils/utils";

import {
  BLITZ_CARD_DIMENSIONS,
  BLITZ_CARD_RADII,
  BlitzHighlightPlayer,
  getBlitzCoverImage,
  getSecondaryLabel,
  truncateText,
  formatOrdinal,
} from "../lib/blitz-highlight";

interface BlitzHighlightCardProps {
  title: string;
  subtitle: string;
  winnerLine?: string | null;
  highlight?: BlitzHighlightPlayer | null;
}

export const BlitzHighlightCard = forwardRef<SVGSVGElement, BlitzHighlightCardProps>(
  ({ title, subtitle, winnerLine, highlight }, ref) => {
    const highlightOrdinal = highlight ? formatOrdinal(highlight.rank).toUpperCase() : "--";
    const highlightPointsValue = highlight ? `${currencyIntlFormat(highlight.points, 0)} pts` : "--";
    const highlightName = highlight ? truncateText(highlight.name, 30) : null;
    const highlightSecondary = highlight ? truncateText(getSecondaryLabel(highlight), 32) : null;
    const coverImage = getBlitzCoverImage(highlight?.rank);

    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${BLITZ_CARD_DIMENSIONS.width} ${BLITZ_CARD_DIMENSIONS.height}`}
        width={BLITZ_CARD_DIMENSIONS.width}
        height={BLITZ_CARD_DIMENSIONS.height}
        className="h-auto w-full max-w-[720px]"
        role="img"
        aria-label={`${subtitle} highlight card`}
        style={{
          fontFamily: '"Space Grotesk", sans-serif',
          filter: "drop-shadow(0 32px 70px rgba(1, 11, 18, 0.64))",
        }}
      >
        <defs>
          <linearGradient id="blitz-cover-overlay" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(4, 17, 25, 0.82)" />
            <stop offset="52%" stopColor="rgba(4, 17, 25, 0.44)" />
            <stop offset="100%" stopColor="rgba(4, 17, 25, 0.24)" />
          </linearGradient>
          <radialGradient id="blitz-radial-glow" cx="0.22" cy="0.2" r="0.9">
            <stop offset="0%" stopColor="rgba(118, 255, 242, 0.45)" />
            <stop offset="100%" stopColor="rgba(118, 255, 242, 0)" />
          </radialGradient>
          <linearGradient id="blitz-rank-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f7fffe" />
            <stop offset="100%" stopColor="#b8fff2" />
          </linearGradient>
          <clipPath id="blitz-card-clip">
            <rect width="640" height="360" rx="44" />
          </clipPath>
        </defs>

        <g clipPath="url(#blitz-card-clip)">
          <rect width="640" height="360" fill="#04131f" />
          <image href={coverImage} x="0" y="0" width="640" height="360" preserveAspectRatio="xMidYMid slice" />
          <rect width="640" height="360" fill="url(#blitz-cover-overlay)" />
          <rect width="640" height="360" fill="url(#blitz-radial-glow)" opacity="0.68" />
          {BLITZ_CARD_RADII.map((radius, index) => (
            <circle
              key={radius}
              cx="320"
              cy="180"
              r={radius}
              fill="none"
              stroke="rgba(111, 250, 255, 0.18)"
              strokeWidth={index === 0 ? 1.6 : 1}
            />
          ))}

          <image
            href={eternumLogoWhite}
            x="40"
            y="64"
            width="60"
            height="60"
            preserveAspectRatio="xMidYMid meet"
            opacity="0.96"
          />

          <rect
            x="404"
            y="134"
            width="192"
            height="130"
            rx="26"
            fill="rgba(6, 22, 30, 0.58)"
            stroke="rgba(120, 255, 242, 0.34)"
            strokeWidth="1.4"
          />

          <text
            x="108"
            y="70"
            fontSize="12"
            letterSpacing="0.32em"
            fontWeight="600"
            fill="rgba(202, 255, 255, 0.78)"
            style={{ textTransform: "uppercase" }}
          >
            {title}
          </text>
          <text
            x="108"
            y="98"
            fontSize="24"
            fontWeight="600"
            letterSpacing="0.18em"
            fill="#efffff"
            style={{ textTransform: "uppercase" }}
          >
            {subtitle}
          </text>
          {winnerLine ? (
            <text x="108" y="122" fontSize="13" fill="rgba(198, 244, 255, 0.78)">
              {truncateText(`Champion · ${winnerLine}`, 56)}
            </text>
          ) : null}

          <text x="86" y="242" fontSize="104" fontWeight="600" fill="url(#blitz-rank-gradient)">
            {highlightOrdinal}
          </text>
          <text
            x="94"
            y="272"
            fontSize="14"
            letterSpacing="0.28em"
            fill="rgba(190, 240, 255, 0.74)"
            style={{ textTransform: "uppercase" }}
          >
            Leaderboard Spot
          </text>

          <text
            x="500"
            y="170"
            fontSize="13"
            letterSpacing="0.3em"
            fill="rgba(198, 248, 255, 0.78)"
            textAnchor="middle"
            style={{ textTransform: "uppercase" }}
          >
            Points Secured
          </text>
          <text x="500" y="214" fontSize="46" fontWeight="600" fill="#7bffe6" textAnchor="middle">
            {highlightPointsValue}
          </text>
          <text x="500" y="244" fontSize="14" fill="rgba(178, 234, 247, 0.78)" textAnchor="middle">
            Blitz Performance
          </text>

          {highlightName ? (
            <text x="94" y="308" fontSize="20" fontWeight="600" fill="#f1fffb">
              {highlightName}
            </text>
          ) : null}
          {highlightSecondary ? (
            <text x="94" y={highlightName ? 330 : 308} fontSize="14" fill="rgba(200, 242, 255, 0.78)">
              {highlightSecondary}
            </text>
          ) : null}

          <text
            x="585"
            y="312"
            fontSize="12"
            fill="rgba(160, 236, 255, 0.58)"
            textAnchor="end"
            letterSpacing="0.28em"
            style={{ textTransform: "uppercase" }}
          >
            Realms Blitz
          </text>
          <image
            href="/images/logos/starknet-logo.png"
            x="560"
            y="322"
            width="30"
            height="30"
            preserveAspectRatio="xMidYMid meet"
            opacity="0.9"
          />
          <text
            x="560"
            y="340"
            fontSize="12"
            fill="rgba(144, 224, 255, 0.72)"
            textAnchor="end"
            letterSpacing="0.1em"
          >
            Powered by Starknet
          </text>
        </g>

        <rect
          width="640"
          height="360"
          rx="44"
          fill="none"
          stroke="rgba(115, 244, 255, 0.38)"
          strokeWidth="1.5"
        />
      </svg>
    );
  },
);

BlitzHighlightCard.displayName = "BlitzHighlightCard";
