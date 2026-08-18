import {
  ActionPaths,
  ActionType,
  ArmyActionManager,
  configManager,
  getBlockTimestamp,
  Position,
  StaminaManager,
} from "@bibliothecadao/eternum";
import { getActiveGameSyncRuntime } from "@bibliothecadao/eternum/game-sync";
import type { WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";
import { useDojo } from "@bibliothecadao/react";
import { ContractAddress } from "@bibliothecadao/types";
import { getComponentValue, getEntityString } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@bibliothecadao/eternum";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import type { Account, AccountInterface } from "starknet";

import { getExplorationStrategy } from "@/automation/exploration";
import { buildExplorationSnapshot } from "@/automation/exploration/map-cache";
import type { ExplorationMapSnapshot } from "@/automation/exploration/types";
import {
  DEFAULT_SCOPE_RADIUS,
  DEFAULT_STRATEGY_ID,
  useExplorationAutomationStore,
} from "@/hooks/store/use-exploration-automation-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { gameEntityKey } from "@/dojo/game-scope";
import {
  computeEffectiveStaminaCost,
  filterFreshExplorationPaths,
  selectDueEntries,
  shouldRepeatExplore,
} from "./exploration-automation-planner";

const isExplorerOwnedByAccount = (
  components: any,
  explorerOwnerEntityId: number,
  accountAddress: string | undefined,
): boolean => {
  if (!accountAddress) return false;

  // explorer.owner is a realm/structure entity ID, not an address
  // Look up the Structure to get the actual player address
  const structureEntity = gameEntityKey([BigInt(explorerOwnerEntityId)]);
  const structure = getComponentValue(components.Structure, structureEntity);
  if (!structure?.owner) return false;

  // Compare using ContractAddress for proper normalization
  return ContractAddress(structure.owner) === ContractAddress(accountAddress);
};

const REPEAT_EXPLORE_DELAY_MS = 3_000;

type SnapshotCache = {
  snapshot: ExplorationMapSnapshot;
  reusableUntilProjectionChange: boolean;
  recentlyExplored: Set<string>;
};

export const useExplorationAutomationRunner = () => {
  const {
    setup: { components, systemCalls },
    account: { account },
  } = useDojo();

  const entries = useExplorationAutomationStore((s) => s.entries);
  const update = useExplorationAutomationStore((s) => s.update);
  const scheduleNext = useExplorationAutomationStore((s) => s.scheduleNext);
  const remove = useExplorationAutomationStore((s) => s.remove);
  const pruneForGame = useExplorationAutomationStore((s) => s.pruneForGame);
  const gameEndAt = useUIStore((state) => state.gameEndAt);
  const gameWinner = useUIStore((state) => state.gameWinner);

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
    (explorerId: number) => {
      if (!components) {
        return { explorer: undefined };
      }

      const primaryEntity = gameEntityKey([BigInt(explorerId)]);
      let explorer = getComponentValue(components.ExplorerTroops, primaryEntity);
      if (explorer) {
        return { explorer };
      }

      console.warn(
        `[ExplorationAutomation] resolveExplorerEntity: primary lookup failed for explorerId=${explorerId}, falling back to linear scan`,
      );
      const explorerIdMap = components.ExplorerTroops.values.explorer_id;
      for (const [entitySymbol, value] of explorerIdMap.entries()) {
        if (Number(value) === explorerId) {
          const entityId = getEntityString(entitySymbol);
          explorer = getComponentValue(components.ExplorerTroops, entityId);
          if (explorer) {
            return { explorer };
          }
        }
      }

      return { explorer: undefined };
    },
    [components],
  );

  const stopAutomation = useCallback(() => {
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
    // Clear snapshot cache when game changes - old snapshots are invalid
    snapshotCacheRef.current.clear();
  }, [components, pruneForGame]);

  const scheduleNextCheck = useCallback(() => {
    if (isSeasonOver()) {
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
  }, [isSeasonOver, stopAutomation]);

  useEffect(() => {
    processRef.current = async () => {
      if (isSeasonOver()) {
        stopAutomation();
        return;
      }
      if (processingRef.current) {
        scheduleNextCheck();
        return;
      }
      const worldSpatialProjection = getActiveGameSyncRuntime()?.getWorldSpatialProjection();
      if (!components || !worldSpatialProjection) {
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
      if (isSeasonOver(currentBlockTimestamp)) {
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

            if (!isExplorerOwnedByAccount(components, explorer.owner, account.address)) {
              // Explorer owned by someone else - remove automation
              remove(entry.id);
              snapshotCacheRef.current.delete(entry.id);
              continue;
            }

            // Check stamina before doing anything - wait for regen if too low
            const staminaManager = new StaminaManager(components, explorerId);
            const currentStamina = staminaManager.getStamina(currentArmiesTick);
            const exploreStaminaCost = configManager.getExploreStaminaCost();
            if (Number(currentStamina.amount) < exploreStaminaCost) {
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
                    components,
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

            const manager = new ArmyActionManager(components, systemCalls, explorerId);
            const actionPaths = manager.findActionPaths(
              snapshot.structureHexes,
              snapshot.armyHexes,
              snapshot.exploredTiles,
              snapshot.chestHexes,
              currentDefaultTick,
              currentArmiesTick,
              ContractAddress(account.address),
            );
            let actionPathMap = actionPaths.getPaths();

            if (useFastCache && cached) {
              const filtered = filterFreshExplorationPaths(actionPathMap, cached.recentlyExplored, (hex) => {
                const normalized = new Position({ x: hex.col, y: hex.row }).getNormalized();
                return { x: normalized.x, y: normalized.y };
              });

              if (filtered.size === 0) {
                const refreshed = await buildExplorationSnapshot({
                  components,
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
                const refreshedPaths = manager.findActionPaths(
                  snapshot.structureHexes,
                  snapshot.armyHexes,
                  snapshot.exploredTiles,
                  snapshot.chestHexes,
                  currentDefaultTick,
                  currentArmiesTick,
                  ContractAddress(account.address),
                );
                actionPathMap = refreshedPaths.getPaths();
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
            const isExplored = actionType === ActionType.Move;
            await manager.moveArmy(
              account as Account | AccountInterface,
              selection.path,
              isExplored,
              currentArmiesTick,
            );

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
  }, [
    account,
    components,
    isSeasonOver,
    scheduleNext,
    scheduleNextCheck,
    stopAutomation,
    systemCalls,
    remove,
    resolveExplorerEntity,
    update,
  ]);

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
