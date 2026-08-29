import { POLLING_INTERVALS } from "@/config/polling";
import { gameEntityKey } from "@/sync/game-scope";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { RESOURCE_ARRIVAL_AUTO_CLAIM_RETRY_DELAY_SECONDS, RESOURCE_ARRIVAL_READY_BUFFER_SECONDS } from "@/ui/constants";
import { VERBOSE_LOGS_ENABLED } from "@/utils/dev-mode";
import { isExplicitSpectateSession } from "@/utils/spectator-session";
import { resolveFiniteSeasonEndAt, resolveSeasonStartTimestamp } from "@/ui/features/world/utils/season-timing";
import { extractTransactionHash, resolveTransactionFromGameStream } from "@/ui/utils/transactions";
import {
  clearUncertainClaimSharePointsSubmission,
  isNoHashSubmissionTimeout,
  rememberUncertainClaimSharePointsSubmission,
  shouldSkipAutomaticClaimSharePointsSubmission,
} from "@/ui/utils/uncertain-transaction-registry";
import {
  ClientConfigManager,
  DEFAULT_COORD_ALT,
  formatArmies,
  formatArrivals,
  getAddressName,
  getEntityIdFromKeys,
  getGuildFromPlayerAddress,
  LeaderboardManager,
  ResourceManager,
  ResourceArrivalManager,
  SelectableArmy,
  summarizeIncomingTroopArrivals,
} from "@bibliothecadao/eternum";
import { useDojo, usePlayerStructures } from "@bibliothecadao/react";
import {
  ClientComponents,
  ContractAddress,
  EntityType,
  ResourceArrivalInfo,
  ResourcesIds,
  WORLD_CONFIG_ID,
} from "@bibliothecadao/types";
import type { PlayerRelicsData } from "@/types";
import { useEntityQuery } from "@dojoengine/react";
import { ComponentValue, getComponentValue, Has } from "@dojoengine/recs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { env } from "../../env";

const getArrivalKey = (arrival: ResourceArrivalInfo) =>
  `${arrival.structureEntityId}-${arrival.day}-${arrival.slot.toString()}`;

const useFormattedResourceArrivals = (components: ClientComponents): ResourceArrivalInfo[] => {
  const resourceArrivalEntities = useEntityQuery([Has(components.ResourceArrival)]);

  return useMemo(
    () =>
      formatArrivals(
        resourceArrivalEntities
          .map((entity) => getComponentValue(components.ResourceArrival, entity))
          .filter(
            (arrival): arrival is ComponentValue<ClientComponents["ResourceArrival"]["schema"]> =>
              arrival !== undefined && arrival !== null,
          ),
      ),
    [components.ResourceArrival, resourceArrivalEntities],
  );
};

