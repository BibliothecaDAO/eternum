import clsx from "clsx";
import gsap from "gsap";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronUp from "lucide-react/dist/esm/icons/chevron-up";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EffectIntensity, PlayerEffect, PointDeltas } from "./use-leaderboard-effects";

const CATEGORY_COLORS: Record<keyof PointDeltas, string> = {
  tilesExploredPoints: "#60a5fa",
  cratesOpenedPoints: "#c084fc",
  riftsTakenPoints: "#4ade80",
  hyperstructuresTakenPoints: "#f97316",
  hyperstructuresHeldPoints: "#facc15",
  totalPoints: "#dfaa54",
};

interface EffectPosition {
  x: number;
  y: number;
}

interface PointDeltaEffectProps {
  value: number;
  color: string;
  intensity: EffectIntensity;
  position: EffectPosition;
}

const PointDeltaEffect = ({ value, color, intensity, position }: PointDeltaEffectProps) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const el = ref.current;
    const timeline = gsap.timeline();

    // Pop in with scale
    timeline.fromTo(
      el,
      { scale: 0.5, opacity: 0, y: 0 },
      {
        scale: intensity === "large" ? 1.3 : intensity === "medium" ? 1.15 : 1,
        opacity: 1,
        duration: 0.15,
        ease: "back.out(2)",
      },
    );

    // Float up and fade
    timeline.to(el, {
      y: -35,
      opacity: 0,
      scale: 1,
      duration: intensity === "large" ? 1.8 : 1.4,
      ease: "power2.out",
    });

    return () => {
      timeline.kill();
    };
  }, [intensity]);

  return (
    <div
      ref={ref}
      className="absolute text-sm font-bold whitespace-nowrap pointer-events-none"
      style={{
        left: position.x,
        top: position.y,
        color,
        textShadow: intensity !== "small" ? `0 0 ${intensity === "large" ? 12 : 6}px ${color}` : "none",
        transform: "translateX(-50%)",
      }}
    >
      +{value.toLocaleString()}
      {intensity === "large" && <BurstRing color={color} />}
    </div>
  );
};

const BurstRing = ({ color }: { color: string }) => {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    gsap.fromTo(
      ref.current,
      { scale: 0.5, opacity: 0.6 },
      {
        scale: 2,
        opacity: 0,
        duration: 0.6,
        ease: "power2.out",
      },
    );
  }, []);

  return (
    <span
      ref={ref}
      className="absolute inset-0 rounded-full pointer-events-none"
      style={{
        border: `2px solid ${color}`,
        transform: "translate(-50%, -50%)",
        left: "50%",
        top: "50%",
        width: "100%",
        height: "100%",
      }}
    />
  );
};

interface RankChangeEffectProps {
  change: number;
  intensity: EffectIntensity;
  position: EffectPosition;
}

const RankChangeEffect = ({ change, intensity, position }: RankChangeEffectProps) => {
  const isUp = change < 0;
  const positions = Math.abs(change);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const el = ref.current;
    const timeline = gsap.timeline();

    // Pop in from direction of movement
    timeline.fromTo(
      el,
      {
        scale: 0.5,
        opacity: 0,
        y: isUp ? 10 : -10,
      },
      {
        scale: intensity === "large" ? 1.4 : 1.1,
        opacity: 1,
        y: 0,
        duration: 0.2,
        ease: "back.out(2)",
      },
    );

    // Hold
    timeline.to(el, {
      scale: 1,
      duration: 0.3,
    });

    // Fade out
    timeline.to(el, {
      opacity: 0,
      duration: 0.8,
      ease: "power2.inOut",
    });

    return () => {
      timeline.kill();
    };
  }, [isUp, intensity]);

  const baseColor = isUp ? "#4ade80" : "#f87171";

  return (
    <div
      ref={ref}
      className={clsx("absolute flex items-center gap-0.5 font-bold text-sm pointer-events-none", {
        "text-green-400": isUp,
        "text-red-400": !isUp,
      })}
      style={{
        left: position.x,
        top: position.y,
        textShadow: intensity !== "small" ? `0 0 8px ${baseColor}` : "none",
        transform: "translateX(-50%)",
      }}
    >
      {isUp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      <span>{positions}</span>
    </div>
  );
};

