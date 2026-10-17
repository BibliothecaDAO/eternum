import { type FC } from "react";

import clsx from "clsx";

import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { formatTimeRemaining } from "@/ui/features/economy/resources/entity-resource-table/utils";
import { configManager } from "@bibliothecadao/eternum";
import { ResourcesIds } from "@bibliothecadao/types";

const PRODUCTION_DEPLETION_WINDOW_SECONDS = 10 * 60;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const PRODUCING_COLOR: [number, number, number] = [52, 211, 153]; // emerald
const IDLE_COLOR: [number, number, number] = [251, 191, 36]; // amber

/**
 * The one resource ring, wherever a resource shows with its production (the holding card, the structure details, the
 * Production and Build windows): its painting in a ring that glows and empties as production runs, how many buildings
 * make it on the top-left badge, how much is held on the bottom rim, and while it produces, the time left on the right.
 * Its hover names the resource only; the badges say the rest.
 */
interface ProductionStatusBadgeProps {
  resource: ResourcesIds;
  isProducing: boolean;
  timeRemainingSeconds: number | null;
  /** How many buildings make it: the top-left badge, none at zero. */
  buildings?: number;
  /** How much is held, already formatted ("12.4K"): the bottom rim. */
  amount?: string;
  size?: "sm" | "md" | "xs";
  onClick?: () => void;
  showInputIcons?: boolean;
  className?: string;
  showTooltip?: boolean;
  /** Changes when the caller wants one accrual sweep around the token; unchanged keys never replay it. */
  accrualKey?: number;
}

export const ProductionStatusBadge: FC<ProductionStatusBadgeProps> = ({
  resource,
  isProducing,
  timeRemainingSeconds,
  buildings = 0,
  amount,
  size = "sm",
  onClick,
  showInputIcons = false,
  className,
  showTooltip = true,
  accrualKey,
}) => {
  const effectiveRemaining = timeRemainingSeconds === null ? null : Math.max(timeRemainingSeconds, 0);
  const progressPercent = !isProducing
    ? 0
    : effectiveRemaining === null || effectiveRemaining >= PRODUCTION_DEPLETION_WINDOW_SECONDS
      ? 100
      : clamp((effectiveRemaining / PRODUCTION_DEPLETION_WINDOW_SECONDS) * 100, 0, 100);

  const [r, g, b] = isProducing ? PRODUCING_COLOR : IDLE_COLOR;

  const preset =
    size === "md"
      ? {
          wrapper: "h-11 w-11",
          iconPadding: "p-0.5",
          ringOffset: "-inset-[5px]",
          progressOffset: "-inset-[4px]",
          icon: "lg" as const,
          iconRadius: 28,
        }
      : size === "sm"
        ? {
            wrapper: "h-12 w-12",
            iconPadding: "p-1",
            ringOffset: "-inset-[6px]",
            progressOffset: "-inset-[5px]",
            icon: "lg" as const,
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

  const resolvedResourceId = showInputIcons ? resource : undefined;
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
              <ResourceIcon resource={input.resource} size="xs" withTooltip={false} className="!h-3 !w-3" />
            </span>
          ))}
        </div>
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
        <ResourceIcon resource={resource} size={preset.icon} withTooltip={showTooltip} />
      </div>
      {buildings > 0 && (
        <span className="absolute -left-1 -top-1 z-10 flex h-4 min-w-4 items-center justify-center rounded-full border border-gold/40 bg-black/85 px-1 text-[10px] font-semibold leading-none text-gold/90 shadow-md">
          {buildings}
        </span>
      )}
      {accrualKey !== undefined && accrualKey > 0 && (
        <span
          key={accrualKey}
          aria-hidden
          className={clsx("absolute pointer-events-none rounded-full accrual-sweep", preset.progressOffset)}
        />
      )}
      {/* Whole minutes only: automation refills inputs every minute, so under a minute is a topped-up resource's
          normal state, not a warning, and shows no badge. */}
      {isProducing && effectiveRemaining !== null && effectiveRemaining >= 60 && (
        <span className="absolute -right-2 top-1/2 z-10 flex h-4 -translate-y-1/2 items-center justify-center whitespace-nowrap rounded-full border border-gold/40 bg-black/85 px-1 text-[10px] font-semibold leading-none tabular-nums text-gold/90 shadow-md">
          {formatTimeRemaining(Math.ceil(effectiveRemaining / 60) * 60)}
        </span>
      )}
      {amount && (
        <span className="absolute -bottom-1.5 left-1/2 z-10 flex h-4 -translate-x-1/2 items-center justify-center whitespace-nowrap rounded-full border border-gold/40 bg-black/85 px-1 text-[10px] font-semibold leading-none tabular-nums text-gold/90 shadow-md">
          {amount}
        </span>
      )}
    </div>
  );
};
