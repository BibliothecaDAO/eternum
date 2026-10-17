import { requireActiveGameClient } from "@/sync/active-game-client";
import { readAutomationBalance } from "@/ui/features/infrastructure/automation/model/automation-readiness";
import { startAutomationScope } from "@/ui/features/infrastructure/automation/model/automation-scope";
import {
  createAutomationTask,
  AutomationSignerUnavailable,
  AutomationPending,
} from "@/ui/features/infrastructure/automation/model/automation-runner";
import { useEffect, useMemo, useRef } from "react";
import { toast } from "@/ui/features/event-feed/notify";
import { useGame } from "@/hooks/context/game-context";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { configManager, getBlockTimestamp, isMilitaryResource, ResourceManager } from "@bibliothecadao/eternum";
import { ResourcesIds } from "@bibliothecadao/types";
import { canTransferMilitaryInventoryBetweenStructureIds } from "@/ui/lib/structure-capabilities";
import { isEntityOwnedByAccount } from "@/utils/entity-ownership";
import { useTransferAutomationStore } from "./store/use-transfer-automation-store";
import { assessDonkeyCapacity, buildSendResourcesArgs, planTransferAmounts } from "./transfer-automation-planner";
import { accountAddress } from "@/hooks/store/use-account-store";
import { safeInteger } from "@bibliothecadao/eternum/game-client";

type PlannedDebits = Map<string, number>;

const plannedDebitKey = (entityId: number, resourceId: ResourcesIds) => `${entityId}:${resourceId}`;

const availableBalance = (
  resourceManager: ResourceManager,
  tick: number,
  sourceId: number,
  resourceId: ResourcesIds,
  plannedDebits: PlannedDebits,
) => {
  const balance = readAutomationBalance(resourceManager, tick, resourceId);
  return Math.max(0, balance - (plannedDebits.get(plannedDebitKey(sourceId, resourceId)) ?? 0));
};

const recordPlannedDebits = (
  sourceId: number,
  transfers: ReturnType<typeof planTransferAmounts>,
  debits: PlannedDebits,
) => {
  for (const transfer of transfers) {
    const key = plannedDebitKey(sourceId, transfer.resourceId);
    debits.set(key, (debits.get(key) ?? 0) + transfer.humanAmount);
  }
};

const runTransferPass = createAutomationTask<{
  entryId: string;
  sourceId: number;
  destinationId: number;
  transfers: ReturnType<typeof planTransferAmounts>;
  submittedAt: number;
}>();

export const useTransferAutomationRunner = () => {
  const client = requireActiveGameClient();
  const {
    setup: { store, systemCalls },
    account: { account },
  } = useGame();
  const mode = useGameModeConfig();

  const entries = useTransferAutomationStore((s) => s.entries);
  const update = useTransferAutomationStore((s) => s.update);
  const scheduleNext = useTransferAutomationStore((s) => s.scheduleNext);
  const pruneForGame = useTransferAutomationStore((s) => s.pruneForGame);

  const processingRef = useRef(false);
  const processRef = useRef<(signal: AbortSignal) => Promise<void | false>>(async () => {});

  const activeEntries = useMemo(() => Object.values(entries).filter((e) => e.active), [entries]);
  const activeEntriesRef = useRef(activeEntries);

  useEffect(() => {
    activeEntriesRef.current = activeEntries;
  }, [activeEntries]);

  useEffect(() => {
    if (!store) {
      return;
    }
    const season = configManager.getSeasonConfig();
    const gameId = `${season.startSettlingAt}-${season.startMainAt}-${season.endAt}`;
    pruneForGame(gameId);
  }, [store, pruneForGame]);

  useEffect(() => {
    processRef.current = async (signal) => {
      if (configManager.isGameOver()) {
        return false;
      }
      if (processingRef.current) {
        return;
      }
      if (!store) {
        return;
      }
      if (!account || accountAddress() === null) {
        return;
      }

      const { currentBlockTimestamp, currentDefaultTick } = getBlockTimestamp();
      if (configManager.isGameOver()) {
        return false;
      }
      const nowMs = currentBlockTimestamp * 1000;
      const due = activeEntriesRef.current.filter(
        (e) => typeof e.nextRunAt === "number" && (e.nextRunAt as number) <= nowMs,
      );

      processingRef.current = true;
      const plannedDebits: PlannedDebits = new Map();

      try {
        await runTransferPass(
          {
            client,
            signer: account.address,
            signal,
            onConfirmed: (submitted) => {
              recordPlannedDebits(submitted.sourceId, submitted.transfers, plannedDebits);
              update(submitted.entryId, { lastRunAt: submitted.submittedAt });
              scheduleNext(submitted.entryId, nowMs);
            },
          },
          async (submit) => {
            for (const entry of due) {
              if (signal.aborted) return;
              try {
                const sourceId = safeInteger(entry.sourceEntityId);
                const destId = safeInteger(entry.destinationEntityId);
                if (!Number.isFinite(sourceId) || !Number.isFinite(destId) || sourceId <= 0 || destId <= 0) {
                  scheduleNext(entry.id, nowMs);
                  continue;
                }

                if (!isEntityOwnedByAccount(store, sourceId, account.address)) {
                  toast.warning("Scheduled transfer skipped: source structure is no longer owned.");
                  scheduleNext(entry.id, nowMs);
                  continue;
                }

                if (!isEntityOwnedByAccount(store, destId, account.address)) {
                  toast.warning("Scheduled transfer skipped: destination structure is no longer owned.");
                  scheduleNext(entry.id, nowMs);
                  continue;
                }

                // Military transfers follow the active game mode's structure inventory rules.
                const hasMilitary = entry.resourceIds.some((rid) => isMilitaryResource(rid));
                if (hasMilitary) {
                  const validTransfer = canTransferMilitaryInventoryBetweenStructureIds({
                    store,
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

                const rm = new ResourceManager(store, sourceId);
                const donkeyBalHuman = availableBalance(
                  rm,
                  currentDefaultTick,
                  sourceId,
                  ResourcesIds.Donkey,
                  plannedDebits,
                );

                const transferList = planTransferAmounts(entry, (resourceId) =>
                  availableBalance(rm, currentDefaultTick, sourceId, resourceId, plannedDebits),
                );

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

                await submit(
                  { entryId: entry.id, sourceId, destinationId: destId, transfers: transferList, submittedAt: nowMs },
                  (submitted) =>
                    systemCalls.send_resources_multiple({
                      signer: account,
                      calls: [
                        {
                          sender_entity_id: BigInt(submitted.sourceId),
                          recipient_entity_id: BigInt(submitted.destinationId),
                          resources: buildSendResourcesArgs(submitted.transfers),
                        },
                      ],
                    }),
                );
              } catch (err) {
                if (signal.aborted) return;
                if (err instanceof AutomationSignerUnavailable || err instanceof AutomationPending) {
                  toast.warning(err.message, { id: "transfer-automation-pending" });
                  return;
                }
                console.error("Transfer automation: execution failed", err);
                scheduleNext(entry.id, nowMs);
                toast.failed(err, "Scheduled transfer failed.");
              }
            }
          },
        );
      } catch (error) {
        if (!signal.aborted)
          toast.warning(error instanceof Error ? error.message : "Transfer automation is unavailable.", {
            id: "transfer-automation-pending",
          });
      } finally {
        processingRef.current = false;
      }
    };
  }, [client, store, account, mode.id, scheduleNext, update, systemCalls]);

  useEffect(() => {
    const stop = startAutomationScope((signal) => processRef.current(signal));
    return () => {
      stop();
    };
  }, [client, account, store]);
};
