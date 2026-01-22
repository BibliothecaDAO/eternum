import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { useDojo } from "@bibliothecadao/react";
import {
  ActionPaths,
  ActionType,
  ArmyActionManager,
  configManager,
  getBlockTimestamp,
} from "@bibliothecadao/eternum";
import type { Account, AccountInterface } from "starknet";
import { ContractAddress } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";

import { useUIStore } from "@/hooks/store/use-ui-store";
import {
  DEFAULT_SCOPE_RADIUS,
  DEFAULT_STRATEGY_ID,
  useExplorationAutomationStore,
} from "@/hooks/store/use-exploration-automation-store";
import { buildExplorationSnapshot } from "@/automation/exploration/map-cache";
import { getExplorationStrategy } from "@/automation/exploration";

const normalizeOwnerValue = (owner: unknown): string | null => {
  if (typeof owner === "string") return owner.trim().toLowerCase();
  if (typeof owner === "bigint") return `0x${owner.toString(16)}`;
  if (typeof owner === "number" && Number.isFinite(owner)) return `0x${BigInt(owner).toString(16)}`;
  return null;
};

const isOwnedByAccount = (owner: unknown, accountAddress: string | undefined): boolean => {
  if (!accountAddress) return false;
  const normalizedOwner = normalizeOwnerValue(owner);
  const normalizedAccount = normalizeOwnerValue(accountAddress);
  return Boolean(normalizedOwner && normalizedAccount && normalizedOwner === normalizedAccount);
};

