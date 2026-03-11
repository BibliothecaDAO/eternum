import { forwardRef, type Ref, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import type { GameReviewMapSnapshot, GameReviewMapSnapshotTile } from "@/services/review/game-review-service";
import { BIOME_COLORS } from "@/three/managers/biome-colors";
import { FELT_CENTER } from "@/ui/config";
import { BiomeIdToType, BiomeType } from "@bibliothecadao/types";
import { BLITZ_CARD_DIMENSIONS } from "../lib/blitz-highlight";
import { BLITZ_CARD_BASE_STYLES, BLITZ_CARD_FONT_IMPORT, BLITZ_CARD_GOLD_THEME } from "../lib/blitz-card-shared";

type MapFingerprintViewMode = "biome" | "occupier";

type AvailableMapSnapshot = Extract<GameReviewMapSnapshot, { available: true }>;

type MapPolygon = {
  key: string;
  points: string;
  fill: string;
  fillOpacity: number;
  strokeOpacity: number;
  centerX: number;
  centerY: number;
  showMarker: boolean;
};

type MapGeometry = {
  polygons: MapPolygon[];
  viewBox: string;
};

const OCCUPIER_STRUCTURE = "#22d3ee";
const OCCUPIER_ARMY = "#f97316";
const GOLD_DARK: [number, number, number] = [102, 69, 18];
const GOLD_LIGHT: [number, number, number] = [252, 236, 184];

const MAP_FINGERPRINT_CARD_STYLES = `
  ${BLITZ_CARD_FONT_IMPORT}
  ${BLITZ_CARD_BASE_STYLES}
  ${BLITZ_CARD_GOLD_THEME}

  .blitz-card-root .map-world {
    position: absolute;
    inset: -140px -210px -135px -210px;
    z-index: 4;
    pointer-events: none;
    -webkit-mask-image: radial-gradient(
      ellipse 52% 40% at 52% 50%,
      rgba(0, 0, 0, 1) 0%,
      rgba(0, 0, 0, 0.82) 46%,
      rgba(0, 0, 0, 0.22) 66%,
      rgba(0, 0, 0, 0) 100%
    );
    mask-image: radial-gradient(
      ellipse 52% 40% at 52% 50%,
      rgba(0, 0, 0, 1) 0%,
      rgba(0, 0, 0, 0.82) 46%,
      rgba(0, 0, 0, 0.22) 66%,
      rgba(0, 0, 0, 0) 100%
    );
  }

  .blitz-card-root .map-world svg {
    width: 100%;
    height: 100%;
    overflow: visible;
  }
`;

const HEX_SIZE = 8.7;
const SQRT3 = Math.sqrt(3);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const parseColorToRgb = (value: string): [number, number, number] => {
  const color = value.trim();

  if (color.startsWith("#")) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      const red = Number.parseInt(`${hex[0]}${hex[0]}`, 16);
      const green = Number.parseInt(`${hex[1]}${hex[1]}`, 16);
      const blue = Number.parseInt(`${hex[2]}${hex[2]}`, 16);
      return [red, green, blue];
    }
    if (hex.length >= 6) {
      const red = Number.parseInt(hex.slice(0, 2), 16);
      const green = Number.parseInt(hex.slice(2, 4), 16);
      const blue = Number.parseInt(hex.slice(4, 6), 16);
      return [red, green, blue];
    }
  }

  const rgbMatch = color.match(/rgba?\(([^)]+)\)/i);
  if (rgbMatch) {
    const parts = rgbMatch[1]
      .split(",")
      .map((part) => Number.parseFloat(part.trim()))
      .filter((part) => Number.isFinite(part));
    if (parts.length >= 3) {
      return [
        clamp(Math.round(parts[0]), 0, 255),
        clamp(Math.round(parts[1]), 0, 255),
        clamp(Math.round(parts[2]), 0, 255),
      ];
    }
  }

  return [75, 85, 99];
};

const blendRgb = (
  from: [number, number, number],
  to: [number, number, number],
  ratio: number,
): [number, number, number] => {
  const t = clamp(ratio, 0, 1);
  return [
    Math.round(from[0] + (to[0] - from[0]) * t),
    Math.round(from[1] + (to[1] - from[1]) * t),
    Math.round(from[2] + (to[2] - from[2]) * t),
  ];
};

