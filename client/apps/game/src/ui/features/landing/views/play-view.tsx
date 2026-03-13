import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { SignInPromptModal } from "@/ui/layouts/sign-in-prompt-modal";
import { latestFeatures, type FeatureType } from "@/ui/features/world/latest-features";
import { MarketsProviders } from "@/ui/features/market/markets-providers";
import { useAccount } from "@starknet-react/core";
import {
  BookOpen,
  Castle,
  ChevronRight,
  CloudLightning,
  ExternalLink,
  Factory,
  Play,
  Sparkles,
  Sun,
  Video,
  Newspaper,
  Wrench,
  TrendingUp,
  Bug,
  Zap,
  Clock,
  Trophy,
  RefreshCw,
} from "lucide-react";
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { UnifiedGameGrid, type GameData, type WorldSelection } from "../components/game-selector/game-card-grid";
import { GameEntryModal } from "../components/game-entry-modal";
import { GameReviewModal } from "../components/game-review-modal";
import { isGameReviewDismissed, setGameReviewDismissed } from "../lib/game-review-storage";
import { Coord, Direction } from "@bibliothecadao/types";

interface PlayViewProps {
  className?: string;
}

type PlayTab = "play" | "learn" | "news" | "factory";
type LandingModeFilter = "blitz" | "season";

const FactoryPage = lazy(() => import("../../admin").then((module) => ({ default: module.FactoryPage })));

// Video guide data - ordered from basic to advanced
const VIDEO_GUIDES = [
  {
    title: "Getting Started Tutorial",
    url: "https://x.com/lordcumberlord/status/1986947491640598776",
    author: "@lordcumberlord",
  },
  {
    title: "Resource Management Guide",
    url: "https://x.com/lordcumberlord/status/1990719396113707225",
    author: "@lordcumberlord",
  },
  {
    title: "Advanced Combat Tactics",
    url: "https://x.com/lordcumberlord/status/2011095751196360980",
    author: "@lordcumberlord",
  },
];

// Written guide data - ordered from basic to advanced
const WRITTEN_GUIDES = [
  {
    title: "Blitz Key Concepts",
    url: "https://docs.realms.world/blitz/key-concepts",
    source: "Official Docs",
  },
  {
    title: "How to Build Your Legacy",
    url: "https://legacygg.substack.com/p/how-to-build-your-legacy-in-realms",
    source: "Legacy GG",
  },
  {
    title: "Complete Guide (English)",
    url: "https://docs.google.com/document/d/e/2PACX-1vQch9CAmt9zXc7bwFuvdCOWz0x9IzLbZlgvOMX96xV7lWza1d3dLMHpaWaDa6eAo5rasaC4KtpPpGuP/pub",
    source: "nexonik & tsuaurym",
    lang: "EN",
  },
  {
    title: "Guia Completo (Portuguese)",
    url: "https://docs.google.com/document/d/e/2PACX-1vQlOxLQ5snLk23-2rsla4tPh8I5ijNaecYl1r_Dgk-9-An42Sos4HVl2EQGr0P1avW-W94qIwM4QrJn/pub",
    source: "nexonik & tsuaurym",
    lang: "PT",
  },
];

/**
 * Learn tab content - 2 columns, 2 rows
 * Row 1: Video Guides + Written Guides
 * Row 2: Practice Games (full width)
 */
const LearnContent = ({
  onSelectGame,
  onSpectate,
  onForgeHyperstructures,
  onSeeScore,
  onClaimRewards,
  onRegistrationComplete,
}: {
  onSelectGame: (selection: WorldSelection) => void;
  onSpectate: (selection: WorldSelection) => void;
  onForgeHyperstructures: (selection: WorldSelection, numHyperstructuresLeft: number) => Promise<void> | void;
  onSeeScore: (selection: WorldSelection) => void;
  onClaimRewards: (selection: WorldSelection) => void;
  onRegistrationComplete: () => void;
}) => (
  <div className="flex flex-col gap-4">
    {/* Row 1: Video Guides + Written Guides */}
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Video Guides */}
      <div className="flex flex-col rounded-2xl border border-gold/20 bg-black/60 p-5 backdrop-blur-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/20">
            <Video className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <h2 className="font-serif text-xl text-gold">Video Guides</h2>
            <p className="text-sm text-gold/60">Learn from the best</p>
          </div>
        </div>
        <div className="flex flex-col gap-3 flex-1">
          {VIDEO_GUIDES.map((video) => (
            <a
              key={video.url}
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 rounded-lg border border-gold/10 bg-black/40 p-4 transition-all hover:border-gold/30 hover:bg-black/50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10 transition-colors group-hover:bg-red-500/20 flex-shrink-0">
                <Play className="h-5 w-5 text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-gold group-hover:text-gold/80">{video.title}</h3>
                <p className="text-xs text-gold/50">{video.author}</p>
              </div>
              <ExternalLink className="h-4 w-4 text-gold/30 group-hover:text-gold/60 flex-shrink-0" />
            </a>
          ))}
        </div>
      </div>

      {/* Written Guides */}
      <div className="flex flex-col rounded-2xl border border-gold/20 bg-black/60 p-5 backdrop-blur-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/20">
            <BookOpen className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h2 className="font-serif text-xl text-gold">Written Guides</h2>
            <p className="text-sm text-gold/60">Documentation & tutorials</p>
          </div>
        </div>
        <div className="flex flex-col gap-3 flex-1">
          {WRITTEN_GUIDES.map((guide) => (
            <a
              key={guide.url}
              href={guide.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 rounded-lg border border-gold/10 bg-black/40 p-4 transition-all hover:border-gold/30 hover:bg-black/50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 transition-colors group-hover:bg-blue-500/20 flex-shrink-0">
                <BookOpen className="h-5 w-5 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-gold group-hover:text-gold/80">{guide.title}</h3>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-gold/50">{guide.source}</p>
                  {guide.lang && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gold/10 text-gold/70">{guide.lang}</span>
                  )}
                </div>
              </div>
              <ExternalLink className="h-4 w-4 text-gold/30 group-hover:text-gold/60 flex-shrink-0" />
            </a>
          ))}
        </div>
      </div>
    </div>

    {/* Row 2: Practice Games (full width) */}
    <div className="flex flex-col rounded-2xl border border-amber-500/30 bg-black/60 p-5 backdrop-blur-xl">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/20">
          <Wrench className="h-5 w-5 text-amber-400" />
        </div>
        <div>
          <h2 className="font-serif text-xl text-gold">Practice Games</h2>
          <p className="text-sm text-gold/60">Dev mode - join anytime!</p>
        </div>
      </div>
      <UnifiedGameGrid
        onSelectGame={onSelectGame}
        onSpectate={onSpectate}
        onForgeHyperstructures={onForgeHyperstructures}
        onSeeScore={onSeeScore}
        onClaimRewards={onClaimRewards}
        onRegistrationComplete={onRegistrationComplete}
        devModeFilter={true}
        hideHeader
      />
    </div>
  </div>
);

/**
 * Get icon and color for feature type
 */
const getFeatureTypeStyle = (type: FeatureType) => {
  switch (type) {
    case "feature":
      return { icon: Sparkles, color: "text-emerald-400", bg: "bg-emerald-500/20", label: "New Feature" };
    case "improvement":
      return { icon: TrendingUp, color: "text-blue-400", bg: "bg-blue-500/20", label: "Improvement" };
    case "balance":
      return { icon: Wrench, color: "text-amber-400", bg: "bg-amber-500/20", label: "Balance" };
    case "fix":
      return { icon: Bug, color: "text-red-400", bg: "bg-red-500/20", label: "Bug Fix" };
    default:
      return { icon: Sparkles, color: "text-gold", bg: "bg-gold/20", label: "Update" };
  }
};

/**
 * News tab content - Latest features and updates
 */