interface EffectRendererProps {
  effect: PlayerEffect;
  rect: DOMRect;
  showTribeDetails: boolean;
}

const EffectRenderer = ({ effect, rect, showTribeDetails }: EffectRendererProps) => {
  const { pointDeltas, rankChange, pointIntensity, rankIntensity } = effect;

  // Calculate column positions based on grid layout
  // The row width is divided into columns; we estimate center positions
  const rowWidth = rect.width;
  const numColumns = showTribeDetails ? 9 : 8;

  // Approximate column widths (these match the grid template ratios)
  const getColumnCenter = (colIndex: number): number => {
    // Simplified: divide row into equal parts and get center
    const colWidth = rowWidth / numColumns;
    return rect.left + colWidth * colIndex + colWidth / 2;
  };

  const baseY = rect.top - 8; // Above the row
  const rankY = rect.top + rect.height / 2; // Centered vertically for rank

  // Adjust column indices based on tribe column presence
  const offset = showTribeDetails ? 0 : -1;

  const positions: Record<keyof PointDeltas | "rank", EffectPosition> = {
    rank: { x: getColumnCenter(0) + 20, y: rankY },
    tilesExploredPoints: { x: getColumnCenter(3 + offset), y: baseY },
    cratesOpenedPoints: { x: getColumnCenter(4 + offset), y: baseY },
    riftsTakenPoints: { x: getColumnCenter(5 + offset), y: baseY },
    hyperstructuresTakenPoints: { x: getColumnCenter(6 + offset), y: baseY },
    hyperstructuresHeldPoints: { x: getColumnCenter(7 + offset), y: baseY },
    totalPoints: { x: getColumnCenter(8 + offset), y: baseY },
  };
  const pointEffects = (Object.keys(pointDeltas) as Array<keyof PointDeltas>).filter((key) => pointDeltas[key] > 0);

  return (
    <>
      {/* Rank change effect */}
      {rankChange !== 0 && <RankChangeEffect change={rankChange} intensity={rankIntensity} position={positions.rank} />}

      {pointEffects.map((key) => (
        <PointDeltaEffect
          key={key}
          value={pointDeltas[key]}
          color={CATEGORY_COLORS[key]}
          intensity={pointIntensity}
          position={positions[key]}
        />
      ))}
    </>
  );
};

interface LeaderboardEffectsOverlayProps {
  effects: Map<string, PlayerEffect>;
  rowRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  showTribeDetails: boolean;
}

export const LeaderboardEffectsOverlay = ({ effects, rowRefs, showTribeDetails }: LeaderboardEffectsOverlayProps) => {
  const [positions, setPositions] = useState<Map<string, DOMRect>>(new Map());
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  // Set portal target on mount
  useEffect(() => {
    if (typeof document !== "undefined") {
      setPortalTarget(document.body);
    }
  }, []);

  // Recalculate positions when effects change
  useEffect(() => {
    if (effects.size === 0) {
      setPositions(new Map());
      return;
    }

    const newPositions = new Map<string, DOMRect>();
    effects.forEach((_, address) => {
      const rowEl = rowRefs.current.get(address);
      if (rowEl) {
        newPositions.set(address, rowEl.getBoundingClientRect());
      }
    });
    setPositions(newPositions);
  }, [effects, rowRefs]);

  if (!portalTarget || effects.size === 0) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      {Array.from(effects.entries()).map(([address, effect]) => {
        const rect = positions.get(address);
        if (!rect) return null;
        return (
          <EffectRenderer
            key={`${address}-${effect.timestamp}`}
            effect={effect}
            rect={rect}
            showTribeDetails={showTribeDetails}
          />
        );
      })}
    </div>,
    portalTarget,
  );
};
