import { POLLING_INTERVALS } from "@/config/polling";
import { useMinigameStore } from "@/hooks/store/use-minigame-store";
import { usePlayerStore } from "@/hooks/store/use-player-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { sqlApi } from "@/services/api";
import {
  configManager,
  formatArmies,
  getAddressName,
  getAllArrivals,
  getBlockTimestamp,
  getEntityIdFromKeys,
  getEntityInfo,
  getGuildFromPlayerAddress,
  getIsBlitz,
  ResourceArrivalManager,
  SelectableArmy,
} from "@bibliothecadao/eternum";
import { useDojo, usePlayerStructures } from "@bibliothecadao/react";
import { SeasonEnded } from "@bibliothecadao/torii";
import { ContractAddress, ResourceArrivalInfo, TickIds, WORLD_CONFIG_ID } from "@bibliothecadao/types";
import { useEntityQuery } from "@dojoengine/react";
import { getComponentValue, Has } from "@dojoengine/recs";
import { useGameSettingsMetadata, useMiniGames } from "metagame-sdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { env } from "../../env";

const getArrivalKey = (arrival: ResourceArrivalInfo) =>
  `${arrival.structureEntityId}-${arrival.day}-${arrival.slot.toString()}`;

const ResourceArrivalsStoreManager = () => {
  const setArrivedArrivalsNumber = useUIStore((state) => state.setArrivedArrivalsNumber);
  const setPendingArrivalsNumber = useUIStore((state) => state.setPendingArrivalsNumber);
  const playerStructures = useUIStore((state) => state.playerStructures);
  const {
    account: { account },
    setup: { components, systemCalls },
  } = useDojo();
  const autoClaimedArrivals = useRef<Set<string>>(new Set());
  const lastFailureRef = useRef<Map<string, number>>(new Map());
  const isAutoClaimingRef = useRef(false);
  const autoClaimTimeoutIdRef = useRef<number | null>(null);
  const processAutoClaimRef = useRef<() => Promise<void>>(async () => {});

  const updateArrivalIndicators = useCallback(
    (arrivals: ResourceArrivalInfo[], nowOverride?: number) => {
      const now = nowOverride ?? getBlockTimestamp().currentBlockTimestamp;
      const filteredArrivals = arrivals.filter((arrival) => !autoClaimedArrivals.current.has(getArrivalKey(arrival)));
      const arrived = filteredArrivals.filter((arrival) => arrival.arrivesAt <= now);
      const pending = Math.max(filteredArrivals.length - arrived.length, 0);

      setArrivedArrivalsNumber(arrived.length);
      setPendingArrivalsNumber(pending);
    },
    [setArrivedArrivalsNumber, setPendingArrivalsNumber],
  );

  const scheduleNextAutoClaim = useCallback(() => {
    if (autoClaimTimeoutIdRef.current !== null) {
      window.clearTimeout(autoClaimTimeoutIdRef.current);
    }

    const now = Date.now();
    const nextBlockMs = (Math.floor(now / 1000) + 1) * 1000;
    const delay = Math.max(250, nextBlockMs - now);

    autoClaimTimeoutIdRef.current = window.setTimeout(() => {
      void processAutoClaimRef.current();
    }, delay);
  }, []);

  useEffect(() => {
    const updateArrivals = () => {
      const arrivals = getAllArrivals(
        playerStructures.map((structure) => structure.entityId),
        components,
      );
      updateArrivalIndicators(arrivals);
    };

    // Initial update
    updateArrivals();

    // Set up interval to run periodically (configurable)
    const intervalId = setInterval(updateArrivals, POLLING_INTERVALS.resourceArrivalsMs);

    // Cleanup interval on unmount
    return () => clearInterval(intervalId);
  }, [playerStructures, components, updateArrivalIndicators]);

  useEffect(() => {
    processAutoClaimRef.current = async () => {
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

      const structureIds = playerStructures.map((structure) => structure.entityId);
      const arrivals = getAllArrivals(structureIds, components);

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

      const blockDelaySeconds = Number(configManager.getTick(TickIds.Default));
      const retryDelaySeconds = Math.max(blockDelaySeconds, 1);
      const now = getBlockTimestamp().currentBlockTimestamp;
      updateArrivalIndicators(arrivals, now);
      const readyArrivals = arrivals
        .filter((arrival) => arrival.resources.length > 0)
        .filter((arrival) => now >= Number(arrival.arrivesAt) + blockDelaySeconds);

      if (readyArrivals.length === 0) {
        scheduleNextAutoClaim();
        return;
      }

      isAutoClaimingRef.current = true;

      try {
        readyArrivals.sort((a, b) => Number(a.arrivesAt) - Number(b.arrivesAt));

        for (const arrival of readyArrivals) {
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
  }, [account?.address, components, systemCalls, playerStructures, scheduleNextAutoClaim]);

  return null;
};

const RelicsStoreManager = () => {
  const {
    account: { account },
  } = useDojo();

  const setPlayerRelics = useUIStore((state) => state.setPlayerRelics);
  const setPlayerRelicsLoading = useUIStore((state) => state.setPlayerRelicsLoading);
  const relicsRefreshNonce = useUIStore((state) => state.relicsRefreshNonce);

  const isMountedRef = useRef(true);
  const lastHandledRefresh = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchPlayerRelics = useCallback(
    async (showLoading = true) => {
      if (!isMountedRef.current) {
        return;
      }

      if (!account.address || account.address === "0x0") {
        setPlayerRelics(null);
        setPlayerRelicsLoading(false);
        return;
      }

      if (showLoading) {
        setPlayerRelicsLoading(true);
      }

      try {
        const relicsData = await sqlApi.fetchAllPlayerRelics(account.address);
        console.log("relicsData", relicsData, account.address, isMountedRef.current);
        if (!isMountedRef.current) {
          return;
        }

        setPlayerRelics(relicsData);
      } catch (error) {
        if (isMountedRef.current) {
          console.error("Failed to update available relics:", error);
        }
      } finally {
        if (showLoading && isMountedRef.current) {
          setPlayerRelicsLoading(false);
        }
      }
    },
    [account.address, setPlayerRelics, setPlayerRelicsLoading],
  );

  useEffect(() => {
    if (!account.address || account.address === "0x0") {
      if (isMountedRef.current) {
        setPlayerRelics(null);
        setPlayerRelicsLoading(false);
      }
      return;
    }

    fetchPlayerRelics(true);

    const intervalId = setInterval(() => {
      fetchPlayerRelics(false);
    }, 10000);

    return () => {
      clearInterval(intervalId);
    };
  }, [account.address, fetchPlayerRelics, setPlayerRelics, setPlayerRelicsLoading]);

  useEffect(() => {
    if (!account.address || account.address === "0x0") {
      lastHandledRefresh.current = relicsRefreshNonce;
      return;
    }

    if (relicsRefreshNonce === lastHandledRefresh.current) {
      return;
    }

    lastHandledRefresh.current = relicsRefreshNonce;

    if (relicsRefreshNonce === 0) {
      return;
    }

    fetchPlayerRelics(true);
  }, [account.address, fetchPlayerRelics, relicsRefreshNonce]);

  return null;
};

const PlayerStructuresStoreManager = () => {
  const playerStructures = usePlayerStructures();
  const setPlayerStructures = useUIStore((state) => state.setPlayerStructures);

  useEffect(() => {
    setPlayerStructures(playerStructures);
  }, [playerStructures, setPlayerStructures]);

  return null;
};

const ButtonStateStoreManager = () => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const setDisableButtons = useUIStore((state) => state.setDisableButtons);
  const structureEntityId = useUIStore((state) => state.structureEntityId);

  const structureInfo = useMemo(
    () => getEntityInfo(structureEntityId, ContractAddress(account.address), components, getIsBlitz()),
    [structureEntityId, account.address, components],
  );

  const structureIsMine = useMemo(() => structureInfo.isMine, [structureInfo]);

  const seasonHasStarted = useMemo(() => env.VITE_PUBLIC_SEASON_START_TIME < Date.now() / 1000, []);

  useEffect(() => {
    const disableButtons = !structureIsMine || account.address === "0x0" || !seasonHasStarted;
    setDisableButtons(disableButtons);
  }, [setDisableButtons, structureIsMine, account.address, seasonHasStarted]);

  return null;
};

const PlayerDataStoreManager = () => {
  const {
    account: { account },
  } = useDojo();

  const initializePlayerStore = usePlayerStore((state) => state.initializePlayerStore);
  const getCurrentPlayerData = usePlayerStore((state) => state.getCurrentPlayerData);
  const playerDataStore = usePlayerStore((state) => state.playerDataStore);

  // Initialize the player store on mount
  useEffect(() => {
    if (!playerDataStore) {
      initializePlayerStore();
    }
  }, [initializePlayerStore, playerDataStore]);

  // Update current player data when account changes
  useEffect(() => {
    if (account?.address && playerDataStore) {
      getCurrentPlayerData(account.address);
    }
  }, [account?.address, getCurrentPlayerData, playerDataStore]);

  return null;
};

const SeasonWinnerStoreManager = () => {
  const {
    setup: { components },
  } = useDojo();
  const setSeasonWinner = useUIStore((state) => state.setGameWinner);
  const [seasonEnded, setSeasonEnded] = useState<SeasonEnded | null>(null);

  useEffect(() => {
    const fetchSeasonEnded = async () => {
      const seasonEnded = await sqlApi.fetchSeasonEnded();
      setSeasonEnded(seasonEnded);
    };
    fetchSeasonEnded();
  }, []);

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

  useEffect(() => {
    // Try to get season_config.end_at from WorldConfig
    const worldConfig = getComponentValue(components.WorldConfig, getEntityIdFromKeys([WORLD_CONFIG_ID]));
    const endAt = worldConfig?.season_config?.end_at;
    if (endAt && typeof endAt === "number") {
      setGameEndAt(endAt);
    }
    const startMainAt = worldConfig?.season_config?.start_main_at;
    if (startMainAt && typeof startMainAt === "number") {
      setSeasonStartMainAt(startMainAt);
    }
  }, [components, setGameEndAt, setSeasonStartMainAt]);
  return null;
};

const MinigameStoreManager = () => {
  const minigameStore = useMinigameStore.getState();

  const { data: minigames } = useMiniGames({});

  const minigameAddresses = useMemo(() => minigames?.map((m) => m.contract_address) ?? [], [minigames]);

  const { data: settingsMetadata } = useGameSettingsMetadata({
    gameAddresses: minigameAddresses,
  });

  useEffect(() => {
    if (minigames) {
      minigameStore.setMinigames(minigames);
    }

    if (settingsMetadata) {
      minigameStore.setSettingsMetadata(settingsMetadata);
    }
  }, [minigames, settingsMetadata, minigameStore]);

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
        position: { col: army.position.x ?? 0, row: army.position.y ?? 0 },
        name: army.name,
      }));

    setSelectableArmies(selectableArmies);
  }, [account.address, components, explorers, setSelectableArmies]);

  return null;
};

export const StoreManagers = () => {
  return (
    <>
      <MinigameStoreManager />
      <ResourceArrivalsStoreManager />
      <RelicsStoreManager />
      <PlayerStructuresStoreManager />
      <ButtonStateStoreManager />
      <PlayerDataStoreManager />
      <SeasonWinnerStoreManager />
      <SeasonTimerStoreManager />
      <SelectableArmiesStoreManager />
    </>
  );
};
