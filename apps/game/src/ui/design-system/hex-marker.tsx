import { SvgIcon } from "./icon";
import type { IconMeaning } from "./icon-meaning";
export type MarkerOwner = "you" | "ally" | "enemy" | "neutral";
/** Each side in the HUD sheet's side colours (HUD_SHEET own, ally, enemy, neutral), as on the plates. */
const markerColors: Record<MarkerOwner, string> = {
  you: "var(--hud-own)",
  ally: "var(--hud-ally)",
  enemy: "var(--hud-enemy)",
  neutral: "var(--hud-neutral)",
};
const realmEmblemLayout: Partial<Record<IconMeaning, { size: number; y: number }>> = {
  "map-realm-0": { size: 25, y: -12.5 },
  "map-realm-1": { size: 24.5, y: -12.75 },
  "map-realm-2": { size: 22, y: -11 },
  "map-realm-3": { size: 25.5, y: -13.75 },
};
const hexMarkerPoints = (radius: number, x = 0, y = 0) =>
  Array.from({ length: 6 }, (_, index) => {
    const angle = ((60 * index - 30) * Math.PI) / 180;
    return `${x + Math.cos(angle) * radius},${y + Math.sin(angle) * radius}`;
  }).join(" ");
export function HexMarker({
  name,
  owner,
  value,
  x = 0,
  y = 0,
  radius = 15,
}: {
  name: IconMeaning;
  owner: MarkerOwner;
  value?: string;
  x?: number;
  y?: number;
  radius?: number;
}) {
  const color = markerColors[owner];
  const emblem = realmEmblemLayout[name] ?? { size: 18, y: -10 };
  return (
    <g transform={`translate(${x} ${y}) scale(${radius / 15})`} data-marker={name} data-owner={owner}>
      <polygon
        points={hexMarkerPoints(14)}
        style={{ fill: "var(--hud-surface-to)", stroke: color }}
        strokeWidth={1.4}
      />
      <SvgIcon name={name} x={-emblem.size / 2} y={emblem.y} size={emblem.size} />
      <g transform="translate(-7 8)" style={{ fill: color, stroke: "var(--hud-surface-to)" }} strokeWidth={0.5}>
        {owner === "you" ? (
          <circle r={2.3} />
        ) : owner === "ally" ? (
          <rect x={-2.2} y={-2.2} width={4.4} height={4.4} />
        ) : owner === "enemy" ? (
          <path d="M0 -3 L3 2 L-3 2 Z" />
        ) : (
          <path d="M0 -3 L3 0 L0 3 L-3 0 Z" />
        )}
      </g>
      {value !== undefined && (
        <g>
          <rect x={-2} y={5} width={12} height={7} rx={2} style={{ fill: "var(--hud-surface-to)" }} />
          <text
            x={4}
            y={10.6}
            textAnchor="middle"
            style={{ fill: "rgb(var(--hud-ink))" }}
            fontSize={6}
            fontWeight={700}
          >
            {value}
          </text>
        </g>
      )}
    </g>
  );
}
