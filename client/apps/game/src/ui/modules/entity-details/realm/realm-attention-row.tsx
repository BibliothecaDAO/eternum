import { cn } from "@/ui/design-system/atoms/lib/utils";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
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

type RealmAttentionRowProps = {
  starvingCount: number;
  emptyGuardSlots: number;
  onManageGuards?: () => void;
};

export const RealmAttentionRow = memo(({ starvingCount, emptyGuardSlots, onManageGuards }: RealmAttentionRowProps) => {
  if (starvingCount === 0 && emptyGuardSlots === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded border border-gold/15 bg-black/30 px-2 py-1.5">
      <span className="text-[9px] uppercase tracking-[0.2em] text-gold/45">Attention</span>
      {starvingCount > 0 && (
        <AttentionChip
          icon={AlertTriangle}
          tone="danger"
          label={`${starvingCount} starving`}
          title="Production buildings that are starving — see the highlighted badges below"
        />
      )}
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
});

RealmAttentionRow.displayName = "RealmAttentionRow";