export const useExplorationAutomationRunner = () => {
  const {
    setup: { components, systemCalls, network },
    account: { account },
  } = useDojo();

  const entries = useExplorationAutomationStore((s) => s.entries);
  const update = useExplorationAutomationStore((s) => s.update);
  const toggleActive = useExplorationAutomationStore((s) => s.toggleActive);
  const scheduleNext = useExplorationAutomationStore((s) => s.scheduleNext);
  const pruneForGame = useExplorationAutomationStore((s) => s.pruneForGame);
  const gameEndAt = useUIStore((state) => state.gameEndAt);
  const gameWinner = useUIStore((state) => state.gameWinner);

  const processingRef = useRef(false);
  const processRef = useRef<() => Promise<void>>(async () => {});
  const timeoutIdRef = useRef<number | null>(null);

  const activeEntries = useMemo(() => Object.values(entries).filter((e) => e.active), [entries]);
  const debugEnabled =
    typeof window !== "undefined" && window.localStorage.getItem("debugExplorationAutomation") === "true";
  const logDebug = useCallback(
    (...args: unknown[]) => {
      if (debugEnabled) {
        // eslint-disable-next-line no-console
        console.debug("[exploration-automation]", ...args);
      }
    },
    [debugEnabled],
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
  }, [components, pruneForGame]);

  const scheduleNextCheck = useCallback(() => {
    if (isSeasonOver()) {
      logDebug("season-over");
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
  }, [isSeasonOver, logDebug, stopAutomation]);

  useEffect(() => {
    processRef.current = async () => {
      if (isSeasonOver()) {
        logDebug("season-over");
        stopAutomation();
        return;
      }
      if (processingRef.current) {
        logDebug("skip-processing");
        scheduleNextCheck();
        return;
      }
      if (!components || !network?.toriiClient || !network?.contractComponents) {
        logDebug("missing-deps", { hasComponents: Boolean(components), hasTorii: Boolean(network?.toriiClient) });
        scheduleNextCheck();
        return;
      }
      if (!account || !account.address || account.address === "0x0") {
        logDebug("missing-account");
        scheduleNextCheck();
        return;
      }

      const { currentBlockTimestamp, currentDefaultTick, currentArmiesTick } = getBlockTimestamp();
      if (isSeasonOver(currentBlockTimestamp)) {
        stopAutomation();
        return;
      }

      const nowMs = currentBlockTimestamp * 1000;
      const due = activeEntries.filter((entry) => {
        if (typeof entry.nextRunAt === "number") {
          return entry.nextRunAt <= nowMs;
        }
        return entry.nextRunAt == null;
      });

      if (!due.length) {
        logDebug("no-due-entries", { active: activeEntries.length, nowMs });
        scheduleNextCheck();
        return;
      }

      logDebug("processing", { due: due.length, active: activeEntries.length, nowMs });
      processingRef.current = true;

      try {
        for (const entry of due) {
          try {
            const explorerId = Number(entry.explorerId);
            if (!Number.isFinite(explorerId) || explorerId <= 0) {
              update(entry.id, { blockedReason: "invalid-explorer", lastError: null });
              logDebug("invalid-explorer", { entryId: entry.id, explorerId: entry.explorerId });
              scheduleNext(entry.id, nowMs);
              continue;
            }

            const explorerEntity = getEntityIdFromKeys([BigInt(explorerId)]);
            const explorer = getComponentValue(components.ExplorerTroops, explorerEntity);
            if (!explorer) {
              update(entry.id, { blockedReason: "missing-explorer", lastError: null });
              logDebug("missing-explorer", { entryId: entry.id, explorerId });
              scheduleNext(entry.id, nowMs);
              continue;
            }

            const battleCooldownEnd = Number(explorer.troops?.battle_cooldown_end ?? 0);
            if (battleCooldownEnd > currentArmiesTick) {
              toggleActive(entry.id, false);
              update(entry.id, {
                blockedReason: "battle",
                lastAction: "disabled",
                nextRunAt: null,
              });
              logDebug("blocked-battle", { entryId: entry.id, explorerId, battleCooldownEnd, currentArmiesTick });
              continue;
            }

            if (!isOwnedByAccount(explorer.owner, account.address)) {
              toggleActive(entry.id, false);
              update(entry.id, {
                blockedReason: "not-owned",
                lastAction: "disabled",
                nextRunAt: null,
              });
              logDebug("blocked-not-owned", { entryId: entry.id, explorerOwner: explorer.owner, account: account.address });
              continue;
            }

            const snapshot = await buildExplorationSnapshot({
              components,
              contractComponents: network.contractComponents,
              toriiClient: network.toriiClient,
              explorerId,
              scopeRadius: entry.scopeRadius ?? DEFAULT_SCOPE_RADIUS,
            });

            if (!snapshot) {
              update(entry.id, { blockedReason: "no-snapshot", lastError: null });
              logDebug("blocked-no-snapshot", { entryId: entry.id, explorerId });
              scheduleNext(entry.id, nowMs);
              continue;
            }

            const manager = new ArmyActionManager(components, systemCalls, explorerId);
            const actionPaths = manager.findActionPaths(
              snapshot.structureHexes,
              snapshot.armyHexes,
              snapshot.exploredTiles,
              snapshot.questHexes,
              snapshot.chestHexes,
              currentDefaultTick,
              currentArmiesTick,
              ContractAddress(account.address),
            );

            const strategy = getExplorationStrategy(entry.strategyId ?? DEFAULT_STRATEGY_ID);
            const selection = strategy.selectNextAction({
              ...snapshot,
              explorerId,
              actionPaths: actionPaths.getPaths(),
            });

            if (!selection) {
              update(entry.id, { blockedReason: "no-paths", lastError: null });
              logDebug("blocked-no-paths", { entryId: entry.id, explorerId });
              scheduleNext(entry.id, nowMs);
              continue;
            }

            const isExplored = ActionPaths.getActionType(selection.path) === ActionType.Move;
            await manager.moveArmy(account as Account | AccountInterface, selection.path, isExplored, currentArmiesTick);

            update(entry.id, {
              lastRunAt: nowMs,
              lastAction: selection.reason,
              blockedReason: null,
              lastError: null,
            });
            logDebug("moved", { entryId: entry.id, explorerId, reason: selection.reason });
            scheduleNext(entry.id, nowMs);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            update(entry.id, {
              lastError: message,
              blockedReason: "error",
            });
            logDebug("error", { entryId: entry.id, message });
            toast.error("Exploration automation failed. Check console for details.");
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
    activeEntries,
    components,
    isSeasonOver,
    network?.contractComponents,
    network?.toriiClient,
    scheduleNext,
    scheduleNextCheck,
    stopAutomation,
    systemCalls,
    toggleActive,
    logDebug,
    update,
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
