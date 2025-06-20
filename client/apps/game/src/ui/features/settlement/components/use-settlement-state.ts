import { useDojo } from "@bibliothecadao/react";
import { useEffect } from "react";
import { SettlementLocation } from "../utils/settlement-types";
import useSettlementStore from "@/hooks/store/use-settlement-store";

/**
 * Custom hook for managing settlement state using Zustand
 */
export const useSettlementState = (maxLayers: number, extraPlayerOccupiedLocations: SettlementLocation[] = []) => {
  const {
    account: { account },
    setup: { components },
  } = useDojo();

  const selectedLocation = useSettlementStore((state) => state.selectedLocation);
  const actions = useSettlementStore((state) => state.actions);
  const availableLocations = useSettlementStore((state) => state.availableLocations);
  const settledLocations = useSettlementStore((state) => state.settledLocations);
  const bankLocations = useSettlementStore((state) => state.bankLocations);
  const bankIcon = useSettlementStore((state) => state.bankIcon);
  const selectedCoords = useSettlementStore((state) => state.selectedCoords);

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
