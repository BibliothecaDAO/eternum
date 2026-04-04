import type { WorldmapStrategicVisualPolicy } from "@/three/scenes/worldmap-navigation/worldmap-strategic-visual-policy";
import { BiomeIdToType, BiomeType } from "@bibliothecadao/types";

import type { StrategicMarkerDisposition, StrategicMarkerKind, TileMarker } from "./strategic-map-markers";

export type StrategicMapRenderMode = "minimap" | "transition" | "strategic";

interface StrategicMapModeStyle {
  tileFillOpacity: number;
  tileStroke: string;
  tileStrokeOpacity: number;
  tileStrokeWidth: number;
  markerOpacity: number;
  markerScale: number;
  markerBadgeOpacity: number;
  markerBadgeStrokeOpacity: number;
  markerBadgeRadius: number;
  fallbackOccupierRadius: number;
  focusRingRadius: number;
  focusRingStroke: string;
  focusRingStrokeOpacity: number;
  focusRingFill: string;
  focusRingFillOpacity: number;
  focusBadgeOpacity: number;
  focusBadgeFill: string;
  focusBadgeStroke: string;
  focusBadgeText: string;
  cameraCircleStroke: string;
  cameraCircleOpacity: number;
  cameraCircleFillOpacity: number;
  cameraCircleStrokeWidth: number;
  unexploredMaskOpacity: number;
}

interface StrategicMarkerChrome {
  badgeFill: string;
  badgeStroke: string;
  badgeRadius: number;
  iconSize: number;
}

const STRATEGIC_BIOME_PALETTE: Record<BiomeType | "fallback", string> = {
  None: "#3d342d",
  DeepOcean: "#243540",
  Ocean: "#304754",
  Beach: "#b89463",
  Scorched: "#4f382f",
  Bare: "#90775d",
  Tundra: "#b5b5ac",
  Snow: "#d8dbe4",
  TemperateDesert: "#a6754f",
  Shrubland: "#8b8060",
  Taiga: "#4a563a",
  Grassland: "#7a7646",
  TemperateDeciduousForest: "#616946",
  TemperateRainForest: "#645442",
  SubtropicalDesert: "#9a7346",
  TropicalSeasonalForest: "#85704e",
  TropicalRainForest: "#6e6047",
  fallback: "#5e584e",
};

const MODE_TILE_STROKE_ALPHA: Record<StrategicMapRenderMode, number> = {
  minimap: 0.18,
  transition: 0.08,
  strategic: 0.06,
};

const MODE_MARKER_SCALE: Record<StrategicMapRenderMode, number> = {
  minimap: 0.86,
  transition: 0.94,
  strategic: 1,
};

const MODE_BACKGROUND_STYLE: Record<
  StrategicMapRenderMode,
  {
    background: string;
    texture: string;
    vignette: string;
    frameBorder: string;
  }
> = {
  minimap: {
    background:
      "radial-gradient(circle at 30% 22%, rgba(158,131,93,0.22), rgba(18,14,12,0.94) 72%), linear-gradient(180deg, rgba(44,33,27,0.84), rgba(14,10,9,0.98))",
    texture:
      "repeating-linear-gradient(135deg, rgba(255,228,181,0.035) 0px, rgba(255,228,181,0.035) 1px, transparent 1px, transparent 9px)",
    vignette: "radial-gradient(circle at center, rgba(0,0,0,0) 42%, rgba(7,5,4,0.52) 100%)",
    frameBorder: "rgba(213, 169, 96, 0.28)",
  },
  transition: {
    background:
      "radial-gradient(circle at 50% 38%, rgba(165,132,91,0.26), rgba(30,23,19,0.8) 56%, rgba(9,7,6,0.96) 100%), linear-gradient(180deg, rgba(57,42,33,0.52), rgba(11,8,7,0.9))",
    texture:
      "repeating-linear-gradient(135deg, rgba(255,231,191,0.05) 0px, rgba(255,231,191,0.05) 1px, transparent 1px, transparent 12px), repeating-linear-gradient(45deg, rgba(95,71,53,0.08) 0px, rgba(95,71,53,0.08) 2px, transparent 2px, transparent 18px)",
    vignette: "radial-gradient(circle at center, rgba(0,0,0,0) 38%, rgba(11,8,7,0.68) 100%)",
    frameBorder: "rgba(213, 176, 118, 0.24)",
  },
  strategic: {
    background:
      "radial-gradient(circle at 50% 35%, rgba(173,140,95,0.28), rgba(38,29,24,0.86) 54%, rgba(10,7,6,1) 100%), linear-gradient(180deg, rgba(69,52,38,0.42), rgba(10,7,6,0.92))",
    texture:
      "repeating-linear-gradient(135deg, rgba(255,235,206,0.07) 0px, rgba(255,235,206,0.07) 1px, transparent 1px, transparent 14px), repeating-linear-gradient(35deg, rgba(96,74,54,0.07) 0px, rgba(96,74,54,0.07) 2px, transparent 2px, transparent 24px)",
    vignette: "radial-gradient(circle at center, rgba(0,0,0,0) 36%, rgba(8,6,5,0.74) 100%)",
    frameBorder: "rgba(226, 188, 126, 0.22)",
  },
};

