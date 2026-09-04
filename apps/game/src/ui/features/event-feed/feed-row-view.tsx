import { TransactionItem } from "@/ui/components/transaction-center/transaction-item";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { findResourceById } from "@bibliothecadao/types";
import type { FeedRow } from "./event-feed-rows";

const NOTICE_TONE: Record<string, string> = {
  info: "text-gold",
  success: "text-emerald-300",
  error: "text-danger",
  warning: "text-orange",
  custom: "text-gold",
};

const formatCountdown = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
};

/** One feed row, whatever its source. */
export const FeedRowView = ({ row }: { row: FeedRow }) => {
  if (row.kind === "transaction") return <TransactionItem transaction={row.transaction} isStuck={row.isStuck} />;
  if (row.kind === "arrival") {
    const arrived = row.remainingSeconds <= 0;
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-gold">
        <span className="flex items-center gap-1">
          {row.resources.slice(0, 4).map((resource) => (
            <ResourceIcon
              key={resource.resourceId}
              resource={findResourceById(resource.resourceId)?.trait ?? ""}
              size="xs"
              withTooltip={false}
            />
          ))}
        </span>
        <span className="min-w-0 flex-1 truncate">Caravan to structure #{row.structureEntityId}</span>
        <span className={cn("shrink-0 tabular-nums", arrived ? "text-emerald-300" : "text-gold/70")}>
          {arrived ? "Arrived" : formatCountdown(row.remainingSeconds)}
        </span>
      </div>
    );
  }
  if (row.notice.kind === "custom") return <div className="px-3 py-2">{row.notice.title}</div>;
  return (
    <div className="flex flex-col gap-0.5 px-3 py-2 text-xs">
      <span className={cn("font-semibold", NOTICE_TONE[row.notice.kind])}>{row.notice.title}</span>
      {row.notice.description && <span className="text-gold/70">{row.notice.description}</span>}
    </div>
  );
};
