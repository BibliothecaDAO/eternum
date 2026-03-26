import { useMemo, type FC } from "react";

import clsx from "clsx";

import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { configManager } from "@bibliothecadao/eternum";
import { ResourcesIds } from "@bibliothecadao/types";

const PRODUCTION_DEPLETION_WINDOW_SECONDS = 10 * 60;
const PRODUCTION_PULSE_THRESHOLD_SECONDS = 2 * 60;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const resolveResourceIdFromLabel = (label: string): ResourcesIds | undefined => {
  const maybeId = (ResourcesIds as unknown as Record<string, ResourcesIds | string>)[label];
  return typeof maybeId === "number" ? maybeId : undefined;
};

/** Dominant color per resource — [r, g, b] extracted from icon artwork. */
const RESOURCE_COLORS: Record<string, [number, number, number]> = {
  Wood: [139, 90, 43],
  Stone: [156, 156, 156],
  Coal: [60, 60, 60],
  Copper: [184, 115, 51],
  Obsidian: [55, 25, 70],
  Silver: [192, 192, 210],
  Ironwood: [90, 120, 80],
  ColdIron: [100, 140, 180],
  Gold: [255, 200, 50],
  Hartwood: [60, 140, 60],
  Diamonds: [185, 242, 255],
  Sapphire: [30, 80, 200],
  Ruby: [200, 30, 50],
  DeepCrystal: [120, 50, 200],
  Ignium: [255, 80, 20],
  EtherealSilica: [200, 220, 255],
  TrueIce: [140, 220, 255],
  TwilightQuartz: [180, 100, 220],
  AlchemicalSilver: [170, 200, 230],
  Adamantine: [50, 200, 150],
  Mithral: [200, 170, 255],
  Dragonhide: [180, 50, 30],
  Wheat: [220, 180, 60],
  Fish: [60, 150, 200],
  Labor: [200, 170, 80],
  AncientFragment: [200, 180, 100],
  Essence: [120, 80, 200],
  Research: [80, 180, 220],
  Lords: [255, 215, 0],
};

const DEFAULT_PRODUCING_COLOR: [number, number, number] = [52, 211, 153]; // emerald fallback
const IDLE_COLOR: [number, number, number] = [251, 191, 36]; // amber

const getResourceColor = (label: string): [number, number, number] => {
  const clean = label.replace(/\s/g, "").replace("'", "");
  return RESOURCE_COLORS[clean] ?? DEFAULT_PRODUCING_COLOR;
};

interface ProductionStatusBadgeProps {
  resourceLabel: string;
  tooltipText: string;
  isProducing: boolean;
  timeRemainingSeconds: number | null;
  totalCount?: number;
  size?: "sm" | "md" | "xs";
  onClick?: () => void;
  resourceId?: ResourcesIds;
  showInputIcons?: boolean;
  className?: string;
  showTooltip?: boolean;
  cornerTopLeft?: string;
  cornerTopRight?: string;
  cornerBottomRight?: string;
}