const ResourceArrivalsStoreManager = () => {
  const setArrivedArrivalsNumber = useUIStore((state) => state.setArrivedArrivalsNumber);
  const setPendingArrivalsNumber = useUIStore((state) => state.setPendingArrivalsNumber);
  const playerStructures = useUIStore((state) => state.playerStructures);
  const gameEndAt = useUIStore((state) => state.gameEndAt);
  const gameWinner = useUIStore((state) => state.gameWinner);
  const chainNowMs = useChainTimeStore((state) => state.nowMs);
  const getChainNowSeconds = useChainTimeStore((state) => state.getNowSeconds);
  const {
    account: { account },
    setup: { components, systemCalls },
  } = useDojo();
  const autoClaimedArrivals = useRef<Set<string>>(new Set());
  const lastFailureRef = useRef<Map<string, number>>(new Map());
  const isAutoClaimingRef = useRef(false);
  const autoClaimTimeoutIdRef = useRef<number | null>(null);
  const processAutoClaimRef = useRef<() => Promise<void>>(async () => {});
  const resourceArrivals = useFormattedResourceArrivals(components);
  const playerResourceArrivals = useMemo(() => {
    const playerStructureIds = new Set(playerStructures.map((structure) => structure.entityId));
    return resourceArrivals.filter((arrival) => playerStructureIds.has(arrival.structureEntityId));
  }, [playerStructures, resourceArrivals]);

  const stopAutoClaim = useCallback(() => {
    if (autoClaimTimeoutIdRef.current !== null) {
      window.clearTimeout(autoClaimTimeoutIdRef.current);
      autoClaimTimeoutIdRef.current = null;
    }
    isAutoClaimingRef.current = false;
  }, []);

  const isSeasonOver = useCallback(
    (nowSeconds?: number) => {
      if (gameWinner) return true;
      if (typeof gameEndAt !== "number") return false;
      const timestamp = typeof nowSeconds === "number" ? nowSeconds : getChainNowSeconds();
      return timestamp >= gameEndAt;
    },
    [gameEndAt, gameWinner, getChainNowSeconds],
  );

  const updateArrivalIndicators = useCallback(
    (arrivals: ResourceArrivalInfo[], nowOverride?: number) => {
      const now = nowOverride ?? getChainNowSeconds();
      const filteredArrivals = arrivals.filter((arrival) => !autoClaimedArrivals.current.has(getArrivalKey(arrival)));
      const arrived = filteredArrivals.filter(
        (arrival) => now >= Number(arrival.arrivesAt) + RESOURCE_ARRIVAL_READY_BUFFER_SECONDS,
      );
      const pending = Math.max(filteredArrivals.length - arrived.length, 0);

      setArrivedArrivalsNumber(arrived.length);
      setPendingArrivalsNumber(pending);
    },
    [getChainNowSeconds, setArrivedArrivalsNumber, setPendingArrivalsNumber],
  );

  const scheduleNextAutoClaim = useCallback(() => {
    if (isSeasonOver()) {
      stopAutoClaim();
      return;
    }
    if (autoClaimTimeoutIdRef.current !== null) {
      window.clearTimeout(autoClaimTimeoutIdRef.current);
    }

    const now = Date.now();
    const nextBlockMs = (Math.floor(now / 1000) + 1) * 1000;
    const delay = Math.max(250, nextBlockMs - now);

    autoClaimTimeoutIdRef.current = window.setTimeout(() => {
      void processAutoClaimRef.current();
    }, delay);
  }, [isSeasonOver, stopAutoClaim]);

  useEffect(() => {
    updateArrivalIndicators(playerResourceArrivals, Math.floor(chainNowMs / 1000));
  }, [chainNowMs, playerResourceArrivals, updateArrivalIndicators]);

  useEffect(() => {
    processAutoClaimRef.current = async () => {
      const seasonNow = getChainNowSeconds();
      if (isSeasonOver(seasonNow)) {
        stopAutoClaim();
        return;
      }
      if (isAutoClaimingRef.current) {
        scheduleNextAutoClaim();
        return;
      }

      if (!account || !account.address || account.address === "0x0") {
        autoClaimedArrivals.current.clear();
        lastFailureRef.current.clear();
        updateArrivalIndicators([]);
        scheduleNextAutoClaim();
        return;
      }

      if (playerStructures.length === 0) {
        autoClaimedArrivals.current.clear();
        lastFailureRef.current.clear();
        updateArrivalIndicators([]);
        scheduleNextAutoClaim();
        return;
      }

      const arrivals = playerResourceArrivals;

      if (arrivals.length === 0) {
        autoClaimedArrivals.current.clear();
        lastFailureRef.current.clear();
        updateArrivalIndicators([]);
        scheduleNextAutoClaim();
        return;
      }

      const activeArrivalKeys = new Set(arrivals.map((arrival) => getArrivalKey(arrival)));
      const staleClaimedKeys: string[] = [];
      autoClaimedArrivals.current.forEach((key) => {
        if (!activeArrivalKeys.has(key)) {
          staleClaimedKeys.push(key);
        }
      });
      staleClaimedKeys.forEach((key) => autoClaimedArrivals.current.delete(key));

      const staleFailureKeys: string[] = [];
      lastFailureRef.current.forEach((_, key) => {
        if (!activeArrivalKeys.has(key)) {
          staleFailureKeys.push(key);
        }
      });
      staleFailureKeys.forEach((key) => lastFailureRef.current.delete(key));

      const retryDelaySeconds = RESOURCE_ARRIVAL_AUTO_CLAIM_RETRY_DELAY_SECONDS;
      const now = seasonNow;
      updateArrivalIndicators(arrivals, now);
      const readyArrivals = arrivals
        .filter((arrival) => arrival.resources.length > 0)
        .filter((arrival) => now >= Number(arrival.arrivesAt) + RESOURCE_ARRIVAL_READY_BUFFER_SECONDS);

      if (readyArrivals.length === 0) {
        scheduleNextAutoClaim();
        return;
      }

      isAutoClaimingRef.current = true;

      try {
        const sortedReadyArrivals = readyArrivals.toSorted((a, b) => Number(a.arrivesAt) - Number(b.arrivesAt));

        for (const arrival of sortedReadyArrivals) {
          const arrivalKey = getArrivalKey(arrival);

          if (autoClaimedArrivals.current.has(arrivalKey)) {
            continue;
          }

          const lastFailure = lastFailureRef.current.get(arrivalKey);
          if (lastFailure && now - lastFailure < retryDelaySeconds) {
            continue;
          }

          try {
            const resourceArrivalManager = new ResourceArrivalManager(components, systemCalls, arrival);
            await resourceArrivalManager.offload(account, arrival.resources.length);
            autoClaimedArrivals.current.add(arrivalKey);
            lastFailureRef.current.delete(arrivalKey);
          } catch (error) {
            console.error("Auto-claim arrival failed", { arrival, error });
            lastFailureRef.current.set(arrivalKey, now);
          }
        }
      } finally {
        isAutoClaimingRef.current = false;
        updateArrivalIndicators(arrivals, now);
        scheduleNextAutoClaim();
      }
    };

    scheduleNextAutoClaim();

    return () => {
      if (autoClaimTimeoutIdRef.current !== null) {
        window.clearTimeout(autoClaimTimeoutIdRef.current);
      }
      isAutoClaimingRef.current = false;
    };
  }, [
    account,
    components,
    getChainNowSeconds,
    isSeasonOver,
    playerResourceArrivals,
    playerStructures,
    scheduleNextAutoClaim,
    stopAutoClaim,
    systemCalls,
    updateArrivalIndicators,
  ]);

  return null;
};

