import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { useDojo } from "@bibliothecadao/react";
import {
  calculateDonkeysNeeded,
  configManager,
  getBlockTimestamp,
  getEntityIdFromKeys,
  getTotalResourceWeightKg,
  isMilitaryResource,
  ResourceManager,
} from "@bibliothecadao/eternum";
import { ClientComponents, ResourcesIds, StructureType, RESOURCE_PRECISION } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { useUIStore } from "@/hooks/store/use-ui-store";
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

const normalizeOwnerValue = (owner: unknown): string | null => {
  if (typeof owner === "string") return owner.trim().toLowerCase();
  if (typeof owner === "bigint") return `0x${owner.toString(16)}`;
  if (typeof owner === "number" && Number.isFinite(owner)) return `0x${BigInt(owner).toString(16)}`;
  return null;
};

const isEntityOwnedByAccount = (
  components: ClientComponents | null | undefined,
  entityId: number,
  accountAddress: string | undefined,
): boolean => {
  if (!components || !entityId || !accountAddress) return false;
  try {
    const structure = getComponentValue(components.Structure, getEntityIdFromKeys([BigInt(entityId)]));
    const owner = normalizeOwnerValue(structure?.owner);
    const accountOwner = normalizeOwnerValue(accountAddress);
    return Boolean(owner && accountOwner && owner === accountOwner);
  } catch {
    return false;
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
  const pruneForGame = useTransferAutomationStore((s) => s.pruneForGame);
  const gameEndAt = useUIStore((state) => state.gameEndAt);
  const gameWinner = useUIStore((state) => state.gameWinner);

  const processingRef = useRef(false);
  const processRef = useRef<() => Promise<void>>(async () => {});
  const timeoutIdRef = useRef<number | null>(null);

  const activeEntries = useMemo(() => Object.values(entries).filter((e) => e.active), [entries]);

  const stopTransferAutomation = useCallback(() => {
    if (timeoutIdRef.current !== null) {
      window.clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
  }, []);

  const isSeasonOver = useCallback(
    (blockTimestampSeconds?: number) => {
      if (gameWinner) return true;
      if (typeof gameEndAt !== "number") {
        return false;
      }
      const timestamp =
        typeof blockTimestampSeconds === "number" ? blockTimestampSeconds : getBlockTimestamp().currentBlockTimestamp;
      return timestamp >= gameEndAt;
    },
    [gameEndAt, gameWinner],
  );

  useEffect(() => {
    if (!components) {
      return;
    }
    const season = configManager.getSeasonConfig();
    const gameId = `${season.startSettlingAt}-${season.startMainAt}-${season.endAt}`;
    pruneForGame(gameId);
  }, [components, pruneForGame]);

  const scheduleNextCheck = useCallback(() => {
    if (isSeasonOver()) {
      stopTransferAutomation();
      return;
    }
    if (timeoutIdRef.current !== null) {
      window.clearTimeout(timeoutIdRef.current);
    }

    const now = Date.now();
    const nextBlockMs = (Math.floor(now / 1000) + 1) * 1000;
    const delay = Math.max(250, nextBlockMs - now);

    timeoutIdRef.current = window.setTimeout(() => {
      void processRef.current();
    }, delay);
  }, [isSeasonOver, stopTransferAutomation]);

  useEffect(() => {
    processRef.current = async () => {
      if (isSeasonOver()) {
        stopTransferAutomation();
        return;
      }
      if (processingRef.current) {
        scheduleNextCheck();
        return;
      }
      if (!components) {
        scheduleNextCheck();
        return;
      }
      if (!account || !account.address || account.address === "0x0") {
        scheduleNextCheck();
        return;
      }

      const { currentDefaultTick, currentBlockTimestamp } = getBlockTimestamp();
      if (isSeasonOver(currentBlockTimestamp)) {
        stopTransferAutomation();
        return;
      }
      const nowMs = currentBlockTimestamp * 1000;
      const due = activeEntries.filter((e) => typeof e.nextRunAt === "number" && (e.nextRunAt as number) <= nowMs);
      if (!due.length) {
        scheduleNextCheck();
        return;
      }

      processingRef.current = true;

      try {
        for (const entry of due) {
          try {
            const sourceId = Number(entry.sourceEntityId);
            const destId = Number(entry.destinationEntityId);
            if (!Number.isFinite(sourceId) || !Number.isFinite(destId) || sourceId <= 0 || destId <= 0) {
              scheduleNext(entry.id, nowMs);
              continue;
            }

            if (!isEntityOwnedByAccount(components, sourceId, account.address)) {
              toast.warning("Scheduled transfer skipped: source structure is no longer owned.");
              scheduleNext(entry.id, nowMs);
              continue;
            }

            if (!isEntityOwnedByAccount(components, destId, account.address)) {
              toast.warning("Scheduled transfer skipped: destination structure is no longer owned.");
              scheduleNext(entry.id, nowMs);
              continue;
            }

            // Military rule: if any selected is military, enforce Realm -> Realm
            const hasMilitary = entry.resourceIds.some((rid) => isMilitaryResource(rid));
            if (hasMilitary) {
              const sourceCat = getStructureCategory(components, sourceId);
              const destCat = getStructureCategory(components, destId);
              if (sourceCat !== StructureType.Realm || destCat !== StructureType.Realm) {
                toast.warning("Scheduled transfer skipped: troops can only move Realm ↔ Realm.");
                scheduleNext(entry.id, nowMs);
                continue;
              }
            }

            const rm = new ResourceManager(components, sourceId);
            const donkeyBalRaw = rm.balanceWithProduction(currentDefaultTick, ResourcesIds.Donkey).balance ?? 0n;
            const donkeyBalHuman = Number(donkeyBalRaw) / RESOURCE_PRECISION;

            // compute human amounts per resource based on per-resource configs (fallback to legacy fields)
            const transferList: { resourceId: ResourcesIds; humanAmount: number }[] = [];
            const configMap = new Map<number, number>();
            if (entry.resourceConfigs && Array.isArray(entry.resourceConfigs)) {
              for (const c of entry.resourceConfigs) {
                configMap.set(c.resourceId, Math.max(0, Math.floor(c.amount ?? 0)));
              }
            }
            for (const rid of entry.resourceIds) {
              const desired = Math.max(0, Math.floor(configMap.get(rid) ?? 0));
              if (desired <= 0) continue;
              const balRaw = rm.balanceWithProduction(currentDefaultTick, rid).balance ?? 0n;
              const balHuman = Number(balRaw) / RESOURCE_PRECISION;
              const amt = Math.max(0, Math.min(balHuman, desired));
              if (amt > 0) transferList.push({ resourceId: rid, humanAmount: amt });
            }

            if (transferList.length === 0) {
              scheduleNext(entry.id, nowMs);
              continue;
            }

            // donkey capacity check
            const totalKg = getTotalResourceWeightKg(
              transferList.map((t) => ({ resourceId: t.resourceId, amount: t.humanAmount })),
            );
            const neededDonkeys = calculateDonkeysNeeded(totalKg);
            if (donkeyBalHuman < neededDonkeys) {
              toast.error("Scheduled transfer blocked: insufficient donkeys at source.");
              scheduleNext(entry.id, nowMs);
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

            update(entry.id, { lastRunAt: nowMs });
            scheduleNext(entry.id, nowMs);
            const summary = transferList
              .map((t) => `${t.humanAmount.toLocaleString()} ${ResourcesIds[t.resourceId]}`)
              .join(", ");
            toast.success(`Transfer scheduled: ${summary}`);
          } catch (err) {
            console.error("Transfer automation: execution failed", err);
            scheduleNext(entry.id, nowMs);
            toast.error("Scheduled transfer failed. Check console for details.");
          }
        }
      } finally {
        processingRef.current = false;
        scheduleNextCheck();
      }
    };
    scheduleNextCheck();

    return () => {
      if (timeoutIdRef.current !== null) {
        window.clearTimeout(timeoutIdRef.current);
      }
    };
  }, [
    activeEntries,
    components,
    account,
    isSeasonOver,
    scheduleNext,
    stopTransferAutomation,
    update,
    systemCalls,
    scheduleNextCheck,
  ]);
};
