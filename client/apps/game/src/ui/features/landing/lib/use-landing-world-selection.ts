import { useEffect, useMemo, useState } from "react";

import { type FactoryWorld, useFactoryWorlds } from "@/hooks/use-factory-worlds";
import { getWorldKey, useWorldsAvailability } from "@/hooks/use-world-availability";
import type { Chain } from "@contracts";

const CHAIN_OPTIONS: Chain[] = ["mainnet", "slot"];
const DEFAULT_CHAIN: Chain = "mainnet";

interface UseLandingWorldSelectionOptions {
  storageKeyPrefix: string;
}

interface LandingWorldSelection {
  selectedChain: Chain;
  selectedWorld: string | null;
  availableWorlds: FactoryWorld[];
  isLoading: boolean;
  isCheckingAvailability: boolean;
  setSelectedChain: (chain: Chain) => void;
  setSelectedWorld: (worldName: string | null) => void;
  toriiBaseUrl: string | null;
}

const buildStorageKey = (prefix: string, suffix: string) => `landing-${prefix}-${suffix}`;

const loadStoredChain = (prefix: string): Chain | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const key = buildStorageKey(prefix, "chain");
  const stored = window.localStorage.getItem(key);
  if (stored && CHAIN_OPTIONS.includes(stored as Chain)) {
    return stored as Chain;
  }

  return null;
};

const loadStoredWorld = (prefix: string): string | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const key = buildStorageKey(prefix, "world");
  return window.localStorage.getItem(key) || null;
};

const saveToStorage = (prefix: string, suffix: string, value: string | null) => {
  if (typeof window === "undefined") {
    return;
  }

  const key = buildStorageKey(prefix, suffix);
  if (value === null) {
    window.localStorage.removeItem(key);
  } else {
    window.localStorage.setItem(key, value);
  }
};

const buildToriiBaseUrl = (worldName: string): string => `https://api.cartridge.gg/x/${worldName}/torii/sql`;

export const useLandingWorldSelection = ({
  storageKeyPrefix,
}: UseLandingWorldSelectionOptions): LandingWorldSelection => {
  const [selectedChain, setSelectedChainState] = useState<Chain>(DEFAULT_CHAIN);
  const [selectedWorld, setSelectedWorldState] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const { worlds: factoryWorlds, isLoading: isLoadingWorlds } = useFactoryWorlds([selectedChain], true);

  // Check availability of all factory worlds
  const worldRefs = useMemo(
    () => factoryWorlds.map((world) => ({ name: world.name, chain: world.chain })),
    [factoryWorlds],
  );
  const { results: availabilityResults, isAnyLoading: isCheckingAvailability } = useWorldsAvailability(
    worldRefs,
    !isLoadingWorlds && factoryWorlds.length > 0,
  );

  // Filter to only show worlds with active Torii
  const availableWorlds = useMemo(() => {
    if (isLoadingWorlds || isCheckingAvailability) {
      return [];
    }

    return factoryWorlds.filter((world) => {
      const worldKey = getWorldKey({ name: world.name, chain: world.chain });
      const availability = availabilityResults.get(worldKey);
      return availability?.isAvailable === true;
    });
  }, [factoryWorlds, availabilityResults, isLoadingWorlds, isCheckingAvailability]);

  useEffect(() => {
    const storedChain = loadStoredChain(storageKeyPrefix);
    if (storedChain) {
      setSelectedChainState(storedChain);
    }

    const storedWorld = loadStoredWorld(storageKeyPrefix);
    if (storedWorld) {
      setSelectedWorldState(storedWorld);
    }

    setIsInitialized(true);
  }, [storageKeyPrefix]);

  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    saveToStorage(storageKeyPrefix, "chain", selectedChain);
  }, [storageKeyPrefix, selectedChain, isInitialized]);

  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    saveToStorage(storageKeyPrefix, "world", selectedWorld);
  }, [storageKeyPrefix, selectedWorld, isInitialized]);

  // Clear selected world if it becomes unavailable
  useEffect(() => {
    if (!isInitialized || isLoadingWorlds || isCheckingAvailability || !selectedWorld) {
      return;
    }

    const worldExists = availableWorlds.some((world) => world.name === selectedWorld);
    if (!worldExists) {
      setSelectedWorldState(null);
    }
  }, [availableWorlds, selectedWorld, isLoadingWorlds, isCheckingAvailability, isInitialized]);

  const setSelectedChain = (chain: Chain) => {
    setSelectedChainState(chain);
    setSelectedWorldState(null);
  };

  const setSelectedWorld = (worldName: string | null) => {
    setSelectedWorldState(worldName);
  };

  const toriiBaseUrl = useMemo(() => {
    if (!selectedWorld) {
      return null;
    }

    return buildToriiBaseUrl(selectedWorld);
  }, [selectedWorld]);

  return {
    selectedChain,
    selectedWorld,
    availableWorlds,
    isLoading: isLoadingWorlds,
    isCheckingAvailability,
    setSelectedChain,
    setSelectedWorld,
    toriiBaseUrl,
  };
};

export { CHAIN_OPTIONS };
export type { LandingWorldSelection };