const PublicTroopArrivalsStoreManager = () => {
  const setPublicIncomingTroopArrivalsByStructure = useUIStore(
    (state) => state.setPublicIncomingTroopArrivalsByStructure,
  );
  const {
    setup: { components },
  } = useDojo();
  const resourceArrivals = useFormattedResourceArrivals(components);

  useEffect(() => {
    const nowSeconds = useChainTimeStore.getState().getNowSeconds();
    setPublicIncomingTroopArrivalsByStructure(summarizeIncomingTroopArrivals(resourceArrivals, nowSeconds));
  }, [resourceArrivals, setPublicIncomingTroopArrivalsByStructure]);

  return null;
};

const RelicsStoreManager = () => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const setPlayerRelics = useUIStore((state) => state.setPlayerRelics);
  const setPlayerRelicsLoading = useUIStore((state) => state.setPlayerRelicsLoading);
  const relicsRefreshNonce = useUIStore((state) => state.relicsRefreshNonce);
  const resourceEntities = useEntityQuery([Has(components.Resource)]);

  useEffect(() => {
    if (!account.address || account.address === "0x0") {
      setPlayerRelics(null);
      setPlayerRelicsLoading(false);
      return;
    }

    const accountAddress = BigInt(account.address);
    const relicsData = resourceEntities.reduce<PlayerRelicsData>(
      (result, entity) => {
        const resource = getComponentValue(components.Resource, entity);
        if (!resource) return result;

        const relics = ResourceManager.getResourceBalances(resource).filter(
          ({ resourceId }) =>
            resourceId >= ResourcesIds.StaminaRelic1 && resourceId <= ResourcesIds.TroopProductionRelic2,
        );
        if (relics.length === 0) return result;

        const entityId = resource.entity_id;
        const structure = getComponentValue(components.Structure, gameEntityKey([BigInt(entityId)]));
        if (structure?.owner === accountAddress) {
          result.structures.push({
            entityId,
            structureType: structure.base.category,
            type: EntityType.STRUCTURE,
            position: {
              alt: DEFAULT_COORD_ALT,
              x: structure.base.coord_x,
              y: structure.base.coord_y,
            },
            relics,
          });
          return result;
        }

        const army = getComponentValue(components.ExplorerTroops, gameEntityKey([BigInt(entityId)]));
        const ownerStructure = army
          ? getComponentValue(components.Structure, gameEntityKey([BigInt(army.owner)]))
          : undefined;
        if (army && ownerStructure?.owner === accountAddress) {
          result.armies.push({
            entityId,
            type: EntityType.ARMY,
            position: { alt: army.coord.alt, x: army.coord.x, y: army.coord.y },
            relics,
          });
        }
        return result;
      },
      { structures: [], armies: [] },
    );

    setPlayerRelics(relicsData);
    setPlayerRelicsLoading(false);
  }, [account.address, components, relicsRefreshNonce, resourceEntities, setPlayerRelics, setPlayerRelicsLoading]);

  return null;
};

const AUTO_REGISTER_POINTS_DEBUG = VERBOSE_LOGS_ENABLED;

