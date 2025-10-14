import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { useDojo } from "@bibliothecadao/react";
import { getBlockTimestamp, ResourceManager, getTotalResourceWeightKg, calculateDonkeysNeeded, isMilitaryResource, getEntityIdFromKeys } from "@bibliothecadao/eternum";
import { ClientComponents, ResourcesIds, StructureType, RESOURCE_PRECISION } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { useTransferAutomationStore } from "./store/use-transfer-automation-store";

const toRaw = (amountHuman: number) => BigInt(Math.floor(amountHuman * RESOURCE_PRECISION));

const getStructureCategory = (
  components: ClientComponents | null | undefined,
  entityId: number,
): StructureType | undefined => {
  if (!components || !entityId) return undefined;
  try {
    const value = getComponentValue(components.Structure, getEntityIdFromKeys([BigInt(entityId)]));
    return value?.category as StructureType | undefined;
  } catch {
    return undefined;
  }
};

export const useTransferAutomationRunner = () => {
  const {
    setup: { components, systemCalls },
    account: { account },
  } = useDojo();

  const entries = useTransferAutomationStore((s) => s.entries);
  const update = useTransferAutomationStore((s) => s.update);
  const scheduleNext = useTransferAutomationStore((s) => s.scheduleNext);

  const processingRef = useRef(false);
  const processRef = useRef<() => Promise<void>>(async () => {});

  const activeEntries = useMemo(() => Object.values(entries).filter((e) => e.active), [entries]);

  useEffect(() => {
    processRef.current = async () => {
      if (processingRef.current) return;
      if (!components) return;
      if (!account || !account.address || account.address === "0x0") return;

      const now = Date.now();
      const due = activeEntries.filter((e) => typeof e.nextRunAt === "number" && (e.nextRunAt as number) <= now);
      if (!due.length) return;
      processingRef.current = true;

      try {
        const { currentDefaultTick } = getBlockTimestamp();

        for (const entry of due) {
          try {
            const sourceId = Number(entry.sourceEntityId);
            const destId = Number(entry.destinationEntityId);
            if (!Number.isFinite(sourceId) || !Number.isFinite(destId) || sourceId <= 0 || destId <= 0) {
              scheduleNext(entry.id, now);
              continue;
            }

            // Military rule: if any selected is military, enforce Realm -> Realm
            const hasMilitary = entry.resourceIds.some((rid) => isMilitaryResource(rid));
            if (hasMilitary) {
              const sourceCat = getStructureCategory(components, sourceId);
              const destCat = getStructureCategory(components, destId);
              if (sourceCat !== StructureType.Realm || destCat !== StructureType.Realm) {
                toast.warning("Scheduled transfer skipped: troops can only move Realm ↔ Realm.");
                scheduleNext(entry.id, now);
                continue;
              }
            }

            const rm = new ResourceManager(components, sourceId);
            const donkeyBalRaw = rm.balanceWithProduction(currentDefaultTick, ResourcesIds.Donkey).balance ?? 0n;
            const donkeyBalHuman = Number(donkeyBalRaw) / RESOURCE_PRECISION;

            // compute human amounts per resource based on per-resource configs (fallback to legacy fields)
            const transferList: { resourceId: ResourcesIds; humanAmount: number }[] = [];
            const configMap = new Map<number, { mode: "percent" | "flat"; percent?: number; flatPercent?: number }>();
            if (entry.resourceConfigs && Array.isArray(entry.resourceConfigs)) {
              for (const c of entry.resourceConfigs) configMap.set(c.resourceId, c);
            }
            for (const rid of entry.resourceIds) {
              const balRaw = rm.balanceWithProduction(currentDefaultTick, rid).balance ?? 0n;
              const balHuman = Number(balRaw) / RESOURCE_PRECISION;
              const cfg = configMap.get(rid);
              let amt = 0;
              if (cfg) {
                if (cfg.mode === "percent") {
                  const pct = Math.min(90, Math.max(5, Math.floor(cfg.percent ?? entry.percent ?? 5)));
                  amt = Math.floor((pct / 100) * balHuman);
                } else {
                  const fPct = Math.min(90, Math.max(1, Math.floor(cfg.flatPercent ?? 10)));
                  amt = Math.floor((fPct / 100) * balHuman);
                }
              } else {
                // legacy fallback
                const useFlat = (entry.amountMode ?? "percent") === "flat";
                if (useFlat) {
                  amt = Math.max(0, Math.min(balHuman, Math.floor(entry.flatAmount ?? 0)));
                } else {
                  const pct = Math.min(90, Math.max(5, Math.floor(entry.percent ?? 5)));
                  amt = Math.floor((pct / 100) * balHuman);
                }
              }
              if (amt > 0) transferList.push({ resourceId: rid, humanAmount: amt });
            }

            if (transferList.length === 0) {
              scheduleNext(entry.id, now);
              continue;
            }

            // donkey capacity check
            const totalKg = getTotalResourceWeightKg(
              transferList.map((t) => ({ resourceId: t.resourceId, amount: t.humanAmount })),
            );
            const neededDonkeys = calculateDonkeysNeeded(totalKg);
            if (donkeyBalHuman < neededDonkeys) {
              toast.error("Scheduled transfer blocked: insufficient donkeys at source.");
              scheduleNext(entry.id, now);
              continue;
            }

            const resources: (bigint | number)[] = [];
            for (const t of transferList) {
              resources.push(t.resourceId, toRaw(t.humanAmount));
            }

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

            update(entry.id, { lastRunAt: now });
            scheduleNext(entry.id, now);
            const summary = transferList
              .map((t) => `${t.humanAmount.toLocaleString()} ${ResourcesIds[t.resourceId]}`)
              .join(", ");
            toast.success(`Transfer scheduled: ${summary}`);
          } catch (err) {
            console.error("Transfer automation: execution failed", err);
            scheduleNext(entry.id, now);
            toast.error("Scheduled transfer failed. Check console for details.");
          }
        }
      } finally {
        processingRef.current = false;
      }
    };
  }, [activeEntries, components, account, scheduleNext, update, systemCalls]);

  useEffect(() => {
    const tick = () => void processRef.current();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);
};
