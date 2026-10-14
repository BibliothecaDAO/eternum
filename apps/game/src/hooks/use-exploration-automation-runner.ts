import { startAutomationScope } from "@/ui/features/infrastructure/automation/model/automation-scope";
import {
  createAutomationTask,
  AutomationSignerUnavailable,
  AutomationPending,
} from "@/ui/features/infrastructure/automation/model/automation-runner";
import {
  ActionPaths,
  configManager,
  getExplorerOwner,
  getBlockTimestamp,
  Position,
  StaminaManager,
} from "@bibliothecadao/eternum";
import { getActiveGameSyncRuntime } from "@bibliothecadao/eternum/game-sync";
import type { WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";
import { useGame } from "@/hooks/context/game-context";
import { ContractAddress } from "@bibliothecadao/types";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "@/ui/features/event-feed/notify";

import { getExplorationStrategy } from "@/automation/exploration";
import { buildExplorationSnapshot } from "@/automation/exploration/map-cache";
import type { ExplorationMapSnapshot, ExplorationStrategySelection } from "@/automation/exploration/types";
import {
  DEFAULT_SCOPE_RADIUS,
  DEFAULT_STRATEGY_ID,
  useExplorationAutomationStore,
} from "@/hooks/store/use-exploration-automation-store";
import { requireActiveGameClient } from "@/sync/active-game-client";
import {
  computeEffectiveStaminaCost,
  filterFreshExplorationPaths,
  selectDueEntries,
  shouldRepeatExplore,
} from "./exploration-automation-planner";
import { accountAddress } from "@/hooks/store/use-account-store";
import { safeInteger } from "@bibliothecadao/eternum/game-client";

const REPEAT_EXPLORE_DELAY_MS = 3_000;

type SnapshotCache = {
  snapshot: ExplorationMapSnapshot;
  reusableUntilProjectionChange: boolean;
  recentlyExplored: Set<string>;
};

const runExplorationPass = createAutomationTask<{
  entryId: string;
  explorerId: number;
  selection: ExplorationStrategySelection;
  stamina: number;
  exploreStaminaCost: number;
  submittedAt: number;
}>();

export const useExplorationAutomationRunner = () => {
  const client = requireActiveGameClient();
  const {
    setup: { store },
    account: { account },
  } = useGame();

  const entries = useExplorationAutomationStore((s) => s.entries);
  const update = useExplorationAutomationStore((s) => s.update);
  const scheduleNext = useExplorationAutomationStore((s) => s.scheduleNext);
  const remove = useExplorationAutomationStore((s) => s.remove);
  const pruneForGame = useExplorationAutomationStore((s) => s.pruneForGame);

  const processingRef = useRef(false);
  const processRef = useRef<(signal: AbortSignal) => Promise<void | false>>(async () => {});
  const snapshotCacheRef = useRef<Map<string, SnapshotCache>>(new Map());
  const subscribedProjectionRef = useRef<WorldSpatialProjection | null>(null);
  const unsubscribeProjectionRef = useRef<(() => void) | null>(null);

  const activeEntries = useMemo(() => Object.values(entries).filter((e) => e.active), [entries]);
  const activeEntriesRef = useRef(activeEntries);

  useEffect(() => {
    activeEntriesRef.current = activeEntries;
  }, [activeEntries]);

  const resolveExplorerEntity = useCallback(
    (explorerId: number) => ({
      explorer: store.get("ExplorerTroops", { game_id: configManager.getActiveGameId(), explorer_id: explorerId }),
    }),
    [store],
  );

  useEffect(() => {
    if (!store) {
      return;
    }
    const season = configManager.getSeasonConfig();
    const gameId = `${season.startSettlingAt}-${season.startMainAt}-${season.endAt}`;
    pruneForGame(gameId);
    // Clear snapshot cache when game changes - old snapshots are invalid
    snapshotCacheRef.current.clear();
  }, [store, pruneForGame]);

  useEffect(() => {
    processRef.current = async (signal) => {
      if (configManager.isGameOver()) {
        return false;
      }
      if (processingRef.current) {
        return;
      }
      const worldSpatialProjection = getActiveGameSyncRuntime()?.getWorldSpatialProjection();
      if (!store || !worldSpatialProjection) {
        return;
      }
      if (subscribedProjectionRef.current !== worldSpatialProjection) {
        unsubscribeProjectionRef.current?.();
        subscribedProjectionRef.current = worldSpatialProjection;
        snapshotCacheRef.current.clear();
        unsubscribeProjectionRef.current = worldSpatialProjection.subscribe(() => {
          snapshotCacheRef.current.clear();
        });
      }
      if (!account || accountAddress() === null) {
        return;
      }

      const { currentBlockTimestamp, currentDefaultTick } = getBlockTimestamp();
      if (configManager.isGameOver()) {
        return false;
      }

      // Use wall clock time for scheduling (matches store and UI expectations)
      const nowMs = Date.now();
      const due = selectDueEntries(activeEntriesRef.current, nowMs);

      processingRef.current = true;

      try {
        await runExplorationPass(
          {
            client,
            signer: account.address,
            signal,
            onConfirmed: ({ entryId, selection, stamina, exploreStaminaCost, submittedAt }) => {
              const actionType = ActionPaths.getActionType(selection.path);
              const effectiveCost = computeEffectiveStaminaCost(selection.path, actionType, exploreStaminaCost);
              const remainingStamina = Math.max(0, stamina - effectiveCost);
              const shouldRepeat = shouldRepeatExplore(actionType, remainingStamina, exploreStaminaCost);
              const repeatAt = nowMs + REPEAT_EXPLORE_DELAY_MS;

              if (shouldRepeat) {
                const endHex = selection.path[selection.path.length - 1]?.hex;
                if (endHex) {
                  const normalized = Position.fromContract({ x: endHex.col, y: endHex.row }).getNormalized();
                  const cache = snapshotCacheRef.current.get(entryId);
                  if (cache) {
                    cache.recentlyExplored.add(`${normalized.x},${normalized.y}`);
                    cache.reusableUntilProjectionChange = true;
                  }
                }
              }

              update(entryId, {
                lastRunAt: submittedAt,
                lastAction: selection.reason,
                blockedReason: null,
                lastError: null,
                ...(shouldRepeat ? { nextRunAt: repeatAt } : {}),
              });
              if (!shouldRepeat) {
                scheduleNext(entryId, nowMs);
              }
            },
          },
          async (submit) => {
            for (const entry of due) {
              if (signal.aborted) return;
              try {
                const explorerId = safeInteger(entry.explorerId);
                if (!Number.isFinite(explorerId) || explorerId <= 0) {
                  update(entry.id, { blockedReason: "invalid-explorer", lastError: null });
                  scheduleNext(entry.id, nowMs);
                  continue;
                }

                const { explorer } = resolveExplorerEntity(explorerId);
                if (!explorer) {
                  // Explorer died or no longer exists - remove automation
                  remove(entry.id);
                  snapshotCacheRef.current.delete(entry.id);
                  continue;
                }

                if (getExplorerOwner(store, explorer) !== ContractAddress(account.address)) {
                  // Explorer owned by someone else - remove automation
                  remove(entry.id);
                  snapshotCacheRef.current.delete(entry.id);
                  continue;
                }

                // Check stamina before doing anything - wait for regen if too low
                const staminaManager = new StaminaManager(store, explorerId);
                const currentStamina = staminaManager.getStamina(currentDefaultTick);
                const exploreStaminaCost = configManager.getExploreStaminaCost();
                if (!currentStamina || Number(currentStamina.amount) < exploreStaminaCost) {
                  update(entry.id, { blockedReason: "low-stamina", lastError: null });
                  scheduleNext(entry.id, nowMs);
                  continue;
                }

                const cached = snapshotCacheRef.current.get(entry.id);
                const useFastCache = cached?.reusableUntilProjectionChange === true;
                let snapshot =
                  useFastCache && cached?.snapshot
                    ? cached.snapshot
                    : await buildExplorationSnapshot({
                        store,
                        explorerId,
                        scopeRadius: entry.scopeRadius ?? DEFAULT_SCOPE_RADIUS,
                        worldSpatialProjection,
                      });

                if (signal.aborted) return;
                if (!snapshot) {
                  update(entry.id, { blockedReason: "no-snapshot", lastError: null });
                  scheduleNext(entry.id, nowMs);
                  continue;
                }

                if (!cached || !useFastCache) {
                  snapshotCacheRef.current.set(entry.id, {
                    snapshot,
                    reusableUntilProjectionChange: false,
                    recentlyExplored: new Set(),
                  });
                }

                const { actions } = client;
                const planPaths = (map: ExplorationMapSnapshot) =>
                  actions
                    .armyPaths({
                      explorerId,
                      structureHexes: map.structureHexes,
                      armyHexes: map.armyHexes,
                      exploredHexes: map.exploredTiles,
                      chestHexes: map.chestHexes,
                      currentDefaultTick,
                      playerAddress: ContractAddress(account.address),
                    })
                    .getPaths();
                let actionPathMap = planPaths(snapshot);

                if (useFastCache && cached) {
                  const filtered = filterFreshExplorationPaths(actionPathMap, cached.recentlyExplored, (hex) => {
                    const normalized = Position.fromContract({ x: hex.col, y: hex.row }).getNormalized();
                    return { x: normalized.x, y: normalized.y };
                  });

                  if (filtered.size === 0) {
                    const refreshed = await buildExplorationSnapshot({
                      store,
                      explorerId,
                      scopeRadius: entry.scopeRadius ?? DEFAULT_SCOPE_RADIUS,
                      worldSpatialProjection,
                    });
                    if (signal.aborted) return;
                    if (!refreshed) {
                      update(entry.id, { blockedReason: "no-snapshot", lastError: null });
                      scheduleNext(entry.id, nowMs);
                      continue;
                    }
                    snapshot = refreshed;
                    snapshotCacheRef.current.set(entry.id, {
                      snapshot,
                      reusableUntilProjectionChange: false,
                      recentlyExplored: new Set(),
                    });
                    actionPathMap = planPaths(snapshot);
                  } else {
                    actionPathMap = filtered;
                  }
                }

                const strategy = getExplorationStrategy(entry.strategyId ?? DEFAULT_STRATEGY_ID);
                const selection = strategy.selectNextAction({
                  ...snapshot,
                  explorerId,
                  actionPaths: actionPathMap,
                });

                if (!selection) {
                  update(entry.id, { blockedReason: "no-paths", lastError: null });
                  scheduleNext(entry.id, nowMs);
                  continue;
                }

                await submit(
                  {
                    entryId: entry.id,
                    explorerId,
                    selection,
                    stamina: Number(currentStamina.amount),
                    exploreStaminaCost,
                    submittedAt: nowMs,
                  },
                  (submitted) =>
                    client.actions.moveArmy({ explorerId: submitted.explorerId, path: submitted.selection.path }),
                );
              } catch (error) {
                if (signal.aborted) return;
                if (error instanceof AutomationSignerUnavailable || error instanceof AutomationPending) {
                  update(entry.id, { blockedReason: "error", lastError: error.message });
                  return;
                }
                const message = error instanceof Error ? error.message : String(error);
                update(entry.id, {
                  lastError: message,
                  blockedReason: "error",
                });
                toast.error("Exploration automation failed.");
                scheduleNext(entry.id, nowMs);
              }
            }
          },
        );
      } catch (error) {
        if (!signal.aborted)
          toast.warning(error instanceof Error ? error.message : "Exploration automation is unavailable.", {
            id: "exploration-automation-pending",
          });
      } finally {
        processingRef.current = false;
      }
    };
  }, [client, account, store, scheduleNext, remove, resolveExplorerEntity, update]);

  useEffect(() => {
    const stop = startAutomationScope((signal) => processRef.current(signal));
    return () => {
      stop();
      unsubscribeProjectionRef.current?.();
      unsubscribeProjectionRef.current = null;
      subscribedProjectionRef.current = null;
      snapshotCacheRef.current.clear();
    };
  }, [client, account, store]);
};