export const ProductionStatusBadge: FC<ProductionStatusBadgeProps> = ({
  resourceLabel,
  tooltipText,
  isProducing,
  timeRemainingSeconds,
  totalCount = 0,
  size = "sm",
  onClick,
  resourceId,
  showInputIcons = false,
  className,
  showTooltip = true,
  cornerTopLeft,
  cornerTopRight,
  cornerBottomRight,
}) => {
  const effectiveRemaining = timeRemainingSeconds === null ? null : Math.max(timeRemainingSeconds, 0);
  const progressPercent = !isProducing
    ? 0
    : effectiveRemaining === null || effectiveRemaining >= PRODUCTION_DEPLETION_WINDOW_SECONDS
      ? 100
      : clamp((effectiveRemaining / PRODUCTION_DEPLETION_WINDOW_SECONDS) * 100, 0, 100);

  const shouldPulse =
    isProducing && effectiveRemaining !== null && effectiveRemaining <= PRODUCTION_PULSE_THRESHOLD_SECONDS;

  const [r, g, b] = useMemo(
    () => (isProducing ? getResourceColor(resourceLabel) : IDLE_COLOR),
    [isProducing, resourceLabel],
  );

  const preset =
    size === "md"
      ? {
          wrapper: "h-11 w-11",
          iconPadding: "p-2",
          ringOffset: "-inset-[5px]",
          progressOffset: "-inset-[4px]",
          icon: "sm" as const,
          iconRadius: 28,
        }
      : size === "sm"
        ? {
            wrapper: "h-12 w-12",
            iconPadding: "p-2.5",
            ringOffset: "-inset-[6px]",
            progressOffset: "-inset-[5px]",
            icon: "sm" as const,
            iconRadius: 30,
          }
        : {
            wrapper: "h-9 w-9",
            iconPadding: "p-1",
            ringOffset: "-inset-[3px]",
            progressOffset: "-inset-[2.5px]",
            icon: "xs" as const,
            iconRadius: 24,
          };

  const ringThickness = "border";

  const ringStyle = {
    borderColor: `rgba(${r}, ${g}, ${b}, ${isProducing ? 0.8 : 0.7})`,
    boxShadow: `0 0 ${isProducing ? 10 : 8}px rgba(${r}, ${g}, ${b}, ${isProducing ? 0.3 : 0.25})`,
  };

  const progressStyle = isProducing
    ? {
        background: `conic-gradient(rgba(${r}, ${g}, ${b}, 0.55) ${progressPercent}%, rgba(${r}, ${g}, ${b}, 0.08) ${progressPercent}%)`,
      }
    : undefined;

  const resolvedResourceId = showInputIcons ? (resourceId ?? resolveResourceIdFromLabel(resourceLabel)) : undefined;
  const inputDefinitions =
    resolvedResourceId !== undefined ? configManager.getResourceProductionResourceInputs(resolvedResourceId) : [];
  const arcSpan = Math.PI / 2;
  const angleStep = inputDefinitions.length <= 1 ? 0 : arcSpan / (inputDefinitions.length - 1);
  const inputIconPositions = showInputIcons
    ? inputDefinitions.map((input, index) => {
        const angle = Math.PI + index * angleStep;
        const x = Math.cos(angle) * preset.iconRadius;
        const y = Math.sin(angle) * preset.iconRadius;
        return { input, x, y };
      })
    : [];

  return (
    <div
      className={clsx(
        "relative inline-flex items-center justify-center",
        preset.wrapper,
        onClick ? "cursor-pointer" : "",
        className,
      )}
      onClick={onClick}
    >
      {showInputIcons && inputIconPositions.length > 0 && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-[2]">
          {inputIconPositions.map(({ input, x, y }) => (
            <span
              key={`${resolvedResourceId}-${input.resource}`}
              className="absolute flex h-4 w-4 items-center justify-center rounded-full border border-black/30 bg-[#120b07]/90 shadow-[0_0_6px_rgba(0,0,0,0.45)]"
              style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px)` }}
            >
              <ResourceIcon
                resource={ResourcesIds[input.resource]}
                size="xs"
                withTooltip={false}
                className="!h-3 !w-3"
              />
            </span>
          ))}
        </div>
      )}
      {shouldPulse && (
        <span
          className={clsx("absolute pointer-events-none rounded-full animate-ping", preset.ringOffset)}
          style={{ backgroundColor: `rgba(${r}, ${g}, ${b}, 0.2)` }}
        />
      )}
      {isProducing && (
        <span
          className={clsx("absolute pointer-events-none rounded-full", preset.ringOffset)}
          style={{
            background: `rgba(${r}, ${g}, ${b}, 0.06)`,
            animation: "productionBreathe 2.5s ease-in-out infinite",
            boxShadow: `0 0 12px 2px rgba(${r}, ${g}, ${b}, 0.15)`,
          }}
        />
      )}
      <span
        className={clsx(
          "absolute pointer-events-none rounded-full backdrop-blur-sm transition-all duration-700",
          preset.ringOffset,
          ringThickness,
        )}
        style={ringStyle}
      />
      {isProducing && (
        <span
          className={clsx("absolute pointer-events-none rounded-full", preset.progressOffset)}
          style={progressStyle}
        />
      )}
      <div
        className={clsx(
          "relative z-[1] flex items-center justify-center rounded-full border border-gold/[0.08] bg-[#1d1510]/95 transition-shadow duration-700",
          preset.iconPadding,
        )}
        style={{
          boxShadow: isProducing
            ? `0 0 8px rgba(0,0,0,0.45), inset 0 0 6px rgba(${r}, ${g}, ${b}, 0.15)`
            : "0 0 8px rgba(0,0,0,0.45)",
        }}
      >
        <ResourceIcon resource={resourceLabel} size={preset.icon} tooltipText={tooltipText} withTooltip={showTooltip} />
      </div>
      {cornerTopLeft && (
        <span className="absolute -top-1 -left-1 z-10 flex min-w-[14px] items-center justify-center rounded-full bg-black/80 px-1 text-[8px] font-semibold text-gold/90 shadow-md border border-gold/40">
          {cornerTopLeft}
        </span>
      )}
      {cornerTopRight && (
        <span className="absolute -top-1 -right-1 z-10 flex min-w-[18px] items-center justify-center rounded-full bg-black/80 px-1 text-[8px] font-semibold text-gold/90 shadow-md border border-gold/40">
          {cornerTopRight}
        </span>
      )}
      {cornerBottomRight && (
        <span className="absolute -bottom-1 -right-1 z-10 flex min-w-[18px] items-center justify-center rounded-full bg-black/80 px-1 text-[8px] font-semibold text-gold/80 shadow-md border border-gold/30">
          {cornerBottomRight}
        </span>
      )}
      {!cornerTopLeft && !cornerTopRight && !cornerBottomRight && totalCount > 0 && (
        <span className="absolute -top-1 -right-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[9px] font-semibold text-[#2a1f14] shadow-md">
          {totalCount}
        </span>
      )}
    </div>
  );
};
