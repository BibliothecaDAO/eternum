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
import type { ExplorationMapSnapshot } from "@/automation/exploration/types";
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

const REPEAT_EXPLORE_DELAY_MS = 3_000;

type SnapshotCache = {
  snapshot: ExplorationMapSnapshot;
  reusableUntilProjectionChange: boolean;
  recentlyExplored: Set<string>;
};

export const useExplorationAutomationRunner = () => {
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
  const processRef = useRef<() => Promise<void>>(async () => {});
  const timeoutIdRef = useRef<number | null>(null);
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

  const stopAutomation = useCallback(() => {
    if (timeoutIdRef.current !== null) {
      window.clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
  }, []);

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

  const scheduleNextCheck = useCallback(() => {
    if (configManager.isGameOver()) {
      stopAutomation();
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
  }, [stopAutomation]);

  useEffect(() => {
    processRef.current = async () => {
      if (configManager.isGameOver()) {
        stopAutomation();
        return;
      }
      if (processingRef.current) {
        scheduleNextCheck();
        return;
      }
      const worldSpatialProjection = getActiveGameSyncRuntime()?.getWorldSpatialProjection();
      if (!store || !worldSpatialProjection) {
        scheduleNextCheck();
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
      if (!account || !account.address || account.address === "0x0") {
        scheduleNextCheck();
        return;
      }

      const { currentBlockTimestamp, currentDefaultTick, currentArmiesTick } = getBlockTimestamp();
      if (configManager.isGameOver()) {
        stopAutomation();
        return;
      }

      // Use wall clock time for scheduling (matches store and UI expectations)
      const nowMs = Date.now();
      const due = selectDueEntries(activeEntriesRef.current, nowMs);

      if (!due.length) {
        scheduleNextCheck();
        return;
      }

      processingRef.current = true;

      try {
        for (const entry of due) {
          try {
            const explorerId = Number(entry.explorerId);
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
            const currentStamina = staminaManager.getStamina(currentArmiesTick);
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

            const { actions } = requireActiveGameClient();
            const planPaths = (map: ExplorationMapSnapshot) =>
              actions
                .armyPaths({
                  explorerId,
                  structureHexes: map.structureHexes,
                  armyHexes: map.armyHexes,
                  exploredHexes: map.exploredTiles,
                  chestHexes: map.chestHexes,
                  currentDefaultTick,
                  currentArmiesTick,
                  playerAddress: ContractAddress(account.address),
                })
                .getPaths();
            let actionPathMap = planPaths(snapshot);

            if (useFastCache && cached) {
              const filtered = filterFreshExplorationPaths(actionPathMap, cached.recentlyExplored, (hex) => {
                const normalized = new Position({ x: hex.col, y: hex.row }).getNormalized();
                return { x: normalized.x, y: normalized.y };
              });

              if (filtered.size === 0) {
                const refreshed = await buildExplorationSnapshot({
                  store,
                  explorerId,
                  scopeRadius: entry.scopeRadius ?? DEFAULT_SCOPE_RADIUS,
                  worldSpatialProjection,
                });
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

            const actionType = ActionPaths.getActionType(selection.path);
            await actions.moveArmy({ explorerId, path: selection.path, currentArmiesTick });

            const effectiveCost = computeEffectiveStaminaCost(selection.path, actionType, exploreStaminaCost);
            const remainingStamina = Math.max(0, Number(currentStamina.amount) - effectiveCost);
            const shouldRepeat = shouldRepeatExplore(actionType, remainingStamina, exploreStaminaCost);
            const repeatAt = nowMs + REPEAT_EXPLORE_DELAY_MS;

            if (shouldRepeat) {
              const endHex = selection.path[selection.path.length - 1]?.hex;
              if (endHex) {
                const normalized = new Position({ x: endHex.col, y: endHex.row }).getNormalized();
                const cache = snapshotCacheRef.current.get(entry.id);
                if (cache) {
                  cache.recentlyExplored.add(`${normalized.x},${normalized.y}`);
                  cache.reusableUntilProjectionChange = true;
                }
              }
            }

            update(entry.id, {
              lastRunAt: nowMs,
              lastAction: selection.reason,
              blockedReason: null,
              lastError: null,
              ...(shouldRepeat ? { nextRunAt: repeatAt } : {}),
            });
            if (!shouldRepeat) {
              scheduleNext(entry.id, nowMs);
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            update(entry.id, {
              lastError: message,
              blockedReason: "error",
            });
            toast.error("Exploration automation failed.");
            scheduleNext(entry.id, nowMs);
          }
        }
      } finally {
        processingRef.current = false;
        scheduleNextCheck();
      }
    };
  }, [account, store, scheduleNext, scheduleNextCheck, stopAutomation, remove, resolveExplorerEntity, update]);

  useEffect(() => {
    scheduleNextCheck();
    return () => {
      if (timeoutIdRef.current !== null) {
        window.clearTimeout(timeoutIdRef.current);
      }
      unsubscribeProjectionRef.current?.();
      unsubscribeProjectionRef.current = null;
      subscribedProjectionRef.current = null;
    };
  }, [scheduleNextCheck]);
};
