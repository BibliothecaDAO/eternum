import { useMemo, useCallback, useState } from "react";
import { useTransferAutomationStore, type TransferAutomationEntry } from "@/hooks/store/use-transfer-automation-store";
import { HudButton, HudEmpty, HudField, HudRow } from "@/ui/design-system/kit/hud-elements";
import { ResourcesIds, RESOURCE_PRECISION, formatCharge, resourceName, formatAgo } from "@bibliothecadao/types";
import { ResourceManager, getTotalResourceWeightKg, calculateDonkeysNeeded } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { toast } from "@/ui/features/event-feed/notify";
import { safeInteger } from "@bibliothecadao/eternum/game-client";
const formatResourceSummary = (entry: TransferAutomationEntry): string => {
  if (Array.isArray(entry.resourceConfigs) && entry.resourceConfigs.length > 0) {
    return entry.resourceConfigs
      .map((cfg) => {
        const amount = Math.max(0, Math.floor(cfg.amount ?? 0));
        return `${resourceName(cfg.resourceId)} ${formatCharge(amount)}`;
      })
      .join(", ");
  }
  return entry.resourceIds.map((rid) => resourceName(rid)).join(", ");
};

export const TransferAutomationAdvancedModal = () => {
  const entries = useTransferAutomationStore((s) => s.entries);
  const toggleActive = useTransferAutomationStore((s) => s.toggleActive);
  const remove = useTransferAutomationStore((s) => s.remove);
  const update = useTransferAutomationStore((s) => s.update);

  const list = useMemo(
    () => Object.values(entries).toSorted((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    [entries],
  );

  const {
    setup: { store, systemCalls },
    account: { account },
  } = useGame();

  const runNow = useCallback(
    async (entry: TransferAutomationEntry) => {
      if (!store) return;
      try {
        const sourceId = safeInteger(entry.sourceEntityId);
        const destId = safeInteger(entry.destinationEntityId);
        const rm = new ResourceManager(store, sourceId);

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
      } catch (e) {
        toast.failed(e, "Execution failed.");
      }
    },
    [store, systemCalls, account, update],
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
    filtered.forEach((entry) => {
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
  }, [filtered, toggleActive]);

  const resumeAll = useCallback(() => {
    let resumed = 0;
    filtered.forEach((entry) => {
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
  }, [filtered, toggleActive]);

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
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <HudField
          icon="search"
          aria-label="Filter by source or destination"
          placeholder="Filter by source/destination"
          value={filter}
          onChange={setFilter}
        />
        <div className="flex flex-wrap items-center gap-2">
          <HudButton
            kind="primary"
            size="sm"
            busy={isRunningAll ? "Running…" : undefined}
            disabled={!hasActiveFiltered}
            onClick={runActiveNow}
          >
            Run active transfers now
          </HudButton>
          <HudButton kind="secondary" size="sm" onClick={pauseAll}>
            Pause all
          </HudButton>
          <HudButton kind="secondary" size="sm" onClick={resumeAll}>
            Resume all
          </HudButton>
        </div>
      </div>
      {filtered.length === 0 ? (
        <HudEmpty icon="transfer" line="No scheduled transfers." />
      ) : (
        <div className="flex flex-col gap-1">
          {filtered.map((e) => (
            <HudRow
              key={e.id}
              title={`${e.sourceName ?? e.sourceEntityId} → ${e.destinationName ?? e.destinationEntityId}`}
              detail={
                <>
                  {formatResourceSummary(e)}
                  {e.active ? ` • every ${e.intervalMinutes}m` : " • paused"}
                  {typeof e.lastRunAt === "number" && ` • last run ${formatAgo(e.lastRunAt / 1000)}`}
                </>
              }
              controls={
                <>
                  <HudButton kind="secondary" size="sm" onClick={() => runNow(e)}>
                    Run now
                  </HudButton>
                  <HudButton kind="quiet" size="sm" onClick={() => toggleActive(e.id, !e.active)}>
                    {e.active ? "Pause" : "Resume"}
                  </HudButton>
                  <HudButton kind="danger" size="sm" onClick={() => remove(e.id)}>
                    Delete
                  </HudButton>
                </>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
};