const AutoRegisterPointsStoreManager = () => {
  const {
    account: { account },
    network,
    setup: {
      components,
      systemCalls: { claim_share_points },
    },
  } = useDojo();

  const isProcessingRef = useRef(false);
  const hyperstructure_entities = useEntityQuery([Has(components.Hyperstructure)]);
  // Read through a ref so entity churn doesn't tear down and re-register the
  // interval (it produced several parallel "Interval set" registrations at boot).
  const hyperstructureEntitiesRef = useRef(hyperstructure_entities);
  hyperstructureEntitiesRef.current = hyperstructure_entities;

  useEffect(() => {
    // No usable account (spectators, pre-login): no interval at all — the
    // effect re-runs via deps when an account connects.
    if (!account?.address || account.address === "0x0") {
      return;
    }

    const log = (...args: unknown[]) => {
      if (AUTO_REGISTER_POINTS_DEBUG) {
        console.log("[AutoRegisterPoints]", ...args);
      }
    };

    const checkAndRegisterPoints = async () => {
      log("Checking points...");

      // Guard: skip if already processing
      if (isProcessingRef.current) {
        log("Skipped: already processing");
        return;
      }

      // Get current points
      const leaderboardManager = LeaderboardManager.instance(components);
      const registeredPoints = leaderboardManager.getPlayerRegisteredPoints(ContractAddress(account.address));
      const unregisteredPoints = leaderboardManager.getPlayerHyperstructureUnregisteredShareholderPoints(
        ContractAddress(account.address),
      );

      log(`Registered: ${registeredPoints}, Unregistered: ${unregisteredPoints}`);

      // Check condition: any unregistered points to claim
      if (unregisteredPoints <= 0) {
        log("Skipped: no unregistered points");
        return;
      }

      // Get completed hyperstructure IDs
      const hyperstructureIds = hyperstructureEntitiesRef.current
        .map((entity) => getComponentValue(components.Hyperstructure, entity))
        .filter((hs) => hs?.completed)
        .map((hs) => hs?.hyperstructure_id)
        .filter((id) => id !== undefined);

      if (hyperstructureIds.length === 0) {
        log("Skipped: no completed hyperstructures");
        return;
      }

      log(`Registering points for ${hyperstructureIds.length} hyperstructures...`);

      // Execute registration
      isProcessingRef.current = true;
      let txHash: string | null = null;
      try {
        const playerAddress = ContractAddress(account.address);
        if (shouldSkipAutomaticClaimSharePointsSubmission(playerAddress)) {
          log("Skipped: unresolved no-hash claim submission");
          return;
        }
        const claimedPointsAtSubmit = leaderboardManager.getPlayerHyperstructureUnregisteredShareholderPoints(
          playerAddress,
          { ignorePendingClaimOverride: true },
        );

        const transactionResult = await claim_share_points({
          signer: account,
          hyperstructure_ids: hyperstructureIds,
        });
        txHash = extractTransactionHash(transactionResult);

        if (claimedPointsAtSubmit > 0) {
          leaderboardManager.setPendingSharePointsClaim(playerAddress, claimedPointsAtSubmit, txHash ?? undefined);
        }
        leaderboardManager.updatePoints();
        log("Points registration transaction submitted", txHash);

        if (txHash) {
          await resolveTransactionFromGameStream({
            txHash,
            label: "auto-register points",
          });
        }

        leaderboardManager.confirmPendingSharePointsClaim(playerAddress, txHash ?? undefined);
        clearUncertainClaimSharePointsSubmission(playerAddress);
        log("Points registered successfully");

        // Refresh leaderboard
        leaderboardManager.forceRefresh();
        leaderboardManager.updatePoints();
        log("Leaderboard refreshed");
      } catch (error) {
        if (isNoHashSubmissionTimeout(error)) {
          rememberUncertainClaimSharePointsSubmission({
            walletAddress: ContractAddress(account.address),
            failureKind: "submission_timeout_no_hash",
          });
        }
        leaderboardManager.clearPendingSharePointsClaim(ContractAddress(account.address), txHash ?? undefined);
        leaderboardManager.updatePoints();
        console.error("[AutoRegisterPoints] Failed:", error);
      } finally {
        isProcessingRef.current = false;
      }
    };

    // Run immediately on mount
    checkAndRegisterPoints();

    // Set up interval
    log(`Interval set: ${POLLING_INTERVALS.autoRegisterPointsMs}ms`);
    const intervalId = setInterval(checkAndRegisterPoints, POLLING_INTERVALS.autoRegisterPointsMs);

    return () => clearInterval(intervalId);
  }, [account, components, claim_share_points, network.provider]);

  return null;
};

