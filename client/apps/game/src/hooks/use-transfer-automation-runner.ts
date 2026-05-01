import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { useDojo } from "@bibliothecadao/react";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import {
  configManager,
  getAutomationProjectionTick,
  getBlockTimestamp,
  isMilitaryResource,
  ResourceManager,
} from "@bibliothecadao/eternum";
import { ResourcesIds, RESOURCE_PRECISION } from "@bibliothecadao/types";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { canTransferMilitaryInventoryBetweenStructureIds } from "@/ui/lib/structure-capabilities";
import { isEntityOwnedByAccount } from "@/utils/entity-ownership";
import { useTransferAutomationStore } from "./store/use-transfer-automation-store";
import {
  getSpendableResourceBalance,
  releaseAutomationReservation,
  reserveAutomationResources,
} from "./automation-resource-reservations";
import { assessDonkeyCapacity, buildSendResourcesArgs, planTransferAmounts } from "./transfer-automation-planner";

export const useTransferAutomationRunner = () => {
  const {
    setup: { components, systemCalls },
    account: { account },
  } = useDojo();
  const mode = useGameModeConfig();

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
  const activeEntriesRef = useRef(activeEntries);

  useEffect(() => {
    activeEntriesRef.current = activeEntries;
  }, [activeEntries]);

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

      const { currentBlockTimestamp } = getBlockTimestamp();
      // Use conservative tick for resource validation to prevent tx failures from clock desync
      const { currentDefaultTick: conservativeTick } = getAutomationProjectionTick();
      if (isSeasonOver(currentBlockTimestamp)) {
        stopTransferAutomation();
        return;
      }
      const nowMs = currentBlockTimestamp * 1000;
      const due = activeEntriesRef.current.filter(
        (e) => typeof e.nextRunAt === "number" && (e.nextRunAt as number) <= nowMs,
      );
      if (!due.length) {
        scheduleNextCheck();
        return;
      }

      processingRef.current = true;

      try {
        for (const entry of due) {
          let reservationToken: string | null = null;
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

            // Military transfers follow the active game mode's structure inventory rules.
            const hasMilitary = entry.resourceIds.some((rid) => isMilitaryResource(rid));
            if (hasMilitary) {
              const validTransfer = canTransferMilitaryInventoryBetweenStructureIds({
                components,
                modeId: mode.id,
                sourceEntityId: sourceId,
                destinationEntityId: destId,
              });
              if (!validTransfer) {
                toast.warning(
                  mode.id === "blitz"
                    ? "Scheduled transfer skipped: troops can only move between your owned structures in Blitz."
                    : "Scheduled transfer skipped: troops can only move Realm ↔ Realm.",
                );
                scheduleNext(entry.id, nowMs);
                continue;
              }
            }

            const rm = new ResourceManager(components, sourceId);
            const reservationNowMs = Date.now();
            const donkeyBalRaw = rm.balanceWithProduction(conservativeTick, ResourcesIds.Donkey).balance ?? 0n;
            const donkeyBalHuman = getSpendableResourceBalance({
              entityId: sourceId,
              resourceId: ResourcesIds.Donkey,
              balanceHuman: Number(donkeyBalRaw) / RESOURCE_PRECISION,
              nowMs: reservationNowMs,
            });

            const transferList = planTransferAmounts(entry, (rid) => {
              const balRaw = rm.balanceWithProduction(conservativeTick, rid).balance ?? 0n;
              return getSpendableResourceBalance({
                entityId: sourceId,
                resourceId: rid,
                balanceHuman: Number(balRaw) / RESOURCE_PRECISION,
                nowMs: reservationNowMs,
              });
            });

            if (transferList.length === 0) {
              scheduleNext(entry.id, nowMs);
              continue;
            }

            const capacity = assessDonkeyCapacity(transferList, donkeyBalHuman);
            if (!capacity.ok) {
              toast.error("Scheduled transfer blocked: insufficient donkeys at source.");
              scheduleNext(entry.id, nowMs);
              continue;
            }

            const resources = buildSendResourcesArgs(transferList);
            reservationToken = reserveAutomationResources({
              entityId: sourceId,
              resources: transferList,
              nowMs: reservationNowMs,
            });

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
            releaseAutomationReservation(reservationToken);
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
  }, [
    components,
    account,
    isSeasonOver,
    mode.id,
    scheduleNext,
    stopTransferAutomation,
    update,
    systemCalls,
    scheduleNextCheck,
  ]);

  useEffect(() => {
    scheduleNextCheck();
    return () => {
      if (timeoutIdRef.current !== null) {
        window.clearTimeout(timeoutIdRef.current);
      }
    };
  }, [scheduleNextCheck]);
};
