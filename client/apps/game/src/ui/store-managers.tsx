import { useBattleLogsStore } from "@/hooks/store/use-battle-logs-store";
import { useMinigameStore } from "@/hooks/store/use-minigame-store";
import { usePlayerStore } from "@/hooks/store/use-player-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { sqlApi } from "@/services/api";
import {
  getAddressName,
  getAllArrivals,
  getBlockTimestamp,
  getEntityIdFromKeys,
  getEntityInfo,
  getGuildFromPlayerAddress,
  getIsBlitz,
  formatArmies,
  SelectableArmy,
} from "@bibliothecadao/eternum";
import { useDojo, usePlayerStructures } from "@bibliothecadao/react";
import { SeasonEnded } from "@bibliothecadao/torii";
import { ContractAddress, WORLD_CONFIG_ID } from "@bibliothecadao/types";
import { useEntityQuery } from "@dojoengine/react";
import { getComponentValue, Has } from "@dojoengine/recs";
import { useGameSettingsMetadata, useMiniGames } from "metagame-sdk";
import { useEffect, useMemo, useRef, useState } from "react";
import { env } from "../../env";

const ResourceArrivalsStoreManager = () => {
  const setArrivedArrivalsNumber = useUIStore((state) => state.setArrivedArrivalsNumber);
  const setPendingArrivalsNumber = useUIStore((state) => state.setPendingArrivalsNumber);
  const playerStructures = useUIStore((state) => state.playerStructures);
  const {
    setup: { components },
  } = useDojo();

  useEffect(() => {
    const updateArrivals = () => {
      const arrivals = getAllArrivals(
        playerStructures.map((structure) => structure.entityId),
        components,
      );
      const arrived = arrivals.filter((arrival) => arrival.arrivesAt <= getBlockTimestamp().currentBlockTimestamp);
      setArrivedArrivalsNumber(arrived.length);
      setPendingArrivalsNumber(arrivals.length - arrived.length);
    };

    // Initial update
    updateArrivals();

    // Set up interval to run every 20 seconds
    const intervalId = setInterval(updateArrivals, 20000);

    // Cleanup interval on unmount
    return () => clearInterval(intervalId);
  }, [playerStructures, components, setArrivedArrivalsNumber, setPendingArrivalsNumber]);
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

const BattleLogsStoreManager = () => {
  const fetchInitialBattleLogs = useBattleLogsStore((state) => state.fetchInitialBattleLogs);
  const fetchNewBattleLogs = useBattleLogsStore((state) => state.fetchNewBattleLogs);
  const battleLogs = useBattleLogsStore((state) => state.battleLogs);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize battle logs on mount
  useEffect(() => {
    // Fetch initial data only if we don't have any logs
    if (battleLogs.length === 0) {
      fetchInitialBattleLogs();
    }
  }, [fetchInitialBattleLogs, battleLogs.length]);

  // Set up periodic refresh for new battle logs
  useEffect(() => {
    const startPeriodicRefresh = () => {
      // Clear any existing interval
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }

      // Set up new interval to fetch new logs every minute
      refreshIntervalRef.current = setInterval(() => {
        fetchNewBattleLogs();
      }, 60 * 1000);
    };

    // Start periodic refresh after initial load
    if (battleLogs.length > 0) {
      startPeriodicRefresh();
    }

    // Clean up interval on unmount
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [fetchNewBattleLogs, battleLogs.length]);

  // Handle page visibility change to refresh when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && battleLogs.length > 0) {
        // Fetch new logs when page becomes visible
        fetchNewBattleLogs();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchNewBattleLogs, battleLogs.length]);

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
      <PlayerStructuresStoreManager />
      <ButtonStateStoreManager />
      <PlayerDataStoreManager />
      <BattleLogsStoreManager />
      <SeasonWinnerStoreManager />
      <SeasonTimerStoreManager />
      <SelectableArmiesStoreManager />
    </>
  );
};