const PlayerStructuresStoreManager = () => {
  const playerStructures = usePlayerStructures();
  const setPlayerStructures = useUIStore((state) => state.setPlayerStructures);

  useEffect(() => {
    // Explicit spectator sessions are pure observers: publishing no owned
    // structures here removes ALL ownership chrome (structure panel, cycling,
    // auto-flips) at the single chokepoint every consumer reads from.
    setPlayerStructures(isExplicitSpectateSession() ? [] : playerStructures);
  }, [playerStructures, setPlayerStructures]);

  return null;
};

const ButtonStateStoreManager = () => {
  const {
    account: { account },
  } = useDojo();

  const setDisableButtons = useUIStore((state) => state.setDisableButtons);
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const playerStructures = useUIStore((state) => state.playerStructures);

  const structureIsMine = useMemo(
    () => playerStructures.some((structure) => structure.entityId === structureEntityId),
    [playerStructures, structureEntityId],
  );

  useEffect(() => {
    const seasonHasStarted = env.VITE_PUBLIC_SEASON_START_TIME < Date.now() / 1000;
    const disableButtons = !structureIsMine || account.address === "0x0" || !seasonHasStarted;
    setDisableButtons(disableButtons);
  }, [setDisableButtons, structureIsMine, account.address]);

  return null;
};

const SeasonWinnerStoreManager = () => {
  const {
    setup: { components },
  } = useDojo();
  const setSeasonWinner = useUIStore((state) => state.setGameWinner);
  const seasonEndedEntities = useEntityQuery([Has(components.events.SeasonEnded)]);
  const seasonEnded = useMemo(
    () =>
      seasonEndedEntities
        .map((entity) => getComponentValue(components.events.SeasonEnded, entity))
        .filter((value) => value !== undefined)
        .toSorted((left, right) => right.timestamp - left.timestamp)[0],
    [components.events.SeasonEnded, seasonEndedEntities],
  );

  useEffect(() => {
    if (seasonEnded) {
      const addressName = getAddressName(ContractAddress(seasonEnded.winner_address), components);
      const guildName = getGuildFromPlayerAddress(ContractAddress(seasonEnded.winner_address), components)?.name;
      setSeasonWinner({
        address: ContractAddress(seasonEnded.winner_address),
        name: addressName ?? "Unknown",
        guildName: guildName ?? "Unknown",
      });
    }
  }, [seasonEnded, setSeasonWinner, components]);

  return null;
};

const SeasonTimerStoreManager = () => {
  const {
    setup: { components },
  } = useDojo();
  const setGameEndAt = useUIStore((state) => state.setGameEndAt);
  const setSeasonStartMainAt = useUIStore((state) => state.setGameStartMainAt);
  const setDevModeOn = useUIStore((state) => state.setDevModeOn);

  useEffect(() => {
    // Per-game clock: on s2 this reads the active game's GameRegistry row via
    // the scoped config manager so one game's clock cannot leak into another.
    const cfg = ClientConfigManager.instance();
    const season = cfg.getSeasonConfig();
    setGameEndAt(resolveFiniteSeasonEndAt(season.endAt || undefined));
    setSeasonStartMainAt(resolveSeasonStartTimestamp(season.startMainAt || undefined));

    // Sandbox / dev games bypass the chain's settling/main-phase/season-end
    // time gates, so mirror dev_mode_on to keep the client gates in sync.
    setDevModeOn(Boolean(cfg.getDevModeConfig().dev_mode_on));
  }, [components, setGameEndAt, setSeasonStartMainAt, setDevModeOn]);
  return null;
};

/**
 * Manager component that syncs army and structure data with scene-specific shortcut managers
 * This replaces the old centralized ShortcutManager approach
 */
const SelectableArmiesStoreManager = () => {
  const setSelectableArmies = useUIStore((state) => state.setSelectableArmies);
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const explorers = useEntityQuery([Has(components.ExplorerTroops)]);

  useEffect(() => {
    const playerAddress = ContractAddress(account.address || "0x0");
    const formattedArmies = formatArmies(explorers, playerAddress, components);

    const selectableArmies: SelectableArmy[] = formattedArmies
      .filter((army) => army.isMine)
      .map((army) => ({
        entityId: army.entityId,
      }));

    setSelectableArmies(selectableArmies);
  }, [account.address, components, explorers, setSelectableArmies]);

  return null;
};

export const StoreManagers = () => {
  return (
    <>
      <ResourceArrivalsStoreManager />
      <PublicTroopArrivalsStoreManager />
      <RelicsStoreManager />
      <AutoRegisterPointsStoreManager />
      <PlayerStructuresStoreManager />
      <ButtonStateStoreManager />
      <SeasonWinnerStoreManager />
      <SeasonTimerStoreManager />
      <SelectableArmiesStoreManager />
    </>
  );
};
