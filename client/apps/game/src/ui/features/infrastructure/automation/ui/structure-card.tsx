import clsx from "clsx";
import { Sparkles } from "lucide-react";
import { memo, useMemo, type ReactNode } from "react";

import { formatMinutes } from "@/shared/lib/time";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { ProductionStatusBadge } from "@/ui/shared";

import type { SelectedEntity } from "../lib/transfer-types";
import type { StructurePreview } from "../lib/use-structure-preview";

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

const balanceFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const formatPerHour = (value: number) => {
  if (!Number.isFinite(value) || value === 0) {
    return null;
  }

  const absolute = Math.abs(value);
  const formatted = absolute >= 100 ? balanceFormatter.format(absolute) : numberFormatter.format(absolute);

  return `${value > 0 ? "+" : "-"}${formatted}/h`;
};

const formatBalance = (value: number) => balanceFormatter.format(Math.max(value, 0));

interface StructureCardProps {
  structure: SelectedEntity;
  preview: StructurePreview;
  isActive?: boolean;
  isDisabled?: boolean;
  tone?: "source" | "destination";
  onSelect?: () => void;
  headerAction?: ReactNode;
  description?: string;
  footer?: ReactNode;
}

export const StructureCard = memo(
  ({
    structure,
    preview,
    isActive = false,
    isDisabled = false,
    tone = "source",
    onSelect,
    headerAction,
    description,
    footer,
  }: StructureCardProps) => {
    const accentRing = tone === "source" ? "border-emerald-400/70" : "border-sky-400/70";
    const accentGlow =
      tone === "source" ? "shadow-[0_0_18px_rgba(16,185,129,0.25)]" : "shadow-[0_0_18px_rgba(56,189,248,0.25)]";
    const clickable = Boolean(onSelect) && !isDisabled;

    const overflowTooltip = useMemo(() => {
      if (preview.balanceOverflow.length === 0) {
        return "";
      }

      return preview.balanceOverflow.map((item) => `${item.label}: ${formatBalance(item.balance)}`).join("\n");
    }, [preview.balanceOverflow]);

    return (
      <div
        role={clickable ? "button" : undefined}
        tabIndex={clickable ? 0 : -1}
        onClick={clickable ? onSelect : undefined}
        onKeyDown={(event) => {
          if (!clickable) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect?.();
          }
        }}
        className={clsx(
          "relative w-full rounded-xl border border-gold/15 bg-black/30 p-4 transition-all duration-200",
          clickable && "cursor-pointer hover:border-gold/40 hover:bg-black/40",
          isActive && clsx("border-gold/70 bg-black/50", accentGlow, accentRing),
          isDisabled && "pointer-events-none opacity-60",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-gold truncate" title={structure.name}>
                {structure.name}
              </h3>
              <span className="rounded-full border border-gold/20 bg-gold/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold/70">
                {preview.meta.typeLabel}
              </span>
            </div>
            <p className="mt-1 text-xs text-gold/50">ID {structure.entityId}</p>
            {description && <p className="mt-2 text-xs text-gold/70">{description}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {preview.meta.hasWonderBonus && (
              <span
                className="flex items-center gap-1 rounded-md bg-gold/15 px-2 py-1 text-[10px] font-semibold uppercase text-gold"
                title={`Wonder bonus active${preview.meta.wonderBonusPercent ? ` • +${preview.meta.wonderBonusPercent}%` : ""}`}
              >
                <Sparkles className="h-3 w-3" /> Wonder
              </span>
            )}
            {preview.meta.activeRelicCount > 0 && (
              <span
                className="rounded-md bg-purple-500/20 px-2 py-1 text-[10px] font-semibold uppercase text-purple-200"
                title={`${preview.meta.activeRelicCount} relic${preview.meta.activeRelicCount === 1 ? "" : "s"} reinforcing production`}
              >
                {preview.meta.activeRelicCount} Relic{preview.meta.activeRelicCount === 1 ? "" : "s"}
              </span>
            )}
            {headerAction}
          </div>
        </div>

        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-widest text-gold/40">Active Production</div>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            {preview.resources.length === 0 && (
              <span className="text-xs text-gold/60">Idle — no current throughput</span>
            )}
            {preview.resources.map((resource) => {
              const rate = formatPerHour(resource.perHour);
              const timeLabel = resource.timeRemainingMinutes ? formatMinutes(resource.timeRemainingMinutes) : null;
              const statusLabel = resource.isProducing ? (timeLabel ? `${timeLabel} remaining` : "Continuous") : "Idle";
              const buildingLabel = resource.buildingCount
                ? `${resource.buildingCount} building${resource.buildingCount === 1 ? "" : "s"}`
                : null;
              const tooltipText = [resource.label, buildingLabel, rate, statusLabel].filter(Boolean).join(" • ");
              const timeRemainingSeconds = resource.timeRemainingSeconds;

              return (
                <div key={`${structure.entityId}-${resource.resourceId}`} className="flex flex-col items-center gap-1">
                  <ProductionStatusBadge
                    resourceLabel={resource.label}
                    tooltipText={tooltipText}
                    isProducing={resource.isProducing}
                    timeRemainingSeconds={timeRemainingSeconds}
                    totalCount={resource.buildingCount}
                    size="xs"
                  />
                  <span className="text-[10px] text-emerald-100/80">{statusLabel}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 border-t border-gold/15 pt-3">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-gold/40">
            <span>Inventory Snapshot</span>
            {footer}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {preview.topBalances.length === 0 && <span className="text-xs text-gold/60">No stored resources</span>}
            {preview.topBalances.map((resource) => {
              return (
                <div
                  key={`${structure.entityId}-balance-${resource.resourceId}`}
                  className="flex items-center gap-2 rounded-lg border border-gold/20 bg-gold/10 px-2 py-1"
                >
                  <ResourceIcon resource={resource.label} size="xs" />
                  <div className="flex flex-col leading-tight text-xs text-gold/80">
                    <span className="font-semibold text-gold">{formatBalance(resource.balance)}</span>
                  </div>
                </div>
              );
            })}
            {preview.balanceOverflow.length > 0 && (
              <span
                className="rounded-full border border-gold/20 bg-black/40 px-3 py-1 text-[10px] font-semibold uppercase text-gold/60"
                title={overflowTooltip}
              >
                +{preview.balanceOverflow.length} more
              </span>
            )}
          </div>
        </div>
      </div>
    );
  },
);

StructureCard.displayName = "StructureCard";
