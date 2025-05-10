import { useDojo } from "@bibliothecadao/react";
import { useEffect } from "react";
import { SettlementLocation } from "./settlement-types";
import useSettlementStore from "./settlementStore";

/**
 * Custom hook for managing settlement state using Zustand
 */
export const useSettlementState = (maxLayers: number, extraPlayerOccupiedLocations: SettlementLocation[] = []) => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const { selectedLocation, availableLocations, settledLocations, bankLocations, bankIcon, selectedCoords, actions } =
    useSettlementStore();

  useEffect(() => {
    actions.fetchBankLocations(components);
    // The startPollingOccupiedLocations action now returns a cleanup function.
    const cleanupPolling = actions.startPollingOccupiedLocations(
      account?.address,
      components,
      maxLayers,
      extraPlayerOccupiedLocations,
    );

    return () => {
      cleanupPolling();
    };
  }, [account?.address, components, maxLayers]);

  return {
    // Location state
    selectedLocation,
    setSelectedLocation: actions.setSelectedLocation,
    availableLocations,
    settledLocations,
    bankLocations,
    selectedCoords,

    // Resources state
    bankIcon,
    setBankIcon: actions.setBankIcon,
  };
};
