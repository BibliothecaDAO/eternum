import { useMemo, useCallback, useState } from "react";
import { useTransferAutomationStore, type TransferAutomationEntry } from "@/hooks/store/use-transfer-automation-store";
import Button from "@/ui/design-system/atoms/button";
import { ClientComponents, ResourcesIds, RESOURCE_PRECISION } from "@bibliothecadao/types";
import { ResourceManager, getTotalResourceWeightKg, calculateDonkeysNeeded } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { toast } from "sonner";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useTransferPanelDraftStore } from "@/hooks/store/use-transfer-panel-draft-store";
import { ModalContainer } from "@/ui/shared";
const formatResourceSummary = (entry: TransferAutomationEntry): string => {
  if (Array.isArray(entry.resourceConfigs) && entry.resourceConfigs.length > 0) {
    return entry.resourceConfigs
      .map((cfg) => {
        const amount = Math.max(0, Math.floor(cfg.amount ?? 0));
        return `${ResourcesIds[cfg.resourceId] ?? cfg.resourceId} ${amount.toLocaleString()}`;
      })
      .join(", ");
  }
  return entry.resourceIds.map((rid) => ResourcesIds[rid] ?? `Resource ${rid}`).join(", ");
};

export const TransferAutomationAdvancedModal = () => {
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
        const rm = new ResourceManager(components as ClientComponents, sourceId);

        const configMap = new Map<number, number>();
        if (Array.isArray(entry.resourceConfigs)) {
          entry.resourceConfigs.forEach((cfg) => {
            configMap.set(cfg.resourceId, Math.max(0, Math.floor(cfg.amount ?? 0)));
          });
        }
        const per = entry.resourceIds
          .map((rid) => {
            const desired = Math.max(0, Math.floor(configMap.get(rid) ?? 0));
            if (desired <= 0) return null;
            const bal = rm.balance(rid);
            const human = Math.max(0, Math.floor(Number(bal) / RESOURCE_PRECISION));
            const amt = Math.max(0, Math.min(human, desired));
            return amt > 0 ? { rid, amt } : null;
          })
          .filter((x): x is { rid: ResourcesIds; amt: number } => Boolean(x));
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
  const [isRunningAll, setIsRunningAll] = useState(false);

  const filtered = useMemo(() => {
    const q = filter.trim();
    if (!q) return list;
    const isNumeric = /^\d+$/.test(q);
    const norm = (s: string) =>
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    return list.filter((e) => {
      const src = e.sourceName ?? e.sourceEntityId;
      const dst = e.destinationName ?? e.destinationEntityId;
      if (isNumeric) return String(src).includes(q) || String(dst).includes(q);
      return norm(String(src)).includes(norm(q)) || norm(String(dst)).includes(norm(q));
    });
  }, [list, filter]);

  const pauseAll = useCallback(() => {
    let paused = 0;
    Object.values(entries).forEach((entry) => {
      if (entry.active) {
        paused += 1;
        toggleActive(entry.id, false);
      }
    });
    if (paused > 0) {
      toast.success(`Paused ${paused} transfers.`);
    } else {
      toast.info("No active transfers to pause.");
    }
  }, [entries, toggleActive]);

  const resumeAll = useCallback(() => {
    let resumed = 0;
    Object.values(entries).forEach((entry) => {
      if (!entry.active) {
        resumed += 1;
        toggleActive(entry.id, true);
      }
    });
    if (resumed > 0) {
      toast.success(`Resumed ${resumed} transfers.`);
    } else {
      toast.info("No paused transfers to resume.");
    }
  }, [entries, toggleActive]);

  const runActiveNow = useCallback(async () => {
    if (isRunningAll) return;
    const activeEntries = filtered.filter((entry) => entry.active);
    if (activeEntries.length === 0) {
      toast.info("No active transfers to run.");
      return;
    }
    setIsRunningAll(true);
    try {
      for (const entry of activeEntries) {
        await runNow(entry);
      }
    } finally {
      setIsRunningAll(false);
    }
  }, [filtered, isRunningAll, runNow]);

  const hasActiveFiltered = filtered.some((entry) => entry.active);

  return (
    <ModalContainer size="full" title="Scheduled Transfers">
      <div className="p-4 pb-6 h-full overflow-y-auto">
        <div className="mb-3 flex flex-col gap-2">
          <input
            type="text"
            className="w-full px-2 py-1 text-xs rounded border border-gold/30 bg-black/30 text-gold/80 outline-none"
            placeholder="Filter by source/destination"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="xs" variant="outline" onClick={pauseAll}>
              Pause all
            </Button>
            <Button size="xs" variant="outline" onClick={resumeAll}>
              Resume all
            </Button>
            <Button
              size="xs"
              onClick={runActiveNow}
              disabled={isRunningAll || !hasActiveFiltered}
              isLoading={isRunningAll}
            >
              Run active now
            </Button>
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="text-xxs text-gold/60">No scheduled transfers.</div>
        ) : (
          <div className="space-y-2">
            {filtered.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between rounded border border-gold/20 bg-black/30 p-2"
              >
                <div className="flex flex-col text-xs text-gold/80">
                  <div className="font-semibold text-gold/90">
                    {e.sourceName ?? e.sourceEntityId} → {e.destinationName ?? e.destinationEntityId}
                  </div>
                  <div>
                    {formatResourceSummary(e)}
                    {e.active ? ` • every ${e.intervalMinutes}m` : " • paused"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="xs" variant="outline" onClick={() => toggleActive(e.id, !e.active)}>
                    {e.active ? "Pause" : "Resume"}
                  </Button>
                  <Button size="xs" onClick={() => runNow(e)}>
                    Run now
                  </Button>
                  <Button size="xs" variant="outline" onClick={() => handleEdit(e)}>
                    Edit
                  </Button>
                  <Button size="xs" variant="danger" onClick={() => remove(e.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModalContainer>
  );
};
