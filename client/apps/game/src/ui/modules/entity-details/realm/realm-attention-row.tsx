import { cn } from "@/ui/design-system/atoms/lib/utils";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { BuildingType, getBuildingFromResource, ResourcesIds } from "@bibliothecadao/types";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import Hammer from "lucide-react/dist/esm/icons/hammer";
import ShieldAlert from "lucide-react/dist/esm/icons/shield-alert";
import { memo } from "react";

type AttentionChipProps = {
  icon: typeof AlertTriangle;
  label: string;
  tone: "danger" | "warning";
  onClick?: () => void;
  title?: string;
};

const TONE_CLASSES: Record<AttentionChipProps["tone"], string> = {
  danger: "border-danger/40 bg-danger/10 text-danger hover:bg-danger/20",
  warning: "border-amber-400/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20",
};

const AttentionChip = ({ icon: Icon, label, tone, onClick, title }: AttentionChipProps) => {
  const baseClasses = cn(
    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition",
    TONE_CLASSES[tone],
    onClick ? "cursor-pointer" : "cursor-default",
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={baseClasses} title={title}>
        <Icon className="h-3 w-3" />
        <span>{label}</span>
      </button>
    );
  }

  return (
    <span className={baseClasses} title={title}>
      <Icon className="h-3 w-3" />
      <span>{label}</span>
    </span>
  );
};

const prettifyAttentionResourceLabel = (resourceId: ResourcesIds) =>
  (ResourcesIds[resourceId] ?? String(resourceId)).replace(/([a-z])([A-Z])/g, "$1 $2");

const summarizeStarvingReason = (resourceId: ResourcesIds, resourceLabel: string, reason?: string) => {
  if (!reason) {
    return `${resourceLabel} needs attention`;
  }

  const rawResourceLabel = ResourcesIds[resourceId] ?? String(resourceId);
  const strippedReason = reason
    .replace(new RegExp(`^${rawResourceLabel}\\s*`, "i"), "")
    .replace(new RegExp(`^${resourceLabel}\\s*`, "i"), "")
    .replace(/^:\s*/, "")
    .trim();

  if (strippedReason === "waiting for recipe inputs") {
    return `${resourceLabel} waiting for inputs`;
  }

  if (strippedReason === "has no active production building") {
    return `${resourceLabel} needs an active producer`;
  }

  return `${resourceLabel} ${strippedReason}`.trim();
};

export const buildStarvingResourceAttentionLabel = (resourceId: ResourcesIds, reason?: string) => {
  const resourceLabel = prettifyAttentionResourceLabel(resourceId);
  return summarizeStarvingReason(resourceId, resourceLabel, reason);
};

type StarvingResourceChipProps = {
  resourceId: ResourcesIds;
  reason?: string;
  canBuild: boolean;
  onBuild?: () => void;
};

const StarvingResourceChip = ({ resourceId, reason, canBuild, onBuild }: StarvingResourceChipProps) => {
  const resourceLabel = prettifyAttentionResourceLabel(resourceId);
  const label = buildStarvingResourceAttentionLabel(resourceId, reason);
  const title = reason ? `${resourceLabel} starving — ${reason}` : `${resourceLabel} starving`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-danger/40 bg-danger/10 px-1.5 py-0.5 text-[10px] font-semibold text-danger",
      )}
      title={title}
    >
      <AlertTriangle className="h-3 w-3" />
      <ResourceIcon resource={resourceLabel} size="xs" withTooltip={false} />
      <span>{label}</span>
      {canBuild && onBuild && (
        <button
          type="button"
          onClick={onBuild}
          className="ml-0.5 inline-flex items-center rounded border border-danger/40 bg-danger/20 px-1 py-[1px] text-[9px] uppercase tracking-wide hover:bg-danger/40"
          title={`Build a ${resourceLabel} producer`}
          aria-label={`Build ${resourceLabel} producer`}
        >
          <Hammer className="h-2.5 w-2.5" />
          <span className="ml-0.5">Build</span>
        </button>
      )}
    </span>
  );
};

type RealmAttentionRowProps = {
  starvedResources: Map<ResourcesIds, string>;
  emptyGuardSlots: number;
  onManageGuards?: () => void;
  onBuildForResource?: (resourceId: ResourcesIds) => void;
};

export const RealmAttentionRow = memo(
  ({ starvedResources, emptyGuardSlots, onManageGuards, onBuildForResource }: RealmAttentionRowProps) => {
    const starvingEntries = Array.from(starvedResources.entries());
    if (starvingEntries.length === 0 && emptyGuardSlots === 0) {
      return null;
    }

    return (
      <div className="flex flex-wrap items-center gap-1.5 rounded border border-gold/15 bg-black/30 px-2 py-1.5">
        <span className="text-[9px] uppercase tracking-[0.2em] text-gold/45">Attention</span>
        {starvingEntries.map(([resourceId, reason]) => {
          const canBuild = onBuildForResource ? getBuildingFromResource(resourceId) !== BuildingType.None : false;
          return (
            <StarvingResourceChip
              key={resourceId}
              resourceId={resourceId}
              reason={reason}
              canBuild={canBuild}
              onBuild={canBuild && onBuildForResource ? () => onBuildForResource(resourceId) : undefined}
            />
          );
        })}
        {emptyGuardSlots > 0 && (
          <AttentionChip
            icon={ShieldAlert}
            tone="warning"
            label={`${emptyGuardSlots} guard ${emptyGuardSlots === 1 ? "slot" : "slots"} open`}
            onClick={onManageGuards}
            title="Open the guard creation popup"
          />
        )}
      </div>
    );
  },
);

RealmAttentionRow.displayName = "RealmAttentionRow";
