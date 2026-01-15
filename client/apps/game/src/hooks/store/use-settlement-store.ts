import { Position } from "@bibliothecadao/eternum";

import {
  generateSettlementLocations,
  getBanksLocations,
  getOccupiedLocations,
  SettlementLocation,
} from "@/ui/features/settlement";
import { ClientComponents, ContractAddress } from "@bibliothecadao/types";
import { create } from "zustand";

interface SettlementState {
  selectedLocation: SettlementLocation | null;
  availableLocations: SettlementLocation[];
  settledLocations: SettlementLocation[];
  bankLocations: SettlementLocation[];
  bankIcon: HTMLImageElement | null;
  selectedCoords: Position | null;
  actions: SettlementActions;
  // State for managing polling to prevent multiple intervals
  pollingIntervalId: NodeJS.Timeout | null;
  pollingTimeoutId: NodeJS.Timeout | null; // For the 30-min auto-stop
}

interface SettlementActions {
  setSelectedLocation: (location: SettlementLocation | null) => void;
  setBankIcon: (icon: HTMLImageElement | null) => void;
  fetchBankLocations: (components: ClientComponents) => void;
  fetchOccupiedLocations: (
    accountAddress: string | undefined,
    maxLayers: number,
    extraPlayerOccupiedLocations?: SettlementLocation[],
  ) => Promise<void>;
  startPollingOccupiedLocations: (
    accountAddress: string | undefined,
    components: ClientComponents,
    maxLayers: number,
    extraPlayerOccupiedLocations?: SettlementLocation[],
  ) => () => void; // Returns a cleanup function
}

const useSettlementStore = create<SettlementState>((set, get) => ({
  selectedLocation: null,
  availableLocations: [],
  settledLocations: [],
  bankLocations: [],
  bankIcon: null,
  selectedCoords: null,
  pollingIntervalId: null,
  pollingTimeoutId: null,
  actions: {
    setSelectedLocation: (location) => {
      let selectedCoordsValue: Position | null = null;
      if (location) {
        selectedCoordsValue = new Position({
          x: location.x,
          y: location.y,
        }); //.getNormalized(); // Assuming Position constructor normalizes or getNormalized() is called elsewhere if needed by consumers
      }
      set({ selectedLocation: location, selectedCoords: selectedCoordsValue });
    },
    setBankIcon: (icon) => set({ bankIcon: icon }),
    fetchBankLocations: (components) => {
      const bankLocations = getBanksLocations(components);
      set({ bankLocations });
    },
    fetchOccupiedLocations: async (accountAddress, maxLayers, extraPlayerOccupiedLocations = []) => {
      if (!accountAddress) {
        set({
          settledLocations: [...extraPlayerOccupiedLocations],
          availableLocations: generateSettlementLocations(maxLayers)[0],
        });
        return;
      }

      const [allLocations, allLocationsMap] = generateSettlementLocations(maxLayers);
      set({ availableLocations: allLocations });

      const occupiedLocations = await getOccupiedLocations(ContractAddress(accountAddress), allLocationsMap);
      const locations = [...occupiedLocations, ...extraPlayerOccupiedLocations];
      set({ settledLocations: locations });
    },
    startPollingOccupiedLocations: (accountAddress, components, maxLayers, extraPlayerOccupiedLocations = []) => {
      // Clear any existing polling interval and timeout from the store
      if (get().pollingIntervalId) {
        clearInterval(get().pollingIntervalId!);
        console.log("Store: Cleared existing polling interval.");
      }
      if (get().pollingTimeoutId) {
        clearTimeout(get().pollingTimeoutId!);
        console.log("Store: Cleared existing polling timeout.");
      }
      // Nullify them immediately in the state before setting new ones
      set({ pollingIntervalId: null, pollingTimeoutId: null });

      // Initial fetch
      get().actions.fetchOccupiedLocations(accountAddress, maxLayers, extraPlayerOccupiedLocations);

      const newIntervalId = setInterval(() => {
        console.log("Store: Polling occupied locations...");
        get().actions.fetchOccupiedLocations(accountAddress, maxLayers, extraPlayerOccupiedLocations);
      }, 5 * 1000);

      const newTimeoutId = setTimeout(
        () => {
          console.log("Store: 30-minute timeout reached. Stopping settlement polling.");
          clearInterval(newIntervalId); // Clear this specific interval
          // Check if this timeout is still the active one before nullifying store state
          if (get().pollingTimeoutId === newTimeoutId) {
            set({ pollingTimeoutId: null });
          }
          // Also, ensure the interval is marked as stopped if this timeout was for it
          if (get().pollingIntervalId === newIntervalId) {
            set({ pollingIntervalId: null });
          }
        },
        30 * 60 * 1000,
      );

      set({ pollingIntervalId: newIntervalId, pollingTimeoutId: newTimeoutId });
      console.log(`Store: Started new polling interval (ID: ${newIntervalId}) and timeout (ID: ${newTimeoutId}).`);

      // Cleanup function for this specific polling instance
      return () => {
        console.log(
          `Store: Cleanup called for polling instance (Interval ID: ${newIntervalId}, Timeout ID: ${newTimeoutId}).`,
        );
        clearInterval(newIntervalId);
        clearTimeout(newTimeoutId);

        // Only nullify in store if these are the *current* active IDs
        if (get().pollingIntervalId === newIntervalId) {
          set({ pollingIntervalId: null });
          console.log("Store: Active polling interval cleaned up from store state.");
        }
        if (get().pollingTimeoutId === newTimeoutId) {
          set({ pollingTimeoutId: null });
          console.log("Store: Active polling timeout cleaned up from store state.");
        }
      };
    },
  },
}));

export default useSettlementStore;
