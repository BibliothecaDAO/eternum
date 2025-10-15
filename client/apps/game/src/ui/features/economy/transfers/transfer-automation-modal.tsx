import { useMemo, useCallback, Suspense, lazy, useState } from "react";
import { useTransferAutomationStore, type TransferAutomationEntry } from "@/hooks/store/use-transfer-automation-store";
import Button from "@/ui/design-system/atoms/button";
import { ResourcesIds, RESOURCE_PRECISION } from "@bibliothecadao/types";
import { ResourceManager, getTotalResourceWeightKg, calculateDonkeysNeeded } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { toast } from "sonner";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useTransferPanelDraftStore } from "@/hooks/store/use-transfer-panel-draft-store";
import { ModalContainer } from "@/ui/shared";
const ProductionTransferAutomationSummary = lazy(() =>
  import("@/ui/features/settlement/production/transfer-automation-panel").then((m) => ({
    default: m.TransferAutomationPanel,
  })),
);

export const TransferAutomationAdvancedModal = ({ onClose }: { onClose?: () => void }) => {
  const entries = useTransferAutomationStore((s) => s.entries);
  const toggleActive = useTransferAutomationStore((s) => s.toggleActive);
  const remove = useTransferAutomationStore((s) => s.remove);
  const update = useTransferAutomationStore((s) => s.update);
  const toggleModal = useUIStore((s) => s.toggleModal);
  const setDraft = useTransferPanelDraftStore((s) => s.setDraft);

  const list = useMemo(() => Object.values(entries).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), [entries]);

  const {
    setup: { components, systemCalls },
    account: { account },
  } = useDojo();

  const runNow = useCallback(
    async (entry: TransferAutomationEntry) => {
      if (!components) return;
      try {
        const sourceId = Number(entry.sourceEntityId);
        const destId = Number(entry.destinationEntityId);
        const rm = new ResourceManager(components as any, sourceId);

        // donkey capacity & build resources using per-resource config (fallback to legacy fields)
        const configMap = new Map<number, { mode: "percent" | "flat"; percent?: number; flatAmount?: number; flatPercent?: number }>();
        if (Array.isArray(entry.resourceConfigs)) {
          for (const c of entry.resourceConfigs as any[]) configMap.set(c.resourceId, c);
        }
        const per = entry.resourceIds
          .map((rid) => {
            const bal = rm.balance(rid);
            const human = Number(bal) / RESOURCE_PRECISION;
            const cfg = configMap.get(rid);
            let amt = 0;
            if (cfg) {
              if (cfg.mode === "flat") {
                if (typeof cfg.flatAmount === "number") {
                  amt = Math.max(0, Math.min(human, Math.floor(cfg.flatAmount)));
                } else if (typeof cfg.flatPercent === "number") {
                  amt = Math.floor((Math.min(90, Math.max(1, cfg.flatPercent)) / 100) * human);
                }
              } else {
                const pct = Math.min(90, Math.max(5, Math.floor(cfg.percent ?? entry.percent ?? 5)));
                amt = Math.floor((pct / 100) * human);
              }
            } else {
              if ((entry.amountMode ?? "percent") === "flat") {
                amt = Math.max(0, Math.min(human, Math.floor(entry.flatAmount ?? 0)));
              } else {
                const pct = Math.min(90, Math.max(5, Math.floor(entry.percent ?? 5)));
                amt = Math.floor((pct / 100) * human);
              }
            }
            return { rid, amt };
          })
          .filter((x) => x.amt > 0);
        if (per.length === 0) {
          toast.warning("Nothing to send now.");
          return;
        }
        const totalKg = getTotalResourceWeightKg(per.map((p) => ({ resourceId: p.rid, amount: p.amt })));
        const need = calculateDonkeysNeeded(totalKg);
        const donkeyBalRaw = rm.balance(ResourcesIds.Donkey);
        const donkeyHuman = Number(donkeyBalRaw) / RESOURCE_PRECISION;
        if (donkeyHuman < need) {
          toast.error("Insufficient donkeys at source.");
          return;
        }

        const resources: (bigint | number)[] = [];
        per.forEach((p) => resources.push(p.rid, BigInt(p.amt * RESOURCE_PRECISION)));

        await systemCalls.send_resources_multiple({
          signer: account,
          calls: [
            {
              sender_entity_id: BigInt(sourceId),
              recipient_entity_id: BigInt(destId),
              resources,
            },
          ],
        });

        update(entry.id, { lastRunAt: Date.now() });
        toast.success("Transfer executed.");
      } catch (e) {
        console.error(e);
        toast.error("Execution failed.");
      }
    },
    [components, systemCalls, account, update],
  );

  const handleEdit = useCallback(
    (entry: TransferAutomationEntry) => {
      setDraft(entry);
      toggleModal(null);
    },
    [setDraft, toggleModal],
  );

  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const q = filter.trim();
    if (!q) return list;
    const isNumeric = /^\d+$/.test(q);
    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return list.filter((e) => {
      const src = e.sourceName ?? e.sourceEntityId;
      const dst = e.destinationName ?? e.destinationEntityId;
      if (isNumeric) return String(src).includes(q) || String(dst).includes(q);
      return norm(String(src)).includes(norm(q)) || norm(String(dst)).includes(norm(q));
    });
  }, [list, filter]);

  return (
    <ModalContainer size="full" title="Scheduled Transfers">
      <div className="p-4 pb-6 h-full overflow-y-auto">
        <div className="mb-3">
          <input
            type="text"
            className="w-full px-2 py-1 text-xs rounded border border-gold/30 bg-black/30 text-gold/80 outline-none"
            placeholder="Filter by source/destination"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        {filtered.length === 0 ? (
          <div className="text-xxs text-gold/60">No scheduled transfers.</div>
        ) : (
          <div className="space-y-2">
            {filtered.map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded border border-gold/20 bg-black/30 p-2">
                <div className="flex flex-col text-xs text-gold/80">
                  <div className="font-semibold text-gold/90">
                    {e.sourceName ?? e.sourceEntityId} → {e.destinationName ?? e.destinationEntityId}
                  </div>
                  <div>
                    {Array.isArray(e.resourceConfigs) && e.resourceConfigs.length > 0
                      ? `${e.resourceConfigs.length} resources (per-resource config)`
                      : ((e.amountMode ?? "percent") === "percent"
                          ? `${e.percent}% of ${e.resourceIds.map((r) => ResourcesIds[r]).join(", ")}`
                          : `Flat ${Math.max(0, Math.floor(e.flatAmount ?? 0)).toLocaleString()} of ${e.resourceIds.map((r) => ResourcesIds[r]).join(", ")}`)}
                    {e.active ? ` • every ${e.intervalMinutes}m` : " • paused"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="xs" variant="outline" onClick={() => toggleActive(e.id, !e.active)}>
                    {e.active ? "Pause" : "Resume"}
                  </Button>
                  <Button size="xs" onClick={() => runNow(e)}>Run now</Button>
                  <Button size="xs" variant="outline" onClick={() => handleEdit(e)}>Edit</Button>
                  <Button size="xs" variant="danger" onClick={() => remove(e.id)}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModalContainer>
  );
};
