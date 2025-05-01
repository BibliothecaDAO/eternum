import { Position } from "@/types/position";
import { useDojo } from "@bibliothecadao/react";
import { ContractAddress } from "@bibliothecadao/types";
import { useEffect, useMemo, useState } from "react";
import { SettlementLocation } from "./settlement-types";
import { generateSettlementLocations, getBanksLocations, getOccupiedLocations } from "./settlement-utils";

/**
 * Custom hook for managing settlement state and animation
 */
export const useSettlementState = (maxLayers: number, extraPlayerOccupiedLocations: SettlementLocation[] = []) => {
  // Location state
  const [selectedLocation, setSelectedLocation] = useState<SettlementLocation | null>(null);
  const [availableLocations, setAvailableLocations] = useState<SettlementLocation[]>([]);
  const [settledLocations, setSettledLocations] = useState<SettlementLocation[]>([]);
  const [bankLocations, setBankLocations] = useState<SettlementLocation[]>([]);

  // Resources state
  const [bankIcon, setBankIcon] = useState<HTMLImageElement | null>(null);

  const {
    account: { account },
    setup: { components },
  } = useDojo();

  // Get normalized coordinates for the selected location
  const selectedCoords = useMemo(() => {
    if (!selectedLocation) return null;
    const normalizedCoords = new Position({
      x: selectedLocation.x,
      y: selectedLocation.y,
    }).getNormalized();
    return normalizedCoords;
  }, [selectedLocation]);

  // Fetch bank locations
  useEffect(() => {
    const bankLocations = getBanksLocations(components);
    setBankLocations(bankLocations);
  }, [components]);

  // Fetch occupied locations
  useEffect(() => {
    const fetchOccupiedLocations = async () => {
      console.log("fetching occupied locations");
      if (!account?.address) return;

      // Generate all possible settlement locations
      const [allLocations, allLocationsMap] = generateSettlementLocations(maxLayers);

      setAvailableLocations(allLocations);

      const occupiedLocations = await getOccupiedLocations(
        ContractAddress(account.address),
        components,
        allLocationsMap,
      );

      // Fetch occupied locations
      const locations = [...occupiedLocations, ...extraPlayerOccupiedLocations];
      // Move this here, so it only happens once after fetching
      setSettledLocations(locations);
    };

    // Initial fetch
    fetchOccupiedLocations();

    // Set up polling interval (every 30 seconds)
    const intervalId = setInterval(fetchOccupiedLocations, 30 * 1000);

    // Set up timeout to clear interval after 30 minutes
    const timeoutId = setTimeout(
      () => {
        clearInterval(intervalId);
      },
      30 * 60 * 1000,
    );

    // Cleanup function
    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [account?.address, components, extraPlayerOccupiedLocations, maxLayers]);

  return {
    // Location state
    selectedLocation,
    setSelectedLocation,
    availableLocations,
    settledLocations,
    bankLocations,
    selectedCoords,

    // Resources state
    bankIcon,
    setBankIcon,
  };
};
