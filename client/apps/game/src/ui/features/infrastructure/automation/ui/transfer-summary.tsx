import clsx from "clsx";
import React from "react";

import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { AutomationOrder, TransferMode } from "@/hooks/store/use-automation-store";
import { ResourcesIds } from "@bibliothecadao/types";
import { LucideArrowRight, X } from "lucide-react";

import { formatMinutes } from "@/shared/lib/time";

interface TransferSummaryProps {
  orders: AutomationOrder[];
  sourceName?: string;
  isPaused: boolean;
  onSelect: (order: AutomationOrder) => void;
  onRemove: (orderId: string) => void;
  onClone?: (order: AutomationOrder) => void;
  activeOrderId?: string | null;
  isLinkActive?: boolean;
}

const buildScheduleLabel = (order: AutomationOrder) => {
  const mode = order.transferMode ?? TransferMode.Recurring;
  switch (mode) {
    case TransferMode.Recurring:
      return `Recurring • ${formatMinutes(order.transferInterval ?? 60)}`;
    case TransferMode.MaintainStock:
      return `Maintain stock above ${order.transferThreshold?.toLocaleString() ?? "?"}`;
    case TransferMode.DepletionTransfer:
      return `Shift surplus above ${order.transferThreshold?.toLocaleString() ?? "?"}`;
    default:
      return "Immediate transfer";
  }
};

export const TransferSummary: React.FC<TransferSummaryProps> = ({
  orders,
  sourceName,
  isPaused,
  onSelect,
  onRemove,
  onClone,
  activeOrderId,
  isLinkActive = false,
}) => {
  if (orders.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gold/25 bg-black/20 px-4 py-6 text-center text-xs text-gold/60">
        No automated transfers yet. Select a destination and add resources to build a route.
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "relative overflow-hidden rounded-xl border bg-gradient-to-r from-black/40 via-black/30 to-black/40 px-4 py-5 transition-shadow",
        isLinkActive ? "border-gold/40 shadow-[0_0_18px_rgba(217,195,122,0.25)]" : "border-gold/20",
      )}
    >
      {isPaused && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70">
          <div className="rounded-md border border-red/40 bg-red/20 px-4 py-2 text-sm font-semibold uppercase tracking-widest text-red-200">
            Automation Paused
          </div>
        </div>
      )}

      <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-gold/50">
        {sourceName && <span className="font-semibold text-gold/80">{sourceName}</span>}
        <LucideArrowRight className="h-3 w-3 text-gold/40" />
        <span>Transfer Links</span>
      </div>

      <div className="flex flex-wrap gap-3">
        {orders.map((order) => {
          const isActive = activeOrderId === order.id;
          const resources = order.transferResources ?? [];

          return (
            <button
              key={order.id}
              type="button"
              onClick={() => onSelect(order)}
              className={`relative flex min-w-[220px] max-w-full flex-col gap-2 rounded-lg border px-3 py-3 text-left shadow-md transition-all ${
                isActive ? "border-gold/80 bg-gold/10" : "border-gold/25 bg-black/30 hover:border-gold/60"
              } ${isPaused ? "pointer-events-none opacity-60" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gold">
                    <span className="truncate">{order.targetEntityName || order.targetEntityId}</span>
                    <LucideArrowRight className="h-3 w-3 text-gold/60" />
                    <span className="flex gap-1">
                      {resources.slice(0, 3).map((resource) => (
                        <span
                          key={`${order.id}-${resource.resourceId}`}
                          className="flex items-center gap-1 rounded-full border border-gold/25 bg-black/40 px-2 py-0.5 text-[11px] text-gold/80"
                        >
                          <ResourceIcon resource={ResourcesIds[resource.resourceId]} size="xs" />
                          {resource.amount.toLocaleString()}
                        </span>
                      ))}
                      {resources.length > 3 && (
                        <span className="rounded-full border border-gold/25 bg-black/40 px-2 py-0.5 text-[11px] text-gold/60">
                          +{resources.length - 3} more
                        </span>
                      )}
                    </span>
                  </div>
                  <span className="text-[11px] uppercase tracking-wide text-gold/50">{buildScheduleLabel(order)}</span>
                </div>

                <div className="flex flex-col items-end gap-2">
                  {onClone && (
                    <button
                      type="button"
                      className="text-[11px] uppercase tracking-wide text-gold/60 transition hover:text-gold disabled:opacity-40"
                      onClick={(event) => {
                        event.stopPropagation();
                        onClone(order);
                      }}
                      disabled={isPaused}
                    >
                      Clone
                    </button>
                  )}
                  <button
                    type="button"
                    className="text-gold/60 transition hover:text-red disabled:opacity-50"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemove(order.id);
                    }}
                    disabled={isPaused}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
