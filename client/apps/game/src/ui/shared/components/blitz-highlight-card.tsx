import { forwardRef, type Ref, useState } from "react";

// Using the eternum.svg logo from the game's public directory
const eternumLogoWhite = "/images/logos/eternum-new.svg";

import { currencyIntlFormat } from "@/ui/utils/utils";

import {
  BLITZ_CARD_DIMENSIONS,
  BLITZ_CARD_RADII,
  BLITZ_COVER_IMAGES,
  BlitzHighlightPlayer,
  formatOrdinal,
  getBlitzCoverImage,
  getSecondaryLabel,
  truncateText,
} from "../lib/blitz-highlight";

interface BlitzHighlightCardProps {
  title: string;
  subtitle: string;
  winnerLine?: string | null;
  highlight?: BlitzHighlightPlayer | null;
  coverOverride?: string;
}

export const BlitzHighlightCard = forwardRef<SVGSVGElement, BlitzHighlightCardProps>(
  ({ title, subtitle, winnerLine, highlight, coverOverride }, ref) => {
    const highlightOrdinal = highlight ? formatOrdinal(highlight.rank).toUpperCase() : "--";
    const highlightPointsValue = highlight ? `${currencyIntlFormat(highlight.points, 0)} pts` : "--";
    const highlightName = highlight ? truncateText(highlight.name, 30) : null;
    const highlightSecondary = highlight ? truncateText(getSecondaryLabel(highlight), 32) : null;
    const boostedChampion = winnerLine?.trim() ?? null;
    const championLabel = boostedChampion && boostedChampion.length > 0 ? boostedChampion : null;
    const coverImage = coverOverride ?? getBlitzCoverImage(highlight?.rank);
    const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
    const formatCountLabel = (value: number | null | undefined, singularLabel: string, pluralLabel: string): string => {
      if (value === null || value === undefined) {
        return "--";
      }

      const label = Math.abs(value) === 1 ? singularLabel : pluralLabel;
      const trimmedLabel = label.trim();
      if (!trimmedLabel.length) {
        return numberFormatter.format(value);
      }

      return `${numberFormatter.format(value)} ${trimmedLabel}`;
    };
    const formatPointsLabel = (value: number | null | undefined): string => {
      if (value === null || value === undefined) {
        return "--";
      }

      return `${currencyIntlFormat(value, 0)} pts`;
    };

    const statBreakdown = [
      {
        label: "Tiles Explored",
        count: highlight?.exploredTiles,
        singular: "",
        plural: "",
        points: highlight?.exploredTilePoints,
      },
      {
        label: "Crates Opened",
        count: highlight?.relicCratesOpened,
        singular: "",
        plural: "",
        points: highlight?.relicCratePoints,
      },
      {
        label: "Rifts Taken",
        count: highlight?.riftsTaken,
        singular: "",
        plural: "",
        points: highlight?.riftPoints,
      },
      {
        label: "Camps Taken",
        count: highlight?.campsTaken,
        singular: "",
        plural: "",
        points: highlight?.campPoints,
      },
      {
        label: "HS Taken",
        count: highlight?.hyperstructuresConquered,
        singular: "",
        plural: "",
        points: highlight?.hyperstructurePoints,
      },
      {
        label: "HS Held",
        count: highlight?.hyperstructuresHeld,
        singular: "",
        plural: "",
        points: highlight?.hyperstructuresHeldPoints,
      },
    ].map((stat) => {
      const countLabel = formatCountLabel(stat.count ?? null, stat.singular, stat.plural);
      const pointsLabel = formatPointsLabel(stat.points ?? null);
      const hasCount = countLabel !== "--";
      const hasPoints = pointsLabel !== "--";
      const combinedValue =
        hasCount && hasPoints
          ? `${countLabel} · ${pointsLabel}`
          : hasCount
            ? countLabel
            : hasPoints
              ? pointsLabel
              : "--";

      return {
        label: stat.label,
        countLabel,
        pointsLabel,
        combinedValue,
      };
    });
    const pointsPanel = {
      x: 350,
      y: 108,
      width: 264,
      height: 180,
      radius: 30,
    } as const;
    const statsRowStartY = pointsPanel.y + 96;

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
            x="30"
            y="50"
            width="50"
            height="50"
            preserveAspectRatio="xMidYMid meet"
            opacity="0.96"
          />

          <rect x="42" y="40" width="8" height="260" fill="url(#blitz-radial-glow)" opacity="0.66" />

          <rect
            x={pointsPanel.x}
            y={pointsPanel.y}
            width={pointsPanel.width}
            height={pointsPanel.height}
            rx={pointsPanel.radius}
            fill="rgba(6, 22, 30, 0.4)"
            stroke="rgba(120, 255, 242, 0.38)"
            strokeWidth="1.4"
          />
          <text
            x="95"
            y="54"
            fontSize="12"
            letterSpacing="0.32em"
            fontWeight="600"
            fill="rgba(202, 255, 255, 0.78)"
            style={{ textTransform: "uppercase" }}
          >
            {title}
          </text>
          <text
            x="95"
            y="80"
            fontSize="24"
            fontWeight="600"
            letterSpacing="0.18em"
            fill="#efffff"
            style={{ textTransform: "uppercase" }}
          >
            {subtitle}
          </text>
          {championLabel ? (
            <text x="95" y="100" fontSize="13" fill="rgba(198, 244, 255, 0.78)">
              {truncateText(`Champion · ${championLabel}`, 56)}
            </text>
          ) : null}

          <text x="30" y="215" fontSize="104" fontWeight="600" fill="#7bffe6">
            {highlightOrdinal}
          </text>
          <text
            x="38"
            y="241"
            fontSize="14"
            letterSpacing="0.28em"
            fill="rgba(190, 240, 255, 0.74)"
            style={{ textTransform: "uppercase" }}
          >
            Leaderboard Spot
          </text>

          <text
            x={pointsPanel.x + pointsPanel.width / 2}
            y={pointsPanel.y + 20}
            fontSize="11"
            letterSpacing="0.32em"
            fill="rgba(198, 248, 255, 0.78)"
            textAnchor="middle"
            style={{ textTransform: "uppercase" }}
          >
            Points Secured
          </text>
          <text
            x={pointsPanel.x + pointsPanel.width / 2}
            y={pointsPanel.y + 62}
            fontSize="48"
            fontWeight="600"
            fill="#7bffe6"
            textAnchor="middle"
          >
            {highlightPointsValue}
          </text>
          {statBreakdown.map((stat, index) => {
            const row = Math.floor(index / 2);
            const col = index % 2;
            const colWidth = pointsPanel.width / 2;
            const rowHeight = 28;
            const centerX = pointsPanel.x + col * colWidth + colWidth / 2;
            const baseY = statsRowStartY + row * rowHeight;
            const valueY = baseY + 14;

            return (
              <g key={stat.label}>
                <text
                  x={centerX}
                  y={baseY}
                  fontSize="8"
                  letterSpacing="0.2em"
                  fill="rgba(180, 236, 247, 0.7)"
                  textAnchor="middle"
                  style={{ textTransform: "uppercase" }}
                >
                  {stat.label}
                </text>
                <text x={centerX} y={valueY} fontSize="11" fontWeight="500" fill="#fdfefe" textAnchor="middle">
                  {stat.combinedValue}
                </text>
              </g>
            );
          })}

          {highlightName ? (
            <text x="38" y="280" fontSize="20" fontWeight="600" fill="#7bffe6">
              {highlightName}
            </text>
          ) : null}
          {highlightSecondary ? (
            <text x="38" y={highlightName ? 304 : 280} fontSize="14" fill="rgba(200, 242, 255, 0.78)">
              {highlightSecondary}
            </text>
          ) : null}

          <image
            href="/images/logos/starknet-logo.png"
            x="590"
            y="326"
            width="24"
            height="24"
            preserveAspectRatio="xMidYMid meet"
            opacity="0.9"
          />
          <text x="590" y="342" fontSize="12" fill="rgba(144, 224, 255, 0.72)" textAnchor="end" letterSpacing="0.1em">
            Powered by Starknet
          </text>
        </g>

        <rect width="640" height="360" rx="44" fill="none" stroke="rgba(115, 244, 255, 0.38)" strokeWidth="1.5" />
      </svg>
    );
  },
);