const MARKER_KIND_SCALE: Record<StrategicMarkerKind, number> = {
  landmark: 1.2,
  realm: 1,
  settlement: 0.9,
  army: 0.8,
  resource: 0.78,
  quest: 0.72,
  chest: 0.7,
};

export function resolveStrategicLayerBackdrop(mode: StrategicMapRenderMode) {
  return MODE_BACKGROUND_STYLE[mode];
}

export function resolveStrategicBiomeFill(biomeId: number | undefined, mode: StrategicMapRenderMode): string {
  const biomeType = biomeId === undefined ? undefined : BiomeIdToType[biomeId];
  const baseColor =
    (biomeType ? STRATEGIC_BIOME_PALETTE[biomeType as keyof typeof STRATEGIC_BIOME_PALETTE] : undefined) ??
    STRATEGIC_BIOME_PALETTE.fallback;

  if (mode === "minimap") {
    return baseColor;
  }

  if (mode === "transition") {
    return mixHexColors(baseColor, "#dcc6a8", 0.14);
  }

  return mixHexColors(baseColor, "#e8dbc5", 0.22);
}

export function resolveStrategicMapModeStyle(input: {
  renderMode: StrategicMapRenderMode;
  visualPolicy?: Pick<
    WorldmapStrategicVisualPolicy,
    | "strategicSurfaceOpacity"
    | "strategicMarkerOpacity"
    | "strategicMarkerScale"
    | "selectionRingOpacity"
    | "unexploredMaskOpacity"
  >;
}): StrategicMapModeStyle {
  const { renderMode, visualPolicy } = input;
  const baseMarkerScale = MODE_MARKER_SCALE[renderMode];

  switch (renderMode) {
    case "minimap":
      return {
        tileFillOpacity: 0.9,
        tileStroke: "#21150f",
        tileStrokeOpacity: MODE_TILE_STROKE_ALPHA.minimap,
        tileStrokeWidth: 0.65,
        markerOpacity: 0.96,
        markerScale: baseMarkerScale,
        markerBadgeOpacity: 0.94,
        markerBadgeStrokeOpacity: 0.42,
        markerBadgeRadius: 7.6,
        fallbackOccupierRadius: 2.8,
        focusRingRadius: 8.4,
        focusRingStroke: "#f2d397",
        focusRingStrokeOpacity: 0.68,
        focusRingFill: "#f2d397",
        focusRingFillOpacity: 0.08,
        focusBadgeOpacity: 0,
        focusBadgeFill: "#1b1411",
        focusBadgeStroke: "#c79c58",
        focusBadgeText: "#f4dfb2",
        cameraCircleStroke: "#f0c784",
        cameraCircleOpacity: 0.52,
        cameraCircleFillOpacity: 0.04,
        cameraCircleStrokeWidth: 0.55,
        unexploredMaskOpacity: 0.22,
      };
    case "transition":
      return {
        tileFillOpacity: visualPolicy?.strategicSurfaceOpacity ?? 0.78,
        tileStroke: "#4a392d",
        tileStrokeOpacity: MODE_TILE_STROKE_ALPHA.transition,
        tileStrokeWidth: 0.42,
        markerOpacity: visualPolicy?.strategicMarkerOpacity ?? 0.74,
        markerScale: visualPolicy?.strategicMarkerScale ?? baseMarkerScale,
        markerBadgeOpacity: 0.88,
        markerBadgeStrokeOpacity: 0.36,
        markerBadgeRadius: 9.4,
        fallbackOccupierRadius: 3.2,
        focusRingRadius: 10.8,
        focusRingStroke: "#f0d5a0",
        focusRingStrokeOpacity: visualPolicy?.selectionRingOpacity ?? 0.84,
        focusRingFill: "#f0d5a0",
        focusRingFillOpacity: 0.09,
        focusBadgeOpacity: 0,
        focusBadgeFill: "#1b1411",
        focusBadgeStroke: "#d3a767",
        focusBadgeText: "#f3dfbd",
        cameraCircleStroke: "#f0d3a0",
        cameraCircleOpacity: 0.28,
        cameraCircleFillOpacity: 0.02,
        cameraCircleStrokeWidth: 0.48,
        unexploredMaskOpacity: visualPolicy?.unexploredMaskOpacity ?? 0.46,
      };
    case "strategic":
      return {
        tileFillOpacity: visualPolicy?.strategicSurfaceOpacity ?? 0.96,
        tileStroke: "#746356",
        tileStrokeOpacity: MODE_TILE_STROKE_ALPHA.strategic,
        tileStrokeWidth: 0.34,
        markerOpacity: visualPolicy?.strategicMarkerOpacity ?? 1,
        markerScale: visualPolicy?.strategicMarkerScale ?? baseMarkerScale,
        markerBadgeOpacity: 0.94,
        markerBadgeStrokeOpacity: 0.48,
        markerBadgeRadius: 10.4,
        fallbackOccupierRadius: 3.4,
        focusRingRadius: 12.2,
        focusRingStroke: "#f3dab0",
        focusRingStrokeOpacity: visualPolicy?.selectionRingOpacity ?? 1,
        focusRingFill: "#f3dab0",
        focusRingFillOpacity: 0.12,
        focusBadgeOpacity: 0.96,
        focusBadgeFill: "#1a130f",
        focusBadgeStroke: "#cfa86e",
        focusBadgeText: "#f4e1b7",
        cameraCircleStroke: "#f0d5a0",
        cameraCircleOpacity: 0.2,
        cameraCircleFillOpacity: 0.01,
        cameraCircleStrokeWidth: 0.45,
        unexploredMaskOpacity: visualPolicy?.unexploredMaskOpacity ?? 0.6,
      };
  }
}