const rgbToCss = (rgb: [number, number, number]): string => `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;

const applyGoldLevel = (color: string, goldLevel: number): string => {
  const t = clamp(goldLevel, 0, 1);
  if (t <= 0) {
    return color;
  }

  const baseRgb = parseColorToRgb(color);
  const luminance = clamp((baseRgb[0] * 0.2126 + baseRgb[1] * 0.7152 + baseRgb[2] * 0.0722) / 255, 0, 1);
  const goldTarget = blendRgb(GOLD_DARK, GOLD_LIGHT, luminance);
  const blended = blendRgb(baseRgb, goldTarget, t);
  return rgbToCss(blended);
};

const getBiomeColor = (tile: GameReviewMapSnapshotTile): string => {
  const biomeType = BiomeIdToType[tile.biome];
  if (biomeType === BiomeType.Taiga) return "#ffffff";
  const color = BIOME_COLORS[biomeType as keyof typeof BIOME_COLORS];
  return color?.getStyle?.() ?? "#4b5563";
};

const getOccupierColor = (tile: GameReviewMapSnapshotTile, fallbackBiomeColor: string): string => {
  if (!tile.hasOccupier) {
    return fallbackBiomeColor;
  }

  return tile.occupierIsStructure ? OCCUPIER_STRUCTURE : OCCUPIER_ARMY;
};

const getGridMetrics = () => {
  const hexHeight = HEX_SIZE * 2;
  const hexWidth = SQRT3 * HEX_SIZE;
  const vertDist = hexHeight * 0.75;
  const horizDist = hexWidth;
  return { vertDist, horizDist };
};

const offsetToPixel = (col: number, row: number) => {
  const { vertDist, horizDist } = getGridMetrics();
  const rowOffset = ((row % 2) * Math.sign(row) * horizDist) / 2;
  const x = col * horizDist - rowOffset;
  const y = row * vertDist;
  return { x, y };
};

const buildHexPoints = (centerX: number, centerY: number): string => {
  const corners: string[] = [];
  for (let index = 0; index < 6; index += 1) {
    const angle = ((60 * index - 30) * Math.PI) / 180;
    const x = centerX + HEX_SIZE * Math.cos(angle);
    const y = centerY + HEX_SIZE * Math.sin(angle);
    corners.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return corners.join(" ");
};

const buildMapGeometry = (
  snapshot: AvailableMapSnapshot,
  mode: MapFingerprintViewMode,
  zoom: number,
  goldLevel: number,
): MapGeometry => {
  const center = FELT_CENTER();
  const rawCenters = snapshot.tiles.map((tile) => ({
    tile,
    pixel: offsetToPixel(tile.col - center, tile.row - center),
  }));

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const entry of rawCenters) {
    minX = Math.min(minX, entry.pixel.x - HEX_SIZE);
    maxX = Math.max(maxX, entry.pixel.x + HEX_SIZE);
    minY = Math.min(minY, entry.pixel.y - HEX_SIZE);
    maxY = Math.max(maxY, entry.pixel.y + HEX_SIZE);
  }

  const centerX = Number.isFinite(minX) && Number.isFinite(maxX) ? (minX + maxX) / 2 : 0;
  const centerY = Number.isFinite(minY) && Number.isFinite(maxY) ? (minY + maxY) / 2 : 0;

  minX = Number.POSITIVE_INFINITY;
  maxX = Number.NEGATIVE_INFINITY;
  minY = Number.POSITIVE_INFINITY;
  maxY = Number.NEGATIVE_INFINITY;

  const polygons = rawCenters.map((entry, index) => {
    const tile = entry.tile;
    const offsetX = entry.pixel.x - centerX;
    const offsetY = entry.pixel.y - centerY;
    const biomeColor = getBiomeColor(tile);
    const fillBase = mode === "occupier" ? getOccupierColor(tile, biomeColor) : biomeColor;
    const fill = applyGoldLevel(fillBase, goldLevel);
    const fillOpacity = mode === "occupier" && tile.hasOccupier ? 0.98 : 0.72;
    const strokeOpacity = mode === "occupier" && tile.hasOccupier ? 0.26 : 0.12;
    const showMarker = mode === "occupier" && tile.hasOccupier && index % 17 === 0;
    const points = buildHexPoints(offsetX, offsetY);

    minX = Math.min(minX, offsetX - HEX_SIZE);
    maxX = Math.max(maxX, offsetX + HEX_SIZE);
    minY = Math.min(minY, offsetY - HEX_SIZE);
    maxY = Math.max(maxY, offsetY + HEX_SIZE);

    return {
      key: `${tile.col}:${tile.row}:${index}`,
      points,
      fill,
      fillOpacity,
      strokeOpacity,
      centerX: offsetX,
      centerY: offsetY,
      showMarker,
    } satisfies MapPolygon;
  });

  const padding = 34;
  const safeMinX = Number.isFinite(minX) ? minX : -100;
  const safeMaxX = Number.isFinite(maxX) ? maxX : 100;
  const safeMinY = Number.isFinite(minY) ? minY : -100;
  const safeMaxY = Number.isFinite(maxY) ? maxY : 100;
  const baseWidth = Math.max(1, safeMaxX - safeMinX + padding * 2);
  const baseHeight = Math.max(1, safeMaxY - safeMinY + padding * 2);
  const clampedZoom = Math.max(0.2, Math.min(2.2, zoom));
  const width = baseWidth / clampedZoom;
  const height = baseHeight / clampedZoom;
  const centerViewX = safeMinX - padding + baseWidth / 2;
  const centerViewY = safeMinY - padding + baseHeight / 2;
  const viewBoxX = centerViewX - width / 2;
  const viewBoxY = centerViewY - height / 2;
  const viewBox = `${viewBoxX} ${viewBoxY} ${width} ${height}`;

  return { polygons, viewBox };
};

interface BlitzMapFingerprintCardProps {
  worldName: string;
  snapshot: AvailableMapSnapshot;
  mode: MapFingerprintViewMode;
  zoom: number;
  goldLevel: number;
  player?: { name: string; address: string } | null;
}

const BlitzMapFingerprintCard = forwardRef<SVGSVGElement, BlitzMapFingerprintCardProps>(
  ({ worldName, snapshot, mode, zoom, goldLevel, player }, ref) => {
    const [portalTarget, setPortalTarget] = useState<SVGGElement | null>(null);
    const mapGeometry = useMemo(
      () => buildMapGeometry(snapshot, mode, zoom, goldLevel),
      [snapshot, mode, zoom, goldLevel],
    );

    const cardMarkup = (
      <foreignObject width="100%" height="100%">
        <div
          className={`blitz-card-root card-gold ${player ? "" : "no-player"}`}
          aria-label={`${worldName} Map Fingerprint card`}
        >
          <style dangerouslySetInnerHTML={{ __html: MAP_FINGERPRINT_CARD_STYLES }} />

          <div className="bg-mark" />
          <div className="bg-smoke" />
          <div className="bg-texture" />
          <div className="bg-layer gradient-overlay" />
          <div className="bg-layer dark-overlay" />

          <div className="map-world" aria-hidden>
            <svg viewBox={mapGeometry.viewBox} preserveAspectRatio="xMidYMid slice" role="presentation">
              {mapGeometry.polygons.map((tile) => (
                <polygon
                  key={tile.key}
                  points={tile.points}
                  fill={tile.fill}
                  fillOpacity={tile.fillOpacity}
                  stroke="#FAE8BC"
                  strokeOpacity={tile.strokeOpacity}
                  strokeWidth={0.68}
                />
              ))}
              {mapGeometry.polygons
                .filter((tile) => tile.showMarker)
                .map((tile) => (
                  <circle
                    key={`${tile.key}:marker`}
                    cx={tile.centerX}
                    cy={tile.centerY}
                    r={2.3}
                    fill="#F7D687"
                    fillOpacity={0.82}
                  />
                ))}
            </svg>
          </div>

          <img className="corner-mark" src="/images/logos/Eternum-Mark-Black.png" alt="Eternum mark" />

          <div className="title-stack">
            <span className="eyebrow">{worldName}</span>
            <span className="title">Map Fingerprint</span>
          </div>

          <img className="realms-logo" src="/images/logos/realms-world-white.svg" alt="Realms World logo" />

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
          aria-label={`${worldName} map fingerprint card`}
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

BlitzMapFingerprintCard.displayName = "BlitzMapFingerprintCard";

interface BlitzMapFingerprintCardWithSelectorProps extends BlitzMapFingerprintCardProps {
  className?: string;
  cardRef?: Ref<SVGSVGElement>;
}

export const BlitzMapFingerprintCardWithSelector = ({
  className,
  cardRef,
  ...cardProps
}: BlitzMapFingerprintCardWithSelectorProps) => {
  const containerClasses = ["flex w-full flex-col items-center gap-4", className].filter(Boolean).join(" ");

  return (
    <div className={containerClasses}>
      <div className="flex w-full justify-center">
        <BlitzMapFingerprintCard {...cardProps} ref={cardRef} />
      </div>
    </div>
  );
};