BlitzHighlightCard.displayName = "BlitzHighlightCard";

const formatCoverLabel = (index: number): string => (index === 0 ? "Default Cover" : `Cover ${index + 1}`);

interface CoverBannerProps {
  covers: readonly string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

const CoverBanner = ({ covers, selectedIndex, onSelect }: CoverBannerProps) => {
  return (
    <aside
      className="flex max-h-[360px] w-full max-w-full flex-col gap-3 rounded-[28px] border border-[#8ff8ff]/30 bg-[#04131f]/80 p-4 text-white/80 shadow-[inset_0_0_35px_rgba(123,255,230,0.12)] lg:max-w-[200px]"
      aria-label="Choose your cover"
    >
      <p className="text-center text-[11px] font-semibold uppercase tracking-[0.32em] text-[#7bffe6] lg:text-left">Choose your cover</p>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
        {covers.map((src, index) => {
          const label = formatCoverLabel(index);
          const isActive = index === selectedIndex;

          return (
            <button
              key={src}
              type="button"
              onClick={() => onSelect(index)}
              className={`group flex flex-col gap-2 rounded-2xl border px-3 py-2 text-left transition duration-200 focus:outline-none ${
                isActive
                  ? "border-[#7bffe6] bg-white/10 shadow-[0_0_20px_rgba(123,255,230,0.25)]"
                  : "border-white/10 bg-white/[0.04] hover:border-white/40 hover:bg-white/[0.08]"
              }`}
              aria-pressed={isActive}
              aria-label={`Select ${label}`}
            >
              <img src={src} alt={label} className="h-16 w-full rounded-xl object-cover" />
              <span className="text-center text-[0.72rem] font-medium tracking-[0.08em] text-white/75">{label}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
};

interface BlitzHighlightCardWithSelectorProps extends Omit<BlitzHighlightCardProps, "coverOverride"> {
  className?: string;
  cardRef?: Ref<SVGSVGElement>;
  initialCoverIndex?: number;
  onCoverChange?: (index: number, coverUrl: string) => void;
  coverImages?: readonly string[];
}

export const BlitzHighlightCardWithSelector = ({
  className,
  cardRef,
  initialCoverIndex = 0,
  onCoverChange,
  coverImages = BLITZ_COVER_IMAGES,
  ...cardProps
}: BlitzHighlightCardWithSelectorProps) => {
  const resolvedCovers = coverImages.length > 0 ? coverImages : BLITZ_COVER_IMAGES;
  const normalizedIndex = Math.min(Math.max(initialCoverIndex, 0), resolvedCovers.length - 1);
  const [coverIndex, setCoverIndex] = useState(() => normalizedIndex);
  const activeCover = resolvedCovers[coverIndex] ?? resolvedCovers[0];
  const containerClasses = [
    "flex w-full flex-col items-center gap-4 lg:flex-row lg:items-start",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const handleSelect = (index: number) => {
    setCoverIndex(index);
    const nextCover = resolvedCovers[index] ?? resolvedCovers[0];
    onCoverChange?.(index, nextCover);
  };

  return (
    <div className={containerClasses}>
      <div className="flex w-full justify-center">
        <BlitzHighlightCard {...cardProps} ref={cardRef} coverOverride={activeCover} />
      </div>
      <CoverBanner covers={resolvedCovers} selectedIndex={coverIndex} onSelect={handleSelect} />
    </div>
  );
};