export function resolveStrategicMarkerChrome(input: {
  marker: TileMarker;
  renderMode: StrategicMapRenderMode;
  markerScale: number;
}): StrategicMarkerChrome {
  const { marker, renderMode, markerScale } = input;
  const baseBadge = resolveMarkerBadgeTone(marker.kind, marker.disposition);
  const iconMultiplier = marker.sizeMultiplier ?? 1;
  const kindScale = MARKER_KIND_SCALE[marker.kind];
  const resolvedScale = markerScale * kindScale * iconMultiplier;
  const modeStyle = resolveStrategicMapModeStyle({ renderMode });

  return {
    badgeFill: baseBadge.fill,
    badgeStroke: baseBadge.stroke,
    badgeRadius: modeStyle.markerBadgeRadius * resolvedScale,
    iconSize: 12.8 * resolvedScale,
  };
}

function resolveMarkerBadgeTone(kind: StrategicMarkerKind, disposition: StrategicMarkerDisposition) {
  if (kind === "landmark") {
    return {
      fill: "rgba(89, 113, 124, 0.88)",
      stroke: "rgba(199, 225, 231, 0.88)",
    };
  }

  if (kind === "quest" || kind === "chest") {
    return {
      fill: "rgba(122, 86, 48, 0.9)",
      stroke: "rgba(231, 192, 132, 0.86)",
    };
  }

  if (kind === "resource") {
    return disposition === "friendly"
      ? {
          fill: "rgba(132, 103, 56, 0.9)",
          stroke: "rgba(240, 212, 149, 0.88)",
        }
      : {
          fill: "rgba(72, 89, 93, 0.88)",
          stroke: "rgba(190, 217, 220, 0.82)",
        };
  }

  if (disposition === "friendly") {
    return {
      fill: "rgba(129, 95, 52, 0.92)",
      stroke: "rgba(242, 214, 158, 0.9)",
    };
  }

  if (disposition === "hostile") {
    return {
      fill: "rgba(112, 60, 42, 0.92)",
      stroke: "rgba(221, 151, 121, 0.88)",
    };
  }

  return {
    fill: "rgba(75, 92, 100, 0.9)",
    stroke: "rgba(196, 215, 219, 0.84)",
  };
}

function mixHexColors(left: string, right: string, rightWeight: number): string {
  const clampedWeight = clamp(rightWeight, 0, 1);
  const leftRgb = parseHexColor(left);
  const rightRgb = parseHexColor(right);

  return toHexColor({
    r: Math.round(leftRgb.r + (rightRgb.r - leftRgb.r) * clampedWeight),
    g: Math.round(leftRgb.g + (rightRgb.g - leftRgb.g) * clampedWeight),
    b: Math.round(leftRgb.b + (rightRgb.b - leftRgb.b) * clampedWeight),
  });
}

function parseHexColor(value: string): { r: number; g: number; b: number } {
  const normalized = value.replace("#", "");
  const hex =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : normalized;

  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function toHexColor(input: { r: number; g: number; b: number }): string {
  return `#${toHexChannel(input.r)}${toHexChannel(input.g)}${toHexChannel(input.b)}`;
}

function toHexChannel(value: number): string {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
