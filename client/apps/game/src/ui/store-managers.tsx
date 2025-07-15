import { useBattleLogsStore } from "@/hooks/store/use-battle-logs-store";
import { usePlayerStore } from "@/hooks/store/use-player-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { sqlApi } from "@/services/api";
import { getBlockTimestamp } from "@/utils/timestamp";
import { getAddressName, getAllArrivals, getEntityIdFromKeys, getEntityInfo, getGuildFromPlayerAddress } from "@bibliothecadao/eternum";
import { useDojo, usePlayerStructures } from "@bibliothecadao/react";
import { SeasonEnded } from "@bibliothecadao/torii";
import { ContractAddress, WORLD_CONFIG_ID } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
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
    () => getEntityInfo(structureEntityId, ContractAddress(account.address), components),
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
  const setSeasonWinner = useUIStore((state) => state.setSeasonWinner);
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
  const setSeasonEndAt = useUIStore((state) => state.setSeasonEndAt);
  const setSeasonStartMainAt = useUIStore((state) => state.setSeasonStartMainAt);

  useEffect(() => {
    // Try to get season_config.end_at from WorldConfig
    const worldConfig = getComponentValue(components.WorldConfig, getEntityIdFromKeys([WORLD_CONFIG_ID]));
    const endAt = worldConfig?.season_config?.end_at;
    if (endAt && typeof endAt === "number") {
      setSeasonEndAt(endAt);
    }
    const startMainAt = worldConfig?.season_config?.start_main_at;
    if (startMainAt && typeof startMainAt === "number") {
      setSeasonStartMainAt(startMainAt);
    }
  }, [components, setSeasonEndAt, setSeasonStartMainAt]);
  return null;
};

export const StoreManagers = () => {
  return (
    <>
      <ResourceArrivalsStoreManager />
      <PlayerStructuresStoreManager />
      <ButtonStateStoreManager />
      <PlayerDataStoreManager />
      <BattleLogsStoreManager />
      <SeasonWinnerStoreManager />
      <SeasonTimerStoreManager />
    </>
  );
};
