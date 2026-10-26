import { Icon } from "@/ui/design-system/icon";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

import type { PhoneSize } from "./moments";

/** The map's hexes at the game's default zoom on a phone: about 85 px across, as the walk measured them. */
const HEX_RADIUS = 48;
const SQRT3 = Math.sqrt(3);
/** The measuring grid: the walk read the live client on the same 8 px grid. */
const GRID_PX = 8;

/**
 * One phone at its own CSS size, scaled to fit the page, its map drawn under whatever HUD `children` lays over it.
 * `focusY` is where the layout puts the tile the moment acts on (a plot, a camp); the map is drawn so that tile sits
 * there, as the camera would frame it. Under the phone, the share of its screen where a tap reaches the map.
 */
export const PhoneFrame = ({
  size,
  scale,
  focusY,
  children,
}: {
  size: PhoneSize;
  scale: number;
  focusY: number;
  children: ReactNode;
}) => {
  const screen = useRef<HTMLDivElement>(null);
  const share = useMapShare(screen, scale);
  return (
    <figure className="m-0 flex flex-col items-center gap-1">
      <div
        className="overflow-hidden rounded-[18px] border border-hud-line shadow-lg"
        style={{ width: size.width * scale, height: size.height * scale }}
      >
        <div
          ref={screen}
          className="relative origin-top-left overflow-hidden bg-[#0c0b10]"
          style={{ width: size.width, height: size.height, transform: `scale(${scale})` }}
        >
          <DrawnMap size={size} focusY={focusY} />
          {children}
        </div>
      </div>
      <figcaption className="text-hud-label text-hud-muted">
        Map answers a tap on <strong className="text-hud-ink">{share === null ? "…" : `${share}%`}</strong> of the
        screen
      </figcaption>
    </figure>
  );
};

/** The share of the screen whose topmost element is the drawn map, read again whenever the screen's HUD changes. */
const useMapShare = (screen: React.RefObject<HTMLDivElement | null>, scale: number) => {
  const [share, setShare] = useState<number | null>(null);
  useLayoutEffect(() => {
    const element = screen.current;
    if (!element) return;
    const measure = () => {
      const box = element.getBoundingClientRect();
      const step = GRID_PX * scale;
      let cells = 0;
      let map = 0;
      for (let y = box.top + step / 2; y < box.bottom; y += step) {
        for (let x = box.left + step / 2; x < box.right; x += step) {
          cells += 1;
          if (document.elementFromPoint(x, y)?.closest("[data-drawn-map]")) map += 1;
        }
      }
      setShare(cells === 0 ? null : Math.round((map / cells) * 100));
    };
    const frame = requestAnimationFrame(measure);
    const changes = new MutationObserver(() => requestAnimationFrame(measure));
    changes.observe(element, { subtree: true, childList: true, attributes: true });
    return () => {
      cancelAnimationFrame(frame);
      changes.disconnect();
    };
  }, [screen, scale]);
  return share;
};

/** A fogged hex field with the realm, its lit ring and an army, panned so the acted-on tile stands at `focusY`. */
const DrawnMap = ({ size, focusY }: { size: PhoneSize; focusY: number }) => {
  const centre = { x: size.width / 2, y: focusY - HEX_RADIUS * 1.5 };
  const hexes = [];
  for (let r = -9; r <= 9; r += 1) {
    for (let q = -9; q <= 9; q += 1) {
      const x = centre.x + HEX_RADIUS * SQRT3 * (q + r / 2);
      const y = centre.y + HEX_RADIUS * 1.5 * r;
      if (x < -HEX_RADIUS || x > size.width + HEX_RADIUS || y < -HEX_RADIUS || y > size.height + HEX_RADIUS) continue;
      const ring = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
      const fill = ring === 0 ? "#6b4f2a" : ring === 1 ? "#4f7a35" : ring === 2 ? "#3d5f2a" : "#15141c";
      const target = q === 0 && r === 1;
      hexes.push(
        <polygon
          key={`${q},${r}`}
          points={hexPoints(x, y)}
          fill={fill}
          stroke={target ? "#f5d38a" : "#2a2835"}
          strokeWidth={target ? 3 : 1}
        />,
      );
    }
  }
  return (
    <div data-drawn-map className="absolute inset-0">
      <svg width={size.width} height={size.height} className="absolute inset-0">
        {hexes}
      </svg>
      <Icon name="realm" size={56} className="absolute" style={{ left: centre.x - 28, top: centre.y - 34 }} />
      <Icon
        name="knight-t1"
        size={36}
        className="absolute"
        style={{ left: centre.x + HEX_RADIUS * SQRT3 - 18, top: centre.y - 22 }}
      />
      <Icon
        name="camp"
        size={40}
        className="absolute"
        style={{ left: centre.x + (HEX_RADIUS * SQRT3) / 2 - 20, top: focusY - 24 }}
      />
    </div>
  );
};

const hexPoints = (x: number, y: number) =>
  Array.from({ length: 6 }, (_, corner) => {
    const angle = (Math.PI / 180) * (60 * corner - 30);
    return `${x + (HEX_RADIUS - 1) * Math.cos(angle)},${y + (HEX_RADIUS - 1) * Math.sin(angle)}`;
  }).join(" ");