const NewsContent = () => (
  <div className="rounded-2xl border border-gold/20 bg-black/60 p-6 backdrop-blur-xl">
    <div className="flex items-center gap-3 mb-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/20">
        <Newspaper className="h-5 w-5 text-gold" />
      </div>
      <div>
        <h2 className="font-serif text-xl text-gold">Latest Updates</h2>
        <p className="text-sm text-gold/60">Recent features, improvements, and changes</p>
      </div>
    </div>

    <div className="space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto pr-2">
      {latestFeatures.map((feature, index) => {
        const style = getFeatureTypeStyle(feature.type);
        const Icon = style.icon;

        return (
          <div
            key={`${feature.date}-${index}`}
            className="group rounded-lg border border-gold/10 bg-black/40 p-4 transition-all hover:border-gold/20"
          >
            <div className="flex items-start gap-3">
              <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0", style.bg)}>
                <Icon className={cn("h-4 w-4", style.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="font-semibold text-gold">{feature.title}</h3>
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded", style.bg, style.color)}>{style.label}</span>
                </div>
                <p className="text-sm text-gold/70 leading-relaxed">{feature.description}</p>
                <p className="text-xs text-gold/40 mt-2">{feature.date}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

const FactoryTabContent = () => (
  <div className="rounded-2xl border border-gold/20 bg-black/60 p-4 backdrop-blur-xl">
    <div className="mb-4 flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/20">
        <Factory className="h-5 w-5 text-gold" />
      </div>
      <div>
        <h2 className="font-serif text-xl text-gold">Factory</h2>
        <p className="text-sm text-gold/60">Deploy and configure worlds from the main dashboard.</p>
      </div>
    </div>

    <Suspense
      fallback={
        <div className="rounded-xl border border-gold/20 bg-black/40 p-6 text-sm text-gold/70">Loading factory...</div>
      }
    >
      <FactoryPage embedded />
    </Suspense>
  </div>
);

const MODE_FILTER_OPTIONS: Array<{ id: LandingModeFilter; label: string }> = [
  { id: "season", label: "Eternum Seasons" },
  { id: "blitz", label: "Blitz" },
];

const MODE_VISUALS: Record<
  LandingModeFilter,
  {
    title: string;
    subtitle: string;
    chip: string;
    videoSrc: string;
    posterSrc: string;
    tone: string;
    icon: typeof Sun;
    panelBorder: string;
    panelGlow: string;
  }
> = {
  season: {
    title: "Eternum Seasons",
    subtitle: "Rolling fields, growing strongholds, and long-form conquest.",
    chip: "Campaign",
    videoSrc: "/videos/menu.mp4",
    posterSrc: "/images/covers/blitz/07.png",
    tone: "from-emerald-700/60 via-lime-500/20 to-amber-300/20",
    icon: Sun,
    panelBorder: "border-emerald-400/40",
    panelGlow: "shadow-[0_0_35px_rgba(52,211,153,0.25)]",
  },
  blitz: {
    title: "Blitz",
    subtitle: "Stormfront warfare, lightning pressure, and rapid outcomes.",
    chip: "Match",
    videoSrc: "/videos/01.mp4",
    posterSrc: "/images/covers/blitz/02.png",
    tone: "from-slate-900/75 via-blue-700/25 to-cyan-400/20",
    icon: CloudLightning,
    panelBorder: "border-cyan-300/40",
    panelGlow: "shadow-[0_0_35px_rgba(34,211,238,0.22)]",
  },
};

const SEASON_MOCK_CARDS = [
  {
    id: "season-live-mock",
    title: "Eternum S2: Dawnfields",
    status: "Live",
    statusClass: "text-emerald-300 border-emerald-400/35 bg-emerald-500/15",
    weekLabel: "Week 2 / 8",
    players: "1,248 players",
    features: ["Faith", "Ethereal Layer", "Holy Sites"],
    note: "Mockup preview while no season is currently active.",
  },
  {
    id: "season-upcoming-mock",
    title: "Eternum S2: Stormrise",
    status: "Upcoming",
    statusClass: "text-amber-200 border-amber-400/35 bg-amber-500/15",
    weekLabel: "Starts in 3d 14h",
    players: "Pre-registration opens soon",
    features: ["Bitcoin Mines", "Camp Discoveries", "Long Campaign Pace"],
    note: "Mockup card for coexistence layout validation.",
  },
] as const;

const MOCK_SEASON_PASSES = [
  { id: "pass-faith", realm: "Realm #0142", resource: "Faith" },
  { id: "pass-bitcoin", realm: "Realm #1188", resource: "Bitcoin Mines" },
  { id: "pass-ethereal", realm: "Realm #4021", resource: "Ethereal Layer" },
] as const;

const MOCK_VILLAGE_REVEAL_RESOURCES = [
  "Wheat",
  "Fish",
  "Stone",
  "Wood",
  "Iron",
  "Coal",
  "Faith",
  "Ancient Fragments",
] as const;

type SeasonMockFlowStep = "preflight" | "pass" | "placement" | "settled" | "village" | "reveal";
type SeasonMockSettleOutcome = "success" | "occupied" | "timing" | "pass-used";

interface SeasonMockPlacement {
  side: number;
  layer: number;
  point: number;
}

interface SeasonMockMapSlot {
  id: string;
  side: number;
  layer: number;
  point: number;
  x: number;
  y: number;
  pixelX: number;
  pixelY: number;
  occupied: boolean;
}

const DEFAULT_SEASON_MOCK_PLACEMENT: SeasonMockPlacement = {
  side: 0,
  layer: 1,
  point: 0,
};

const SEASON_MOCK_LAYER_MAX = 12;
const SEASON_MOCK_LAYERS_SKIPPED = 0;
const SEASON_MOCK_BASE_DISTANCE = 8;
const SEASON_MOCK_MAP_CENTER = 2147483646;
const SEASON_MOCK_MAP_CENTER_OFFSET = 0;
const SEASON_MOCK_HEX_RADIUS = 8;
const SEASON_MOCK_HEX_SQRT3 = Math.sqrt(3);
const SEASON_MOCK_OCCUPIED_SLOT_IDS = new Set(["1:2:0", "2:3:1", "4:4:1", "5:6:2"]);

const SEASON_MOCK_START_DIRECTIONS: ReadonlyArray<readonly [Direction, Direction]> = [
  [Direction.EAST, Direction.SOUTH_WEST],
  [Direction.SOUTH_EAST, Direction.WEST],
  [Direction.SOUTH_WEST, Direction.NORTH_WEST],
  [Direction.WEST, Direction.NORTH_EAST],
  [Direction.NORTH_WEST, Direction.EAST],
  [Direction.NORTH_EAST, Direction.SOUTH_EAST],
];

const validateSeasonMockPlacement = ({ side, layer, point }: SeasonMockPlacement): string[] => {
  const errors: string[] = [];

  if (!Number.isInteger(side) || side < 0 || side > 5) {
    errors.push("Side must be an integer between 0 and 5.");
  }

  if (!Number.isInteger(layer) || layer <= 0) {
    errors.push("Layer must be an integer greater than 0.");
  }

  if (layer > SEASON_MOCK_LAYER_MAX) {
    errors.push(`Layer must be less than or equal to ${SEASON_MOCK_LAYER_MAX}.`);
  }

  if (layer <= SEASON_MOCK_LAYERS_SKIPPED) {
    errors.push(`Layer must be greater than ${SEASON_MOCK_LAYERS_SKIPPED}.`);
  }

  if (!Number.isInteger(point) || point < 0) {
    errors.push("Point must be an integer greater than or equal to 0.");
  }

  if (Number.isInteger(layer) && Number.isInteger(point) && layer > 0 && point > layer - 1) {
    errors.push(`Point must be less than or equal to ${layer - 1} for layer ${layer}.`);
  }

  return errors;
};

const getSeasonMockPlacementPreview = ({ side, layer, point }: SeasonMockPlacement): { x: number; y: number } => {
  const [startDirection, triangleDirection] = SEASON_MOCK_START_DIRECTIONS[side] ?? SEASON_MOCK_START_DIRECTIONS[0];
  const center = SEASON_MOCK_MAP_CENTER - SEASON_MOCK_MAP_CENTER_OFFSET;
  const mapCenter = new Coord(center, center);

  const sideFirstLayerOne = mapCenter.travel(startDirection, SEASON_MOCK_BASE_DISTANCE);
  const sideFirstLayerTarget = sideFirstLayerOne.travel(startDirection, SEASON_MOCK_BASE_DISTANCE * (layer - 1));
  const destination = sideFirstLayerTarget.travel(triangleDirection, SEASON_MOCK_BASE_DISTANCE * point);

  return { x: destination.x, y: destination.y };
};

const mapSeasonMockSettleError = (outcome: SeasonMockSettleOutcome): string | null => {
  if (outcome === "occupied") {
    return "Destination occupied. Choose another side/layer/point.";
  }

  if (outcome === "timing") {
    return "Season timing invalid. Settlement is currently unavailable.";
  }

  if (outcome === "pass-used") {
    return "Season Pass already used or unavailable in this wallet.";
  }

  return null;
};

const toSeasonMockSlotId = (side: number, layer: number, point: number): string => `${side}:${layer}:${point}`;

const seasonMockOffsetToPixel = (col: number, row: number): { x: number; y: number } => {
  const hexHeight = SEASON_MOCK_HEX_RADIUS * 2;
  const hexWidth = SEASON_MOCK_HEX_SQRT3 * SEASON_MOCK_HEX_RADIUS;
  const verticalDistance = hexHeight * 0.75;
  const horizontalDistance = hexWidth;
  const rowOffset = ((row % 2) * Math.sign(row) * horizontalDistance) / 2;

  return {
    x: col * horizontalDistance - rowOffset,
    y: row * verticalDistance,
  };
};

const buildSeasonMockHexPoints = (centerX: number, centerY: number): string => {
  const points: string[] = [];
  for (let index = 0; index < 6; index += 1) {
    const angle = ((60 * index - 30) * Math.PI) / 180;
    const x = centerX + SEASON_MOCK_HEX_RADIUS * Math.cos(angle);
    const y = centerY + SEASON_MOCK_HEX_RADIUS * Math.sin(angle);
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return points.join(" ");
};

const buildSeasonMockSlots = (): SeasonMockMapSlot[] => {
  const center = SEASON_MOCK_MAP_CENTER - SEASON_MOCK_MAP_CENTER_OFFSET;
  const minLayer = Math.max(1, SEASON_MOCK_LAYERS_SKIPPED + 1);
  const slots: SeasonMockMapSlot[] = [];

  for (let layer = minLayer; layer <= SEASON_MOCK_LAYER_MAX; layer += 1) {
    for (let side = 0; side < 6; side += 1) {
      for (let point = 0; point <= layer - 1; point += 1) {
        const preview = getSeasonMockPlacementPreview({ side, layer, point });
        const col = preview.x - center;
        const row = preview.y - center;
        const pixel = seasonMockOffsetToPixel(col, row);
        const id = toSeasonMockSlotId(side, layer, point);

        slots.push({
          id,
          side,
          layer,
          point,
          x: preview.x,
          y: preview.y,
          pixelX: pixel.x,
          pixelY: pixel.y,
          occupied: SEASON_MOCK_OCCUPIED_SLOT_IDS.has(id),
        });
      }
    }
  }

  return slots;
};

interface SeasonMockMapBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

interface SeasonMockMapCamera {
  x: number;
  y: number;
  width: number;
  height: number;
}

const SEASON_MOCK_SETTLED_REALM_SLOT_IDS = new Set(["0:2:1", "3:4:2", "5:5:3"]);
const SEASON_MOCK_SPIRE_SLOT_IDS = new Set(["1:5:2", "4:7:3"]);
const SEASON_MOCK_HYPERSTRUCTURE_SLOT_IDS = new Set(["2:6:2", "5:8:4"]);

const getSeasonMockBounds = (slots: SeasonMockMapSlot[]): SeasonMockMapBounds => {
  if (slots.length === 0) {
    return {
      minX: -120,
      maxX: 120,
      minY: -120,
      maxY: 120,
      width: 240,
      height: 240,
    };
  }

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const slot of slots) {
    minX = Math.min(minX, slot.pixelX - SEASON_MOCK_HEX_RADIUS);
    maxX = Math.max(maxX, slot.pixelX + SEASON_MOCK_HEX_RADIUS);
    minY = Math.min(minY, slot.pixelY - SEASON_MOCK_HEX_RADIUS);
    maxY = Math.max(maxY, slot.pixelY + SEASON_MOCK_HEX_RADIUS);
  }

  const padding = 20;
  const boundedMinX = minX - padding;
  const boundedMaxX = maxX + padding;
  const boundedMinY = minY - padding;
  const boundedMaxY = maxY + padding;
  return {
    minX: boundedMinX,
    maxX: boundedMaxX,
    minY: boundedMinY,
    maxY: boundedMaxY,
    width: Math.max(1, boundedMaxX - boundedMinX),
    height: Math.max(1, boundedMaxY - boundedMinY),
  };
};

const getSeasonMockPanOverscan = (bounds: SeasonMockMapBounds): { x: number; y: number } => ({
  x: Math.max(70, bounds.width * 0.2),
  y: Math.max(70, bounds.height * 0.2),
});

const clampSeasonMockCamera = (camera: SeasonMockMapCamera, bounds: SeasonMockMapBounds): SeasonMockMapCamera => {
  const maxWidth = bounds.width;
  const maxHeight = bounds.height;
  const overscan = getSeasonMockPanOverscan(bounds);
  const minPanX = bounds.minX - overscan.x;
  const maxPanX = bounds.maxX + overscan.x;
  const minPanY = bounds.minY - overscan.y;
  const maxPanY = bounds.maxY + overscan.y;
  const minWidth = Math.max(90, maxWidth * 0.14);
  const minHeight = Math.max(90, maxHeight * 0.14);
  const width = Math.max(minWidth, Math.min(camera.width, maxWidth));
  const height = Math.max(minHeight, Math.min(camera.height, maxHeight));
  const x = Math.max(minPanX, Math.min(camera.x, maxPanX - width));
  const y = Math.max(minPanY, Math.min(camera.y, maxPanY - height));

  return { x, y, width, height };
};

const buildSeasonMockCamera = (
  bounds: SeasonMockMapBounds,
  selectedSlot: SeasonMockMapSlot | null,
): SeasonMockMapCamera => {
  if (!selectedSlot) {
    return {
      x: bounds.minX,
      y: bounds.minY,
      width: bounds.width,
      height: bounds.height,
    };
  }

  const focusWidth = Math.max(170, bounds.width * 0.78);
  const focusHeight = Math.max(170, bounds.height * 0.78);
  return clampSeasonMockCamera(
    {
      x: selectedSlot.pixelX - focusWidth / 2,
      y: selectedSlot.pixelY - focusHeight / 2,
      width: focusWidth,
      height: focusHeight,
    },
    bounds,
  );
};

const seasonMockCameraToViewBox = (camera: SeasonMockMapCamera): string =>
  `${camera.x} ${camera.y} ${camera.width} ${camera.height}`;

const buildSpireMarkerPoints = (x: number, y: number): string =>
  `${x.toFixed(2)},${(y - 5).toFixed(2)} ${(x + 4).toFixed(2)},${(y + 4).toFixed(2)} ${(x - 4).toFixed(2)},${(y + 4).toFixed(2)}`;

const buildHyperstructureMarkerPoints = (x: number, y: number): string =>
  `${x.toFixed(2)},${(y - 4.5).toFixed(2)} ${(x + 4.5).toFixed(2)},${y.toFixed(2)} ${x.toFixed(2)},${(y + 4.5).toFixed(2)} ${(x - 4.5).toFixed(2)},${y.toFixed(2)}`;

const getSeasonMockWorldPointFromClient = (
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } | null => {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const pointer = svg.createSVGPoint();
  pointer.x = clientX;
  pointer.y = clientY;
  const world = pointer.matrixTransform(ctm.inverse());
  return { x: world.x, y: world.y };
};

const findClosestSeasonMockSlot = (
  slots: SeasonMockMapSlot[],
  x: number,
  y: number,
  ignoreOccupied = true,
): SeasonMockMapSlot | null => {
  let closest: SeasonMockMapSlot | null = null;
  let closestDistanceSq = Number.POSITIVE_INFINITY;

  for (const slot of slots) {
    if (ignoreOccupied && slot.occupied) continue;
    const dx = slot.pixelX - x;
    const dy = slot.pixelY - y;
    const distanceSq = dx * dx + dy * dy;
    if (distanceSq < closestDistanceSq) {
      closestDistanceSq = distanceSq;
      closest = slot;
    }
  }

  return closest;
};

const ModeCoexistenceHero = ({
  modeFilter,
  onModeFilterChange,
}: {
  modeFilter: LandingModeFilter;
  onModeFilterChange: (mode: LandingModeFilter) => void;
}) => {
  const [hoveredMode, setHoveredMode] = useState<LandingModeFilter | null>(null);

  return (
    <div className="rounded-3xl border border-gold/20 bg-black/60 p-4 md:p-6 backdrop-blur-xl overflow-hidden">
      <div className="flex flex-col gap-2 mb-4">
        <div className="text-[10px] uppercase tracking-[0.26em] text-gold/60">realms.world</div>
        <h1 className="font-cinzel text-2xl md:text-3xl text-gold">Choose Your War</h1>
        <p className="text-sm text-gold/70">
          Campaign strategy or lightning matchmaking. Both live under one landing page.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {MODE_FILTER_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onModeFilterChange(option.id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs transition-all",
              modeFilter === option.id
                ? "border-gold/60 bg-gold/20 text-gold"
                : "border-gold/20 bg-black/30 text-gold/70 hover:border-gold/40 hover:text-gold",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {(Object.keys(MODE_VISUALS) as Array<LandingModeFilter>).map((mode) => {
          const config = MODE_VISUALS[mode];
          const Icon = config.icon;
          const isEmphasized = hoveredMode ? hoveredMode === mode : modeFilter === mode;

          return (
            <button
              key={mode}
              type="button"
              onMouseEnter={() => setHoveredMode(mode)}
              onMouseLeave={() => setHoveredMode(null)}
              onFocus={() => setHoveredMode(mode)}
              onBlur={() => setHoveredMode(null)}
              onClick={() => onModeFilterChange(mode)}
              className={cn(
                "group relative overflow-hidden rounded-2xl border text-left transition-all duration-300",
                "min-h-[220px] md:min-h-[260px]",
                config.panelBorder,
                config.panelGlow,
                isEmphasized ? "opacity-100 scale-[1.005]" : "opacity-75",
              )}
            >
              <img
                src={config.posterSrc}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full object-cover scale-105"
              />
              <video
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                poster={config.posterSrc}
                className={cn(
                  "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
                  hoveredMode === mode ? "opacity-100" : "opacity-75",
                )}
              >
                <source src={config.videoSrc} type="video/mp4" />
              </video>

              <div className={cn("absolute inset-0 bg-gradient-to-br", config.tone)} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

              <div className="relative z-10 h-full p-4 md:p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center rounded-full border border-white/30 bg-black/35 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-white/80">
                    {config.chip}
                  </span>
                  <Icon className="h-5 w-5 text-white/85" />
                </div>

                <div>
                  <h3 className="font-cinzel text-xl md:text-2xl text-white">{config.title}</h3>
                  <p className="text-sm text-white/80 mt-1">{config.subtitle}</p>
                  <div className="inline-flex items-center gap-1 mt-3 text-xs text-white/90">
                    {mode === "season" ? "Enter Campaigns" : "Enter Blitz"}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const SeasonMockupLane = () => {
  const [activeCardId, setActiveCardId] = useState<(typeof SEASON_MOCK_CARDS)[number]["id"] | null>(null);
  const [flowStep, setFlowStep] = useState<SeasonMockFlowStep>("preflight");
  const [seasonTimingValid, setSeasonTimingValid] = useState(true);
  const [spiresSettled, setSpiresSettled] = useState(true);
  const [seasonPassPresent, setSeasonPassPresent] = useState(true);
  const [selectedPassId, setSelectedPassId] = useState<(typeof MOCK_SEASON_PASSES)[number]["id"]>(
    MOCK_SEASON_PASSES[0].id,
  );
  const [placement, setPlacement] = useState<SeasonMockPlacement>(DEFAULT_SEASON_MOCK_PLACEMENT);
  const [mockSettleOutcome, setMockSettleOutcome] = useState<SeasonMockSettleOutcome>("success");
  const [mockSettleError, setMockSettleError] = useState<string | null>(null);
  const [isRevealRolling, setIsRevealRolling] = useState(false);
  const [rollingResource, setRollingResource] = useState<string>(MOCK_VILLAGE_REVEAL_RESOURCES[0]);
  const [targetRevealResource, setTargetRevealResource] = useState<string | null>(null);
  const [revealedVillageResource, setRevealedVillageResource] = useState<string | null>(null);

  const activeCard = useMemo(() => SEASON_MOCK_CARDS.find((card) => card.id === activeCardId) ?? null, [activeCardId]);

  const selectedPass = useMemo(
    () => MOCK_SEASON_PASSES.find((pass) => pass.id === selectedPassId) ?? MOCK_SEASON_PASSES[0],
    [selectedPassId],
  );

  const preflightReady = seasonTimingValid && spiresSettled && seasonPassPresent;
  const placementValidationErrors = useMemo(() => validateSeasonMockPlacement(placement), [placement]);
  const placementPreview = useMemo(
    () => (placementValidationErrors.length === 0 ? getSeasonMockPlacementPreview(placement) : null),
    [placement, placementValidationErrors],
  );
  const placementSlots = useMemo(() => buildSeasonMockSlots(), []);
  const selectedSlotId = toSeasonMockSlotId(placement.side, placement.layer, placement.point);
  const selectedPlacementSlot = useMemo(
    () => placementSlots.find((slot) => slot.id === selectedSlotId) ?? null,
    [placementSlots, selectedSlotId],
  );
  const mapBounds = useMemo(() => getSeasonMockBounds(placementSlots), [placementSlots]);
  const settledRealmSlots = useMemo(
    () => placementSlots.filter((slot) => SEASON_MOCK_SETTLED_REALM_SLOT_IDS.has(slot.id)),
    [placementSlots],
  );
  const spireSlots = useMemo(
    () => placementSlots.filter((slot) => SEASON_MOCK_SPIRE_SLOT_IDS.has(slot.id)),
    [placementSlots],
  );
  const hyperstructureSlots = useMemo(
    () => placementSlots.filter((slot) => SEASON_MOCK_HYPERSTRUCTURE_SLOT_IDS.has(slot.id)),
    [placementSlots],
  );
  const [mapCamera, setMapCamera] = useState<SeasonMockMapCamera | null>(null);
  const mapDragStateRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startCamera: SeasonMockMapCamera;
    hasMoved: boolean;
  } | null>(null);
  const mapViewBox = useMemo(
    () => seasonMockCameraToViewBox(mapCamera ?? buildSeasonMockCamera(mapBounds, selectedPlacementSlot)),
    [mapBounds, mapCamera, selectedPlacementSlot],
  );
  const occupiedSlotCount = useMemo(
    () => placementSlots.reduce((count, slot) => (slot.occupied ? count + 1 : count), 0),
    [placementSlots],
  );
  const placementErrors = useMemo(() => {
    if (!selectedPlacementSlot?.occupied) return placementValidationErrors;
    return [...placementValidationErrors, "Destination occupied. Choose another side/layer/point."];
  }, [placementValidationErrors, selectedPlacementSlot?.occupied]);
  const updatePlacement = useCallback((next: Partial<SeasonMockPlacement>) => {
    setPlacement((prev) => ({ ...prev, ...next }));
    setMockSettleError(null);
  }, []);
  const handleSlotSelect = useCallback(
    (slot: SeasonMockMapSlot) => {
      if (slot.occupied) return;
      updatePlacement({
        side: slot.side,
        layer: slot.layer,
        point: slot.point,
      });
    },
    [updatePlacement],
  );
  const updateMockSettleOutcome = useCallback((outcome: SeasonMockSettleOutcome) => {
    setMockSettleOutcome(outcome);
    setMockSettleError(null);
  }, []);
  const handleMapWheel = useCallback(
    (event: React.WheelEvent<SVGSVGElement>) => {
      if (!mapCamera) return;
      event.preventDefault();
      const worldPoint = getSeasonMockWorldPointFromClient(event.currentTarget, event.clientX, event.clientY);
      if (!worldPoint) return;
      const cursorRatioX = (worldPoint.x - mapCamera.x) / mapCamera.width;
      const cursorRatioY = (worldPoint.y - mapCamera.y) / mapCamera.height;
      const worldX = worldPoint.x;
      const worldY = worldPoint.y;
      const zoomFactor = event.deltaY > 0 ? 1.1 : 0.9;
      const nextWidth = mapCamera.width * zoomFactor;
      const nextHeight = mapCamera.height * zoomFactor;

      const nextCamera = clampSeasonMockCamera(
        {
          x: worldX - nextWidth * cursorRatioX,
          y: worldY - nextHeight * cursorRatioY,
          width: nextWidth,
          height: nextHeight,
        },
        mapBounds,
      );
      setMapCamera(nextCamera);
    },
    [mapBounds, mapCamera],
  );
  const handleMapPointerDown = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (!mapCamera) return;
      if (event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      mapDragStateRef.current = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startCamera: mapCamera,
        hasMoved: false,
      };
    },
    [mapCamera],
  );
  const handleMapPointerMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const drag = mapDragStateRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const pointerDeltaX = event.clientX - drag.startClientX;
      const pointerDeltaY = event.clientY - drag.startClientY;
      if (!drag.hasMoved && Math.abs(pointerDeltaX) < 4 && Math.abs(pointerDeltaY) < 4) {
        return;
      }
      drag.hasMoved = true;
      const panWidth = Math.max(drag.startCamera.width, mapBounds.width * 0.35);
      const panHeight = Math.max(drag.startCamera.height, mapBounds.height * 0.35);
      const deltaX = (pointerDeltaX / rect.width) * panWidth;
      const deltaY = (pointerDeltaY / rect.height) * panHeight;
      const nextCamera = clampSeasonMockCamera(
        {
          ...drag.startCamera,
          x: drag.startCamera.x - deltaX,
          y: drag.startCamera.y - deltaY,
        },
        mapBounds,
      );
      setMapCamera(nextCamera);
    },
    [mapBounds],
  );
  const handleMapPointerEnd = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const drag = mapDragStateRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;

      if (!drag.hasMoved) {
        const worldPoint = getSeasonMockWorldPointFromClient(event.currentTarget, event.clientX, event.clientY);
        if (worldPoint) {
          const nearestSlot = findClosestSeasonMockSlot(placementSlots, worldPoint.x, worldPoint.y, true);
          if (nearestSlot) {
            handleSlotSelect(nearestSlot);
          }
        }
      }

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      mapDragStateRef.current = null;
    },
    [handleSlotSelect, placementSlots],
  );
  const resetMapCamera = useCallback(() => {
    setMapCamera(buildSeasonMockCamera(mapBounds, selectedPlacementSlot));
  }, [mapBounds, selectedPlacementSlot]);

  const handleSettleMockSeasonPass = useCallback(() => {
    const preflightErrors: string[] = [];

    if (!seasonTimingValid) {
      preflightErrors.push("Season timing invalid. Settlement is currently unavailable.");
    }
    if (!spiresSettled) {
      preflightErrors.push("Spires must be settled before realm placement.");
    }
    if (!seasonPassPresent) {
      preflightErrors.push("Season Pass required before settlement.");
    }

    if (preflightErrors.length > 0) {
      setMockSettleError(preflightErrors[0]);
      return;
    }

    if (placementErrors.length > 0) {
      setMockSettleError(placementErrors[0]);
      return;
    }

    const outcomeError = mapSeasonMockSettleError(mockSettleOutcome);
    if (outcomeError) {
      setMockSettleError(outcomeError);
      return;
    }

    setMockSettleError(null);
    setFlowStep("settled");
  }, [mockSettleOutcome, placementErrors, seasonPassPresent, seasonTimingValid, spiresSettled]);

  useEffect(() => {
    if (!isRevealRolling || !targetRevealResource) return;

    const interval = setInterval(() => {
      const random = MOCK_VILLAGE_REVEAL_RESOURCES[Math.floor(Math.random() * MOCK_VILLAGE_REVEAL_RESOURCES.length)];
      setRollingResource(random);
    }, 90);

    const timeout = setTimeout(() => {
      setRollingResource(targetRevealResource);
      setRevealedVillageResource(targetRevealResource);
      setIsRevealRolling(false);
    }, 1800);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [isRevealRolling, targetRevealResource]);

  const startMockFlow = (cardId: (typeof SEASON_MOCK_CARDS)[number]["id"]) => {
    const card = SEASON_MOCK_CARDS.find((entry) => entry.id === cardId);
    setActiveCardId(cardId);
    setFlowStep("preflight");
    setSeasonTimingValid(card?.status === "Live");
    setSpiresSettled(true);
    setSeasonPassPresent(true);
    setSelectedPassId(MOCK_SEASON_PASSES[0].id);
    setPlacement(DEFAULT_SEASON_MOCK_PLACEMENT);
    setMapCamera(null);
    mapDragStateRef.current = null;
    setMockSettleOutcome("success");
    setMockSettleError(null);
    setIsRevealRolling(false);
    setRollingResource(MOCK_VILLAGE_REVEAL_RESOURCES[0]);
    setTargetRevealResource(null);
    setRevealedVillageResource(null);
  };

  const closeMockFlow = () => {
    setActiveCardId(null);
    setFlowStep("preflight");
    setMapCamera(null);
    mapDragStateRef.current = null;
    setMockSettleError(null);
    setIsRevealRolling(false);
  };

  const triggerVillageReveal = () => {
    const selected = MOCK_VILLAGE_REVEAL_RESOURCES[Math.floor(Math.random() * MOCK_VILLAGE_REVEAL_RESOURCES.length)];
    setTargetRevealResource(selected);
    setRevealedVillageResource(null);
    setFlowStep("reveal");
    setIsRevealRolling(true);
  };

  return (
    <>
      <div className="rounded-2xl border border-emerald-400/30 bg-black/45 p-4 backdrop-blur-sm">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-emerald-200/80">
              <Castle className="h-3.5 w-3.5" />
              Eternum Seasons Mockup
            </div>
            <h2 className="font-cinzel text-lg text-emerald-100 mt-1">How Seasons Coexist on Landing</h2>
          </div>
          <span className="rounded-full border border-emerald-300/35 bg-emerald-500/15 px-2 py-1 text-[10px] text-emerald-200">
            Mock Flow Enabled
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {SEASON_MOCK_CARDS.map((card) => (
            <article key={card.id} className="rounded-xl border border-emerald-200/20 bg-black/55 p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-cinzel text-base text-gold">{card.title}</h3>
                <span className={cn("rounded-full border px-2 py-0.5 text-[10px]", card.statusClass)}>
                  {card.status}
                </span>
              </div>

              <p className="text-sm text-gold/80 mt-1">{card.weekLabel}</p>
              <p className="text-xs text-gold/60 mt-1">{card.players}</p>

              <div className="flex flex-wrap gap-1.5 mt-3">
                {card.features.map((feature) => (
                  <span
                    key={feature}
                    className="rounded border border-emerald-300/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-100/90"
                  >
                    {feature}
                  </span>
                ))}
              </div>

              <p className="text-[11px] text-gold/50 mt-3">{card.note}</p>

              <button
                type="button"
                onClick={() => startMockFlow(card.id)}
                className="mt-3 inline-flex items-center gap-1 rounded-md border border-emerald-300/50 bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/30 transition-colors"
              >
                Try Mockup Flow
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </article>
          ))}
        </div>
      </div>

      {activeCard && (
        <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm p-4 flex items-center justify-center">
          <div
            className={cn(
              "w-full rounded-2xl border border-emerald-300/35 bg-[#04090f]/95 shadow-[0_0_45px_rgba(16,185,129,0.2)] p-4 md:p-6",
              flowStep === "placement" ? "max-w-5xl" : "max-w-2xl",
            )}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-200/80">Eternum S2 Mockup Flow</div>
                <h3 className="font-cinzel text-xl text-emerald-100 mt-1">{activeCard.title}</h3>
              </div>
              <button
                type="button"
                onClick={closeMockFlow}
                className="rounded-md border border-white/20 bg-white/5 px-2 py-1 text-xs text-white/70 hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <div className="mb-4 text-[11px] text-emerald-100/75">
              Step:{" "}
              <span className="font-semibold">
                {flowStep === "preflight"
                  ? "Preflight"
                  : flowStep === "pass"
                    ? "Season Pass"
                    : flowStep === "placement"
                      ? "Placement"
                      : flowStep === "settled"
                        ? "Settled"
                        : flowStep === "village"
                          ? "Buy Village"
                          : "Reveal"}
              </span>
            </div>

            {flowStep === "preflight" && (
              <div className="space-y-3">
                <p className="text-sm text-emerald-50">Mock preflight checks before settlement tx:</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSeasonTimingValid((prev) => !prev)}
                    className={cn(
                      "rounded border px-3 py-2 text-xs text-left",
                      seasonTimingValid
                        ? "border-emerald-400/45 bg-emerald-500/15 text-emerald-100"
                        : "border-red-400/40 bg-red-500/10 text-red-200",
                    )}
                  >
                    Season timing
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpiresSettled((prev) => !prev)}
                    className={cn(
                      "rounded border px-3 py-2 text-xs text-left",
                      spiresSettled
                        ? "border-emerald-400/45 bg-emerald-500/15 text-emerald-100"
                        : "border-red-400/40 bg-red-500/10 text-red-200",
                    )}
                  >
                    Spires settled
                  </button>
                  <button
                    type="button"
                    onClick={() => setSeasonPassPresent((prev) => !prev)}
                    className={cn(
                      "rounded border px-3 py-2 text-xs text-left",
                      seasonPassPresent
                        ? "border-emerald-400/45 bg-emerald-500/15 text-emerald-100"
                        : "border-red-400/40 bg-red-500/10 text-red-200",
                    )}
                  >
                    Season pass present
                  </button>
                </div>
                <p className="text-xs text-gold/70">
                  {preflightReady
                    ? "All checks are passing. Continue to season pass selection."
                    : "At least one check is failing. Toggle checks to proceed."}
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setFlowStep("pass")}
                    disabled={!preflightReady}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-semibold",
                      preflightReady
                        ? "bg-emerald-500 text-black hover:bg-emerald-400"
                        : "bg-white/10 text-white/40 cursor-not-allowed",
                    )}
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {flowStep === "pass" && (
              <div className="space-y-3">
                <p className="text-sm text-emerald-50">Select which season pass to use for settlement:</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {MOCK_SEASON_PASSES.map((pass) => (
                    <button
                      key={pass.id}
                      type="button"
                      onClick={() => setSelectedPassId(pass.id)}
                      className={cn(
                        "rounded border px-3 py-2 text-left",
                        selectedPassId === pass.id
                          ? "border-gold/50 bg-gold/10 text-gold"
                          : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10",
                      )}
                    >
                      <div className="text-xs font-semibold">{pass.realm}</div>
                      <div className="text-[11px] opacity-80">{pass.resource}</div>
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setFlowStep("preflight")}
                    className="rounded-md border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMockSettleError(null);
                      setMapCamera(buildSeasonMockCamera(mapBounds, selectedPlacementSlot));
                      setFlowStep("placement");
                    }}
                    className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-emerald-400"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {flowStep === "placement" && (
              <div className="space-y-3">
                <p className="text-sm text-emerald-50">
                  Choose placement coordinates for this pass (contract format: side/layer/point):
                </p>
                <p className="text-xs text-emerald-100/75">
                  Side: 0-5, Layer: {SEASON_MOCK_LAYERS_SKIPPED + 1}-{SEASON_MOCK_LAYER_MAX}, Point: 0-(layer-1)
                </p>

                <div className="space-y-2">
                  <p className="text-xs text-emerald-100/85">
                    Map slot picker (click a hex to populate side/layer/point)
                  </p>
                  <p className="text-[11px] text-emerald-100/65">
                    Scroll to zoom. Drag to pan. Click reset to reframe.
                  </p>
                  <div className="relative h-60 overflow-hidden rounded-lg border border-emerald-300/25 bg-black/40">
                    <div
                      className="absolute inset-0 bg-[url('/images/covers/blitz/07.png')] bg-cover bg-center opacity-20"
                      aria-hidden
                    />
                    <div
                      className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/45 to-black/70"
                      aria-hidden
                    />
                    <svg
                      viewBox={mapViewBox}
                      className="relative z-10 h-full w-full touch-none"
                      aria-label="Season mock placement map"
                      onWheel={handleMapWheel}
                      onPointerDown={handleMapPointerDown}
                      onPointerMove={handleMapPointerMove}
                      onPointerUp={handleMapPointerEnd}
                      onPointerLeave={handleMapPointerEnd}
                    >
                      {placementSlots.map((slot) => {
                        const isSelected = slot.id === selectedSlotId;
                        const isSelectable = !slot.occupied;
                        return (
                          <g key={slot.id}>
                            <polygon
                              points={buildSeasonMockHexPoints(slot.pixelX, slot.pixelY)}
                              fill={isSelected ? "#f4d25a" : slot.occupied ? "#4b5563" : "#34d399"}
                              fillOpacity={isSelected ? 0.88 : slot.occupied ? 0.35 : 0.28}
                              stroke={isSelected ? "#fef3c7" : slot.occupied ? "#9ca3af" : "#86efac"}
                              strokeWidth={isSelected ? 1.1 : 0.85}
                              strokeOpacity={isSelected ? 1 : slot.occupied ? 0.42 : 0.72}
                              pointerEvents="none"
                            />
                            <circle
                              data-slot-id={slot.id}
                              cx={slot.pixelX}
                              cy={slot.pixelY}
                              r={13}
                              fill="rgba(255,255,255,0.001)"
                              pointerEvents="all"
                              className={cn(isSelectable && "cursor-pointer")}
                            />
                          </g>
                        );
                      })}

                      {settledRealmSlots.map((slot) => (
                        <circle
                          key={`settled-${slot.id}`}
                          cx={slot.pixelX}
                          cy={slot.pixelY}
                          r={3.1}
                          fill="#f5deb3"
                          stroke="#fef3c7"
                          strokeWidth={0.75}
                          opacity={0.95}
                          pointerEvents="none"
                        />
                      ))}

                      {spireSlots.map((slot) => (
                        <polygon
                          key={`spire-${slot.id}`}
                          points={buildSpireMarkerPoints(slot.pixelX, slot.pixelY)}
                          fill="#67e8f9"
                          stroke="#ecfeff"
                          strokeWidth={0.65}
                          opacity={0.95}
                          pointerEvents="none"
                        />
                      ))}

                      {hyperstructureSlots.map((slot) => (
                        <polygon
                          key={`hyper-${slot.id}`}
                          points={buildHyperstructureMarkerPoints(slot.pixelX, slot.pixelY)}
                          fill="#c4b5fd"
                          stroke="#ede9fe"
                          strokeWidth={0.65}
                          opacity={0.95}
                          pointerEvents="none"
                        />
                      ))}
                    </svg>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-emerald-100/75">
                    <span>Valid slots: {placementSlots.length}</span>
                    <span>Occupied: {occupiedSlotCount}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[10px] text-emerald-100/70">
                    <span className="inline-flex items-center gap-1 rounded border border-white/15 bg-white/5 px-2 py-1">
                      <span className="h-2 w-2 rounded-full bg-[#f5deb3]" />
                      Settled realms
                    </span>
                    <span className="inline-flex items-center gap-1 rounded border border-white/15 bg-white/5 px-2 py-1">
                      <span className="h-2 w-2 rotate-45 bg-[#67e8f9]" />
                      Spires
                    </span>
                    <span className="inline-flex items-center gap-1 rounded border border-white/15 bg-white/5 px-2 py-1">
                      <span className="h-2 w-2 rounded-sm bg-[#c4b5fd]" />
                      Hyperstructures
                    </span>
                    <button
                      type="button"
                      onClick={resetMapCamera}
                      className="rounded border border-white/20 bg-white/5 px-2 py-1 text-[10px] text-white/75 hover:bg-white/10"
                    >
                      Reset View
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <label className="text-xs text-emerald-100/80">
                    Side
                    <input
                      type="number"
                      min={0}
                      max={5}
                      step={1}
                      value={placement.side}
                      onChange={(event) =>
                        updatePlacement({ side: Number.parseInt(event.target.value || "0", 10) || 0 })
                      }
                      className="mt-1 w-full rounded border border-white/20 bg-black/40 px-2 py-1 text-sm text-white"
                    />
                  </label>
                  <label className="text-xs text-emerald-100/80">
                    Layer
                    <input
                      type="number"
                      min={SEASON_MOCK_LAYERS_SKIPPED + 1}
                      max={SEASON_MOCK_LAYER_MAX}
                      step={1}
                      value={placement.layer}
                      onChange={(event) =>
                        updatePlacement({ layer: Number.parseInt(event.target.value || "0", 10) || 0 })
                      }
                      className="mt-1 w-full rounded border border-white/20 bg-black/40 px-2 py-1 text-sm text-white"
                    />
                  </label>
                  <label className="text-xs text-emerald-100/80">
                    Point
                    <input
                      type="number"
                      min={0}
                      max={Math.max(0, placement.layer - 1)}
                      step={1}
                      value={placement.point}
                      onChange={(event) =>
                        updatePlacement({ point: Number.parseInt(event.target.value || "0", 10) || 0 })
                      }
                      className="mt-1 w-full rounded border border-white/20 bg-black/40 px-2 py-1 text-sm text-white"
                    />
                  </label>
                </div>

                {placementPreview && (
                  <div className="rounded border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                    Target coordinate preview: x {placementPreview.x}, y {placementPreview.y}
                  </div>
                )}

                {selectedPlacementSlot && (
                  <div className="rounded border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                    Selected hex: side {selectedPlacementSlot.side}, layer {selectedPlacementSlot.layer}, point{" "}
                    {selectedPlacementSlot.point} · x {selectedPlacementSlot.x}, y {selectedPlacementSlot.y}
                  </div>
                )}

                {placementErrors.length > 0 && (
                  <div className="rounded border border-red-400/35 bg-red-500/10 px-3 py-2 text-xs text-red-100 space-y-1">
                    {placementErrors.map((error) => (
                      <p key={error}>{error}</p>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-xs text-emerald-100/80">Mock tx outcome</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {(
                      [
                        { id: "success", label: "Success" },
                        { id: "occupied", label: "Occupied" },
                        { id: "timing", label: "Timing" },
                        { id: "pass-used", label: "Pass Used" },
                      ] as const
                    ).map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => updateMockSettleOutcome(option.id)}
                        className={cn(
                          "rounded border px-3 py-1.5 text-xs",
                          mockSettleOutcome === option.id
                            ? "border-gold/55 bg-gold/20 text-gold"
                            : "border-white/20 bg-white/5 text-white/70 hover:bg-white/10",
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {mockSettleError && (
                  <div className="rounded border border-red-400/35 bg-red-500/10 px-3 py-2 text-xs text-red-100">
                    {mockSettleError}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setFlowStep("pass")}
                    className="rounded-md border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleSettleMockSeasonPass}
                    disabled={placementErrors.length > 0}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-semibold",
                      placementErrors.length === 0
                        ? "bg-emerald-500 text-black hover:bg-emerald-400"
                        : "bg-white/10 text-white/40 cursor-not-allowed",
                    )}
                  >
                    Settle Realm
                  </button>
                </div>
              </div>
            )}

            {flowStep === "settled" && (
              <div className="space-y-3">
                <p className="text-sm text-emerald-50">
                  Settlement complete for <span className="text-gold">{selectedPass.realm}</span> on{" "}
                  <span className="text-gold">{selectedPass.resource}</span>.
                </p>
                <p className="text-xs text-emerald-100/80">
                  Position: side {placement.side}, layer {placement.layer}, point {placement.point}
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setFlowStep("village")}
                    className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-amber-400"
                  >
                    Buy Village
                  </button>
                  <button
                    type="button"
                    onClick={closeMockFlow}
                    className="rounded-md border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10"
                  >
                    Finish
                  </button>
                </div>
              </div>
            )}

            {flowStep === "village" && (
              <div className="space-y-3">
                <p className="text-sm text-emerald-50">Village purchased next to your settled realm.</p>
                <p className="text-xs text-emerald-100/80">
                  Reveal the village resource with a mock casino-style roll.
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={triggerVillageReveal}
                    className="rounded-md bg-gold px-3 py-1.5 text-xs font-semibold text-black hover:bg-gold/90"
                  >
                    Reveal Resource
                  </button>
                </div>
              </div>
            )}

            {flowStep === "reveal" && (
              <div className="space-y-3">
                <p className="text-sm text-emerald-50">Village resource reveal:</p>
                <div
                  className={cn(
                    "rounded-lg border px-4 py-6 text-center text-xl font-cinzel",
                    isRevealRolling
                      ? "border-gold/50 bg-gold/10 text-gold animate-pulse"
                      : "border-emerald-400/45 bg-emerald-500/15 text-emerald-100",
                  )}
                >
                  {isRevealRolling ? rollingResource : (revealedVillageResource ?? "Unknown")}
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setFlowStep("village")}
                    className="rounded-md border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10"
                  >
                    Buy Another Village
                  </button>
                  <button
                    type="button"
                    onClick={() => setFlowStep("preflight")}
                    className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-emerald-400"
                  >
                    Restart Flow
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

/**
 * Play tab content with centered hero + 3 columns layout:
 * - Hero centered at top with CTA
 * - Three columns below: Live | Upcoming | Ended
 * - Vertical scroll within each column
 */
const PlayTabContent = ({
  onSelectGame,
  onSpectate,
  onSeeScore,
  onClaimRewards,
  onForgeHyperstructures,
  onRegistrationComplete,
  onRefresh,
  isRefreshing = false,
  disabled = false,
  onEndedGamesResolved,
}: {
  onSelectGame: (selection: WorldSelection) => void;
  onSpectate: (selection: WorldSelection) => void;
  onSeeScore: (selection: WorldSelection) => void;
  onClaimRewards: (selection: WorldSelection) => void;
  onForgeHyperstructures: (selection: WorldSelection, numHyperstructuresLeft: number) => Promise<void> | void;
  onRegistrationComplete: () => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
  disabled?: boolean;
  onEndedGamesResolved?: (games: GameData[]) => void;
}) => {
  const [modeFilter, setModeFilter] = useState<LandingModeFilter>("blitz");

  return (
    <div className={cn("flex flex-col gap-4", disabled && "opacity-50 pointer-events-none")}>
      <ModeCoexistenceHero modeFilter={modeFilter} onModeFilterChange={setModeFilter} />

      {modeFilter === "season" && <SeasonMockupLane />}

      {modeFilter === "blitz" && (
        <div className="flex flex-col gap-2">
          <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-200/80">Blitz Live Data</div>

          {/* Three columns: Live | Upcoming | Ended */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 flex-1 min-h-0">
            {/* Live Games Column */}
            <div className="flex flex-col rounded-2xl border border-emerald-500/30 bg-black/40 p-3 backdrop-blur-sm min-h-0 max-h-[500px]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/20">
                    <Zap className="h-3.5 w-3.5 text-emerald-400" />
                  </div>
                  <h2 className="font-cinzel text-base text-emerald-400 uppercase tracking-wider">Live Games</h2>
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                </div>
                <button
                  onClick={onRefresh}
                  disabled={isRefreshing}
                  className="p-1 rounded-md bg-emerald-500/10 text-emerald-400/70 hover:bg-emerald-500/20 hover:text-emerald-400 transition-all disabled:opacity-50"
                  title="Refresh"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-emerald-500/20 scrollbar-track-transparent">
                <UnifiedGameGrid
                  onSelectGame={onSelectGame}
                  onSpectate={onSpectate}
                  onForgeHyperstructures={onForgeHyperstructures}
                  onRegistrationComplete={onRegistrationComplete}
                  statusFilter="ongoing"
                  hideHeader
                  hideLegend
                  layout="vertical"
                  sortRegisteredFirst
                />
              </div>
            </div>

            {/* Upcoming Games Column */}
            <div className="flex flex-col rounded-2xl border border-amber-500/30 bg-black/40 p-3 backdrop-blur-sm min-h-0 max-h-[500px]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/20">
                    <Clock className="h-3.5 w-3.5 text-amber-400" />
                  </div>
                  <h2 className="font-cinzel text-base text-amber-400 uppercase tracking-wider">Upcoming Games</h2>
                </div>
                <button
                  onClick={onRefresh}
                  disabled={isRefreshing}
                  className="p-1 rounded-md bg-amber-500/10 text-amber-400/70 hover:bg-amber-500/20 hover:text-amber-400 transition-all disabled:opacity-50"
                  title="Refresh"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-amber-500/20 scrollbar-track-transparent">
                <UnifiedGameGrid
                  onSelectGame={onSelectGame}
                  onSpectate={onSpectate}
                  onForgeHyperstructures={onForgeHyperstructures}
                  onRegistrationComplete={onRegistrationComplete}
                  devModeFilter={false}
                  statusFilter="upcoming"
                  hideHeader
                  hideLegend
                  layout="vertical"
                  sortRegisteredFirst
                />
              </div>
            </div>

            {/* Ended Games Column */}
            <div className="flex flex-col rounded-2xl border border-gold/30 bg-black/40 p-3 backdrop-blur-sm min-h-0 max-h-[500px] md:col-span-2 xl:col-span-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gold/20">
                  <Trophy className="h-3.5 w-3.5 text-gold" />
                </div>
                <h2 className="font-cinzel text-base text-gold uppercase tracking-wider">Ended Games</h2>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-gold/20 scrollbar-track-transparent">
                <UnifiedGameGrid
                  onSelectGame={onSelectGame}
                  onSpectate={onSpectate}
                  onSeeScore={onSeeScore}
                  onClaimRewards={onClaimRewards}
                  onRegistrationComplete={onRegistrationComplete}
                  devModeFilter={false}
                  statusFilter="ended"
                  hideHeader
                  hideLegend
                  layout="vertical"
                  sortClaimableRewardsFirst
                  sortEndedNewestFirst
                  onGamesResolved={onEndedGamesResolved}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Main play view - shows card-based game selector for production games only.
 * This is the default landing page content.
 */
export const PlayView = ({ className }: PlayViewProps) => {
  const [searchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as PlayTab) || "play";
  const queryClient = useQueryClient();

  // Modal state for game entry
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [selectedWorld, setSelectedWorld] = useState<WorldSelection | null>(null);
  const [isSpectateMode, setIsSpectateMode] = useState(false);
  const [isForgeMode, setIsForgeMode] = useState(false);
  const [numHyperstructuresLeft, setNumHyperstructuresLeft] = useState(0);

  // Review flow state
  const [reviewWorld, setReviewWorld] = useState<WorldSelection | null>(null);
  const [reviewInitialStep, setReviewInitialStep] = useState<"claim-rewards" | undefined>(undefined);
  const [endedGames, setEndedGames] = useState<GameData[]>([]);

  // Refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auth state
  const account = useAccountStore((state) => state.account);
  const { isConnected } = useAccount();
  const setModal = useUIStore((state) => state.setModal);

  const handleSelectGame = useCallback(
    (selection: WorldSelection) => {
      const hasAccount = Boolean(account) || isConnected;

      // Check if user needs to sign in before entering game
      if (!hasAccount) {
        setModal(<SignInPromptModal />, true);
        return;
      }

      // Open game entry modal - handles bootstrap, settlement, and game entry
      setSelectedWorld(selection);
      setIsSpectateMode(false);
      setIsForgeMode(false);
      setEntryModalOpen(true);
    },
    [account, isConnected, setModal],
  );

  const handleSpectate = useCallback((selection: WorldSelection) => {
    // Open game entry modal in spectate mode (no account required)
    setSelectedWorld(selection);
    setIsSpectateMode(true);
    setIsForgeMode(false);
    setEntryModalOpen(true);
  }, []);

  const handleForgeHyperstructures = useCallback(
    (selection: WorldSelection, numLeft: number) => {
      const hasAccount = Boolean(account) || isConnected;

      // Check if user needs to sign in before forging
      if (!hasAccount) {
        setModal(<SignInPromptModal />, true);
        return;
      }

      // Open game entry modal in forge mode
      setSelectedWorld(selection);
      setIsSpectateMode(false);
      setIsForgeMode(true);
      setNumHyperstructuresLeft(numLeft);
      setEntryModalOpen(true);
    },
    [account, isConnected, setModal],
  );

  const handleCloseModal = useCallback(() => {
    setEntryModalOpen(false);
    setSelectedWorld(null);
    setIsForgeMode(false);
    setNumHyperstructuresLeft(0);
  }, []);

  const handleSeeScore = useCallback((selection: WorldSelection) => {
    setReviewInitialStep(undefined);
    setReviewWorld(selection);
  }, []);

  const handleClaimRewards = useCallback((selection: WorldSelection) => {
    setReviewInitialStep("claim-rewards");
    setReviewWorld(selection);
  }, []);

  // Registration is handled inline by GameCardGrid - this callback is for any post-registration actions
  const handleRegistrationComplete = useCallback(() => {
    // The toast is already shown by the GameCard component
  }, []);

  // Refresh games data (invalidate world availability queries)
  // This also handles the transition from upcoming to live when game starts
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ["worldAvailability"] });
    } finally {
      // Add a small delay so the spinner is visible
      setTimeout(() => setIsRefreshing(false), 500);
    }
  }, [queryClient]);

  const dismissReviewForWorld = useCallback((world: WorldSelection | null) => {
    if (!world?.chain || !world.worldAddress) return;
    setGameReviewDismissed(world.chain, world.worldAddress);
  }, []);

  const handleCloseReviewModal = useCallback(() => {
    dismissReviewForWorld(reviewWorld);
    setReviewInitialStep(undefined);
    setReviewWorld(null);
  }, [dismissReviewForWorld, reviewWorld]);

  const handleRequireSignIn = useCallback(() => {
    setModal(<SignInPromptModal />, true);
  }, [setModal]);

  const handleEndedGamesResolved = useCallback((games: GameData[]) => {
    setEndedGames(games);
  }, []);

  useEffect(() => {
    if (activeTab !== "play") return;
    if (entryModalOpen || reviewWorld) return;
    if (endedGames.length === 0) return;

    const candidate = endedGames.toSorted((a, b) => (b.endAt ?? 0) - (a.endAt ?? 0))[0];
    if (!candidate) return;
    if (!candidate.worldAddress) return;
    if (isGameReviewDismissed(candidate.chain, candidate.worldAddress)) return;

    setReviewInitialStep(undefined);
    setReviewWorld({ name: candidate.name, chain: candidate.chain, worldAddress: candidate.worldAddress });
  }, [activeTab, endedGames, entryModalOpen, reviewWorld]);

  const renderContent = () => {
    switch (activeTab) {
      case "learn":
        return (
          <LearnContent
            onSelectGame={handleSelectGame}
            onSpectate={handleSpectate}
            onForgeHyperstructures={handleForgeHyperstructures}
            onSeeScore={handleSeeScore}
            onClaimRewards={handleClaimRewards}
            onRegistrationComplete={handleRegistrationComplete}
          />
        );
      case "news":
        return <NewsContent />;
      case "factory":
        return <FactoryTabContent />;
      case "play":
      default:
        return (
          <PlayTabContent
            onSelectGame={handleSelectGame}
            onSpectate={handleSpectate}
            onSeeScore={handleSeeScore}
            onClaimRewards={handleClaimRewards}
            onForgeHyperstructures={handleForgeHyperstructures}
            onRegistrationComplete={handleRegistrationComplete}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
            disabled={entryModalOpen || Boolean(reviewWorld)}
            onEndedGamesResolved={handleEndedGamesResolved}
          />
        );
    }
  };

  return (
    <MarketsProviders>
      <div className={cn("flex flex-col gap-6", className)}>
        {/* Tab content */}
        {renderContent()}
      </div>

      {/* Game Entry Modal - Loading + Settlement + Forge */}
      {selectedWorld && selectedWorld.chain && (
        <GameEntryModal
          isOpen={entryModalOpen}
          onClose={handleCloseModal}
          worldName={selectedWorld.name}
          chain={selectedWorld.chain}
          isSpectateMode={isSpectateMode}
          isForgeMode={isForgeMode}
          numHyperstructuresLeft={numHyperstructuresLeft}
        />
      )}

      {reviewWorld && (
        <GameReviewModal
          isOpen={Boolean(reviewWorld)}
          world={reviewWorld}
          nextGame={null}
          initialStep={reviewInitialStep}
          showUpcomingGamesStep={true}
          onClose={handleCloseReviewModal}
          onRegistrationComplete={handleRegistrationComplete}
          onRequireSignIn={handleRequireSignIn}
        />
      )}
    </MarketsProviders>
  );
};
