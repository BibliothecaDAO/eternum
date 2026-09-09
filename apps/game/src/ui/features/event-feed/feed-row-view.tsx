import { TransactionItem } from "@/ui/components/transaction-center/transaction-item";
import { useWorldSlicesStore } from "@/hooks/store/use-world-slices-store";
import { useNavigateToMapView } from "@/hooks/helpers/use-navigate";
import { Position } from "@bibliothecadao/eternum";
import { getExplorerTxUrl, getStatusColor } from "@/ui/components/transaction-center/types";
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
export const FeedRowView = ({ row, compact = false }: { row: FeedRow; compact?: boolean }) => {
  if (row.kind === "transaction")
    return compact ? (
      <TransactionFeedRow row={row} />
    ) : (
      <TransactionItem transaction={row.transaction} isStuck={row.isStuck} />
    );
  if (row.kind === "arrival") return <ArrivalFeedRow row={row} />;
  if (row.notice.kind === "custom") return <div className="px-3 py-2">{row.notice.title}</div>;
  return (
    <div className="flex flex-col gap-0.5 px-3 py-2 font-sans text-[11px] font-normal">
      <span className={cn("font-normal", NOTICE_TONE[row.notice.kind])}>{row.notice.title}</span>
      {row.notice.description && <span className="text-gold/70">{row.notice.description}</span>}
    </div>
  );
};

const ArrivalFeedRow = ({ row }: { row: Extract<FeedRow, { kind: "arrival" }> }) => {
  const structure = useWorldSlicesStore((state) =>
    state.structures.find((entry) => entry.entity_id === row.structureEntityId),
  );
  const navigate = useNavigateToMapView();
  const jumpToArrival = () => {
    if (structure) navigate(new Position({ x: structure.base.coord_x, y: structure.base.coord_y }));
  };
  const arrived = row.remainingSeconds <= 0;
  return (
    <button
      type="button"
      disabled={!structure}
      onClick={jumpToArrival}
      className="flex w-full items-center gap-2 px-3 py-2 text-left !font-sans !text-[11px] normal-case tracking-normal text-gold enabled:hover:bg-gold/10"
    >
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
    </button>
  );
};

function TransactionFeedRow({ row }: { row: Extract<FeedRow, { kind: "transaction" }> }) {
  const { transaction, isStuck } = row;
  const href = getExplorerTxUrl(transaction.hash);
  return (
    <a
      href={href ?? undefined}
      target="_blank"
      rel="noreferrer"
      title={transaction.errorMessage ?? transaction.hash}
      className="flex items-center gap-2 px-3 py-2 !font-sans !text-[11px] normal-case tracking-normal hover:bg-gold/10"
    >
      <span className="min-w-0 flex-1 truncate text-gold">{transaction.description}</span>
      <span className={cn("shrink-0", getStatusColor(transaction.status, isStuck))}>
        {isStuck
          ? "Stuck"
          : transaction.status === "reverted"
            ? "Failed"
            : transaction.status === "success"
              ? "Done"
              : "Pending"}
      </span>
    </a>
  );
}
