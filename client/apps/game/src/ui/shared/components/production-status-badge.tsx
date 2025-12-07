import type { FC } from "react";

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

  const ringClasses = isProducing
    ? "border-emerald-400/80 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
    : "border-amber-400/70 shadow-[0_0_8px_rgba(251,191,36,0.25)]";

  const progressStyle = isProducing
    ? {
        background: `conic-gradient(rgba(52, 211, 153, 0.55) ${progressPercent}%, rgba(52, 211, 153, 0.08) ${progressPercent}%)`,
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
          className={clsx(
            "absolute pointer-events-none rounded-full bg-emerald-400/20",
            preset.ringOffset,
            "animate-ping",
          )}
        />
      )}
      <span
        className={clsx(
          "absolute pointer-events-none rounded-full backdrop-blur-sm",
          preset.ringOffset,
          ringThickness,
          ringClasses,
        )}
      />
      {isProducing && (
        <span className={clsx("absolute pointer-events-none rounded-full", preset.progressOffset)} style={progressStyle} />
      )}
      <div
        className={clsx(
          "relative z-[1] flex items-center justify-center rounded-full border border-gold/[0.08] bg-[#1d1510]/95",
          preset.iconPadding,
          "shadow-[0_0_8px_rgba(0,0,0,0.45)]",
        )}
      >
        <ResourceIcon
          resource={resourceLabel}
          size={preset.icon}
          tooltipText={tooltipText}
          withTooltip={showTooltip}
        />
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
