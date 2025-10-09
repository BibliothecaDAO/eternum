import { isAutomationResourceBlocked, useAutomationStore } from "@/hooks/store/use-automation-store";
import { REALM_PRESETS, RealmPresetId } from "@/utils/automation-presets";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { ResourcesIds } from "@bibliothecadao/types";
import clsx from "clsx";
import { useMemo } from "react";

const formatRelative = (timestamp?: number) => {
  if (!timestamp) return "—";
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

const formatAmount = (value: number) => Math.round(value).toLocaleString();

type TransferRow = {
  resourceId: ResourcesIds;
  amount: number;
};

type RealmTransferCard = {
  id: string;
  name: string;
  type: string;
  lastRun?: number;
  presetId: RealmPresetId;
  totalCycles: number;
  outgoing: TransferRow[];
  incoming: TransferRow[];
  skipped: number;
};

export const TransferAutomationPanel = () => {
  const automationRealms = useAutomationStore((state) => state.realms);

  const transferCards = useMemo<RealmTransferCard[]>(() => {
    return Object.values(automationRealms)
      .map((realm) => {
        const exec = realm.lastExecution;
        if (!exec) return null;

        const totals = new Map<number, { consumed: number; produced: number }>();

        Object.entries(exec.consumptionByResource ?? {}).forEach(([key, raw]) => {
          const resourceId = Number(key);
          const consumed = Number(raw) || 0;
          if (!totals.has(resourceId)) {
            totals.set(resourceId, { consumed: 0, produced: 0 });
          }
          totals.get(resourceId)!.consumed += consumed;
        });

        Object.entries(exec.outputsByResource ?? {}).forEach(([key, raw]) => {
          const resourceId = Number(key);
          const produced = Number(raw) || 0;
          if (!totals.has(resourceId)) {
            totals.set(resourceId, { consumed: 0, produced: 0 });
          }
          totals.get(resourceId)!.produced += produced;
        });

        const incoming: TransferRow[] = [];
        const outgoing: TransferRow[] = [];
        const entityType = realm.entityType ?? "realm";

        totals.forEach(({ consumed, produced }, key) => {
          const resourceId = key as ResourcesIds;
          // Ignore unknown or blocked resources
          if (ResourcesIds[resourceId] === undefined) return;
          if (isAutomationResourceBlocked(resourceId, entityType)) return;
          const net = produced - consumed;
          if (net > 0) {
            incoming.push({ resourceId, amount: net });
          } else if (net < 0) {
            outgoing.push({ resourceId, amount: Math.abs(net) });
          }
        });

        incoming.sort((a, b) => b.amount - a.amount);
        outgoing.sort((a, b) => b.amount - a.amount);

        const totalCycles = [...(exec.resourceToResource ?? []), ...(exec.laborToResource ?? [])].reduce(
          (sum, entry) => sum + (entry?.cycles ?? 0),
          0,
        );

        return {
          id: realm.realmId,
          name: realm.realmName ?? `Realm ${realm.realmId}`,
          type: realm.entityType ?? "realm",
          lastRun: exec.executedAt,
          presetId: (realm.presetId ?? "custom") as RealmPresetId,
          totalCycles,
          outgoing,
          incoming,
          skipped: exec.skipped?.length ?? 0,
        } satisfies RealmTransferCard;
      })
      .filter((card): card is RealmTransferCard => card !== null && (card.outgoing.length || card.incoming.length));
  }, [automationRealms]);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h4 className="text-sm font-semibold text-gold">Transfer Automation</h4>
        <p className="text-[11px] text-gold/60">
          Shows net resources moved by automation. Positive values indicate incoming transfers; negative values indicate
          resources spent.
        </p>
      </div>

      {transferCards.length === 0 ? (
        <div className="rounded border border-gold/20 bg-black/15 p-3 text-xs text-gold/70">
          No automated transfers detected yet. Configure automation or rerun to populate this view.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {transferCards.map((card) => (
            <div key={card.id} className="rounded border border-gold/10 bg-black/20 p-3 text-xs text-gold/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gold/90">{card.name}</span>
                <span className="text-[10px] uppercase tracking-wide text-gold/50">{card.type}</span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-gold/60">
                <span>
                  Preset: {card.presetId === "custom" ? "Custom" : REALM_PRESETS.find((p) => p.id === card.presetId)?.label}
                </span>
                <span>{formatRelative(card.lastRun)}</span>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <div className="text-[10px] uppercase text-gold/50 mb-1">Outgoing</div>
                  {card.outgoing.length === 0 ? (
                    <span className="text-[11px] text-gold/50">—</span>
                  ) : (
                    card.outgoing.slice(0, 6).map((entry) => (
                      <div key={`out-${card.id}-${entry.resourceId}`} className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-gold/80">
                          <ResourceIcon resource={ResourcesIds[entry.resourceId]} size="xs" />
                          <span>{ResourcesIds[entry.resourceId]}</span>
                        </div>
                        <span className="text-gold/60">-{formatAmount(entry.amount)}</span>
                      </div>
                    ))
                  )}
                </div>

                <div>
                  <div className="text-[10px] uppercase text-gold/50 mb-1">Incoming</div>
                  {card.incoming.length === 0 ? (
                    <span className="text-[11px] text-gold/50">—</span>
                  ) : (
                    card.incoming.slice(0, 6).map((entry) => (
                      <div key={`in-${card.id}-${entry.resourceId}`} className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-gold/80">
                          <ResourceIcon resource={ResourcesIds[entry.resourceId]} size="xs" />
                          <span>{ResourcesIds[entry.resourceId]}</span>
                        </div>
                        <span className="text-gold/60">+{formatAmount(entry.amount)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-gold/60">
                <span>Cycles: {card.totalCycles}</span>
                <span>Skipped: {card.skipped}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
