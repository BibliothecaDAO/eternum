import { useUIStore } from "@/hooks/store/use-ui-store";
import { getBlockTimestamp } from "@/utils/timestamp";
import { getAllArrivals, getEntityInfo } from "@bibliothecadao/eternum";
import { useDojo, usePlayerStructures } from "@bibliothecadao/react";
import { ContractAddress } from "@bibliothecadao/types";
import { useEffect, useMemo } from "react";
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

export const StoreManagers = () => {
  return (
    <>
      <ResourceArrivalsStoreManager />
      <PlayerStructuresStoreManager />
      <ButtonStateStoreManager />
    </>
  );
};
