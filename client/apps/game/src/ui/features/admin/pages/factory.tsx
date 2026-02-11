import { useAccountStore } from "@/hooks/store/use-account-store";
import { useFactorySeries, type FactorySeries } from "@/hooks/use-factory-series";
import { buildWorldProfile, patchManifestWithFactory } from "@/runtime/world";
import { Controller } from "@/ui/modules/controller/controller";
import { ETERNUM_CONFIG } from "@/utils/config";
import { EternumProvider } from "@bibliothecadao/provider";
import type { Config as EternumConfig } from "@bibliothecadao/types";
import {
  SetResourceFactoryConfig,
  setAgentConfig,
  setBattleConfig,
  setBlitzRegistrationConfig,
  setBuildingConfig,
  setCapacityConfig,
  setDiscoverableVillageSpawnResourcesConfig,
  setFactoryAddress as setFactoryAddressConfig,
  setGameModeConfig,
  setHyperstructureConfig,
  setMMRConfig,
  setRealmUpgradeConfig,
  setResourceBridgeFeesConfig,
  setSeasonConfig,
  setSettlementConfig,
  setSpeedConfig,
  setStartingResourcesConfig,
  setStructureMaxLevelConfig,
  setTradeConfig,
  setTroopConfig,
  setVRFConfig,
  setVictoryPointsConfig,
  setVillageControllersConfig,
  setWeightConfig,
  setWorldConfig,
  setupGlobals,
} from "@config-deployer/config";
import { getGameManifest, type Chain } from "@contracts";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronUp from "lucide-react/dist/esm/icons/chevron-up";
import Copy from "lucide-react/dist/esm/icons/copy";
import Download from "lucide-react/dist/esm/icons/download";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import XCircle from "lucide-react/dist/esm/icons/x-circle";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { shortString } from "starknet";
import { env } from "../../../../../env";
import { AdminHeader } from "../components/admin-header";
import {
  CARTRIDGE_API_BASE,
  DEFAULT_NAMESPACE,
  DEFAULT_VERSION,
  FACTORY_ADDRESSES,
  getDefaultBlitzRegistrationConfig,
  getDefaultMaxActionsForChain,
  getExplorerTxUrl,
  getFactoryDeployRepeatsForChain,
  getRpcUrlForChain,
} from "../constants";
import { useFactoryAdmin } from "../hooks/use-factory-admin";
import { generateCairoOutput, generateFactoryCalldata } from "../services/factory-config";
import {
  createIndexer as createIndexerService,
} from "../services/factory-indexer";
import { buildWorldConfigForFactory } from "../services/world-config-builder";
import { getManifestJsonString, type ChainType } from "../utils/manifest-loader";
import {
  cacheDeployedAddress,
  getConfiguredWorlds,
  getCurrentWorldName,
  getRemainingCooldown,
  getStoredWorldNames,
  getStoredWorldSeriesMetadata,
  isWorldOnCooldown,
  markWorldAsConfigured,
  persistStoredWorldNames,
  saveWorldNameToStorage,
  setCurrentWorldName,
  setIndexerCooldown,
  updateWorldSeriesMetadata,
  type WorldSeriesMetadata,
} from "../utils/storage";

type TxState = { status: "idle" | "running" | "success" | "error"; hash?: string; error?: string };
type AutoDeployState = { current: number; total: number; status: "running" | "stopping" };

// Maximum hours in the future that a game start time can be set
const MAX_START_TIME_HOURS = 50_000;

// Storage keys and cooldowns moved to ../constants and ../utils/storage

/**
 * Four-letter word dictionary for world name generation.
 * Curated for memorability, uniqueness, and thematic fit.
 */
const FOUR_LETTER_WORDS = [
  // Nature & Elements
  "fire",
  "wave",
  "gale",
  "mist",
  "dawn",
  "dusk",
  "rain",
  "snow",
  "sand",
  "clay",
  "iron",
  "gold",
  "jade",
  "ruby",
  "opal",
  // Actions & States
  "rush",
  "flow",
  "push",
  "pull",
  "burn",
  "heal",
  "grow",
  "fade",
  "rise",
  "fall",
  "soar",
  "dive",
  // Objects & Places
  "gate",
  "keep",
  "tomb",
  "fort",
  "maze",
  "peak",
  "vale",
  "cave",
  "rift",
  "void",
  "shard",
  "rune",
  // Abstract & Qualities
  "bold",
  "wild",
  "vast",
  "pure",
  "dark",
  "cold",
  "warm",
  "soft",
  "hard",
  "deep",
  "high",
  "true",
  // Mystical & Game-themed
  "myth",
  "epic",
  "sage",
  "lore",
  "fate",
  "doom",
  "fury",
  "zeal",
  "flux",
  "echo",
  "nova",
  "apex",
] as const;

/**
 * Generates a world name with format: ccf-xxxx-xxxx-##
 * Example output: "ccf-fire-gate-42", "ccf-dark-void-17"
 *
 * @returns A world name with CCF prefix, two 4-letter words, and 2-digit number
 */
const generateWorldName = (): string => {
  const getRandomWord = (): string => {
    const randomIndex = Math.floor(Math.random() * FOUR_LETTER_WORDS.length);
    return FOUR_LETTER_WORDS[randomIndex];
  };

  // Generate 2 unique words to avoid duplicates like "fire-fire"
  const words = new Set<string>();
  while (words.size < 2) {
    words.add(getRandomWord());
  }

  // Generate random 2-digit number (10-99)
  const randomNumber = Math.floor(Math.random() * 90) + 10;

  return `test-${Array.from(words).join("-")}-${randomNumber}`;
};

// Helpers moved to ../utils/storage

// Helper to check if a world is configured
const isWorldConfigured = (worldName: string): boolean => {
  try {
    const configured = getConfiguredWorlds();
    return configured.includes(worldName);
  } catch {
    return false;
  }
};

// Current world helpers moved to ../utils/storage

// Cooldown helpers moved to ../utils/storage

// ===== World deployed address cache helpers =====
// Deployed address cache helpers moved to ../utils/storage

// Helper to set cooldown for a world
// Cooldown helpers moved to ../utils/storage

// Utility: Convert text to felt252
const textToFelt = (text: string): string => {
  return shortString.encodeShortString(text);
};

// Utility: Convert text to felt252 with left padding (66 chars total including 0x)
const textToFeltPadded = (text: string): string => {
  const felt = shortString.encodeShortString(text);
  // Remove 0x prefix, pad to 64 chars, add 0x back
  const withoutPrefix = felt.slice(2);
  return "0x" + withoutPrefix.padStart(64, "0");
};

// Torii configuration payload will be built from constants per chain when needed

// Helper to parse manifest and generate factory config
interface ManifestContract {
  class_hash: string;
  tag: string;
  selector: string;
  init_calldata?: any[];
}

interface ManifestModel {
  class_hash: string;
  tag: string;
}

interface ManifestEvent {
  class_hash: string;
  tag: string;
}

interface ManifestData {
  world: {
    class_hash: string;
    seed: string;
  };
  contracts: ManifestContract[];
  models: ManifestModel[];
  events: ManifestEvent[];
  // Optional: libraries included in manifest
  libraries?: Array<{
    class_hash: string;
    tag?: string;
    version?: string;
    name?: string;
  }>;
}

// Calldata and Cairo generators moved to services/factory-config

interface FactoryPageProps {
  embedded?: boolean;
}

export const FactoryPage = ({ embedded = false }: FactoryPageProps = {}) => {
  const navigate = useNavigate();
  const { account, accountName } = useAccountStore();

  const currentChain = env.VITE_PUBLIC_CHAIN as ChainType;
  const { refreshStatuses, checkIndexerExists, getWorldDeployedAddressLocal } = useFactoryAdmin(currentChain);
  const factoryDeployRepeats = getFactoryDeployRepeatsForChain(currentChain);
  const defaultBlitzRegistration = useMemo(() => getDefaultBlitzRegistrationConfig(currentChain), [currentChain]);
  const {
    data: ownedSeries = [],
    isLoading: seriesLoading,
    isFetching: seriesFetching,
    error: seriesError,
    refetch: refetchSeries,
  } = useFactorySeries(currentChain as Chain, account?.address ?? null);

  const [factoryAddress, setFactoryAddress] = useState<string>("");
  const [version, setVersion] = useState<string>(DEFAULT_VERSION);
  const [namespace, setNamespace] = useState<string>(DEFAULT_NAMESPACE);
  const [worldName, setWorldName] = useState<string>("");
  const [seriesName, setSeriesName] = useState<string>("");
  const [seriesGameNumber, setSeriesGameNumber] = useState<string>("");
  const [seriesConfigName, setSeriesConfigName] = useState<string>("");
  const [seriesConfigTx, setSeriesConfigTx] = useState<TxState>({ status: "idle" });
  const [maxActions, setMaxActions] = useState<number>(() => getDefaultMaxActionsForChain(currentChain));
  const [defaultNamespaceWriterAll, setDefaultNamespaceWriterAll] = useState<boolean>(true);
  const [manifestJson, setManifestJson] = useState<string>("");
  const [parsedManifest, setParsedManifest] = useState<ManifestData | null>(null);
  const [tx, setTx] = useState<TxState>({ status: "idle" });
  const [generatedCalldata, setGeneratedCalldata] = useState<any[]>([]);
  const [showCairoOutput, setShowCairoOutput] = useState<boolean>(false);
  const [showFullConfig, setShowFullConfig] = useState<boolean>(false);
  const [showDevConfig, setShowDevConfig] = useState<boolean>(false);
  const [devModeOn, setDevModeOn] = useState<boolean>(() => {
    try {
      return !!ETERNUM_CONFIG()?.dev?.mode?.on;
    } catch {
      return false;
    }
  });
  const [mmrEnabledOn, setMmrEnabledOn] = useState<boolean>(() => {
    try {
      return !!ETERNUM_CONFIG()?.mmr?.enabled;
    } catch {
      return false;
    }
  });
  const [durationHours, setDurationHours] = useState<number>(() => {
    try {
      const secs = Number(ETERNUM_CONFIG()?.season?.durationSeconds || 0);
      return Math.max(1, Math.round(secs / 3600));
    } catch {
      return 24;
    }
  });
  const [storedWorldNames, setStoredWorldNames] = useState<string[]>([]);
  const [showStoredNames, setShowStoredNames] = useState<boolean>(true); // Show by default
  const [worldSeriesMetadata, setWorldSeriesMetadata] = useState<Record<string, WorldSeriesMetadata>>({});
  const [worldIndexerStatus, setWorldIndexerStatus] = useState<Record<string, boolean>>({});
  const [creatingIndexer, setCreatingIndexer] = useState<Record<string, boolean>>({});
  const [indexerActionErrors, setIndexerActionErrors] = useState<Record<string, string>>({});
  const [worldDeployedStatus, setWorldDeployedStatus] = useState<Record<string, boolean>>({});
  const [verifyingDeployment, setVerifyingDeployment] = useState<Record<string, boolean>>({});
  const [autoDeployState, setAutoDeployState] = useState<Record<string, AutoDeployState>>({});
  const autoDeployCancelRef = useRef<Record<string, boolean>>({});
  // Per-world config execution state
  const [worldConfigOpen, setWorldConfigOpen] = useState<Record<string, boolean>>({});
  const [worldConfigTx, setWorldConfigTx] = useState<Record<string, TxState>>({});
  // Per-world season start override (epoch seconds)
  const [startMainAtOverrides, setStartMainAtOverrides] = useState<Record<string, number>>({});
  const [startSettlingAtOverrides, setStartSettlingAtOverrides] = useState<Record<string, number>>({});
  const [startMainAtErrors, setStartMainAtErrors] = useState<Record<string, string>>({});
  const [startSettlingAtErrors, setStartSettlingAtErrors] = useState<Record<string, string>>({});
  // Per-world overrides
  const [devModeOverrides, setDevModeOverrides] = useState<Record<string, boolean>>({});
  const [mmrEnabledOverrides, setMmrEnabledOverrides] = useState<Record<string, boolean>>({});
  const [durationHoursOverrides, setDurationHoursOverrides] = useState<Record<string, number>>({});
  const [durationMinutesOverrides, setDurationMinutesOverrides] = useState<Record<string, number>>({});
  const [blitzFeeAmountOverrides, setBlitzFeeAmountOverrides] = useState<Record<string, string>>({});
  const [blitzFeePrecisionOverrides, setBlitzFeePrecisionOverrides] = useState<Record<string, string>>({});
  const [blitzFeeTokenOverrides, setBlitzFeeTokenOverrides] = useState<Record<string, string>>({});
  const [blitzFeeRecipientOverrides, setBlitzFeeRecipientOverrides] = useState<Record<string, string>>({});
  const [registrationCountMaxOverrides, setRegistrationCountMaxOverrides] = useState<Record<string, string>>({});
  const [registrationDelaySecondsOverrides, setRegistrationDelaySecondsOverrides] = useState<Record<string, string>>(
    {},
  );
  const [registrationPeriodSecondsOverrides, setRegistrationPeriodSecondsOverrides] = useState<
    Record<string, string>
  >({});
  const [factoryAddressOverrides, setFactoryAddressOverrides] = useState<Record<string, string>>({});
  const [singleRealmModeOverrides, setSingleRealmModeOverrides] = useState<Record<string, boolean>>({});
  const [seasonBridgeCloseAfterEndSecondsOverrides, setSeasonBridgeCloseAfterEndSecondsOverrides] = useState<
    Record<string, string>
  >({});
  const [
    seasonPointRegistrationCloseAfterEndSecondsOverrides,
    setSeasonPointRegistrationCloseAfterEndSecondsOverrides,
  ] = useState<Record<string, string>>({});
  const [settlementCenterOverrides, setSettlementCenterOverrides] = useState<Record<string, string>>({});
  const [settlementBaseDistanceOverrides, setSettlementBaseDistanceOverrides] = useState<Record<string, string>>({});
  const [settlementSubsequentDistanceOverrides, setSettlementSubsequentDistanceOverrides] = useState<
    Record<string, string>
  >({});
  const [tradeMaxCountOverrides, setTradeMaxCountOverrides] = useState<Record<string, string>>({});
  const [battleGraceTickCountOverrides, setBattleGraceTickCountOverrides] = useState<Record<string, string>>({});
  const [battleGraceTickCountHypOverrides, setBattleGraceTickCountHypOverrides] = useState<
    Record<string, string>
  >({});
  const [battleDelaySecondsOverrides, setBattleDelaySecondsOverrides] = useState<Record<string, string>>({});
  const [agentMaxCurrentCountOverrides, setAgentMaxCurrentCountOverrides] = useState<Record<string, string>>({});
  const [agentMaxLifetimeCountOverrides, setAgentMaxLifetimeCountOverrides] = useState<Record<string, string>>({});

  // Shared Eternum config (static values), manifest will be patched per-world at runtime
  const eternumConfig: EternumConfig = useMemo(() => ETERNUM_CONFIG(), []);
  const baseDurationMinutes = useMemo(() => {
    const secs = Number(eternumConfig?.season?.durationSeconds || 0);
    if (!Number.isFinite(secs) || secs <= 0) return 0;
    return Math.max(0, Math.round((secs % 3600) / 60));
  }, [eternumConfig]);

  // Check indexer and deployment status for all stored worlds
  const checkAllWorldStatuses = useCallback(async () => {
    const worlds = getStoredWorldNames();
    const { indexerStatusMap, deployedStatusMap } = await refreshStatuses(worlds);
    setWorldIndexerStatus(indexerStatusMap);
    setWorldDeployedStatus(deployedStatusMap);
  }, [refreshStatuses]);

  // Auto-load manifest and factory address on mount
  useEffect(() => {
    const defaultFactory = FACTORY_ADDRESSES[currentChain];
    if (defaultFactory) {
      setFactoryAddress(defaultFactory);
    }

    const manifest = getManifestJsonString(currentChain);
    if (manifest) {
      setManifestJson(manifest);
    }

    // Load stored world names
    setStoredWorldNames(getStoredWorldNames());
    setWorldSeriesMetadata(getStoredWorldSeriesMetadata());

    // Initialize world name from storage or generate new one
    const savedWorldName = getCurrentWorldName();
    if (savedWorldName) {
      setWorldName(savedWorldName);
    } else {
      const newWorldName = generateWorldName();
      setWorldName(newWorldName);
      setCurrentWorldName(newWorldName);
    }
  }, [currentChain]);

  // Generate world name when account name changes
  useEffect(() => {
    if (accountName && !worldName) {
      const newWorldName = generateWorldName();
      setWorldName(newWorldName);
      setCurrentWorldName(newWorldName);
    }
  }, [accountName, worldName]);

  // Check indexer and deployment statuses when stored world names change
  useEffect(() => {
    if (storedWorldNames.length > 0) {
      checkAllWorldStatuses();
    }
  }, [storedWorldNames, checkAllWorldStatuses]);

  // Auto-parse manifest whenever inputs change
  useEffect(() => {
    if (!manifestJson) return;

    try {
      const parsed = JSON.parse(manifestJson);

      let manifest = parsed;
      if (parsed.configuration?.setup?.manifest) {
        manifest = parsed.configuration.setup.manifest;
      } else if (parsed.manifest) {
        manifest = parsed.manifest;
      }

      if (!manifest.world || !manifest.contracts || !manifest.models || !manifest.events) {
        setParsedManifest(null);
        setGeneratedCalldata([]);
        return;
      }

      setParsedManifest(manifest);
      const calldata = generateFactoryCalldata(manifest, version, namespace, maxActions, defaultNamespaceWriterAll);
      setGeneratedCalldata(calldata);
    } catch {
      setParsedManifest(null);
      setGeneratedCalldata([]);
    }
  }, [manifestJson, version, namespace, maxActions, defaultNamespaceWriterAll]);

  // Generate new world name
  const handleGenerateWorldName = () => {
    const newWorldName = generateWorldName();
    setWorldName(newWorldName);
    setCurrentWorldName(newWorldName);
  };

  const applySeriesMetadataUpdate = (worldName: string, metadata: WorldSeriesMetadata | null) => {
    setWorldSeriesMetadata((prev) => {
      const next = { ...prev };
      if (metadata && (metadata.seriesName || metadata.seriesGameNumber)) {
        next[worldName] = metadata;
      } else {
        delete next[worldName];
      }
      return next;
    });
    updateWorldSeriesMetadata(worldName, metadata);
  };

  const resolveSeriesGameNumber = (name: string, gameNumber: string) => {
    const trimmedGameNumber = gameNumber.trim();
    if (trimmedGameNumber) return trimmedGameNumber;
    const matched = ownedSeries.find((series) => series.name === name);
    if (!matched) return gameNumber;
    const nextNumber = matched.lastGameNumber !== null ? matched.lastGameNumber + BigInt(1) : BigInt(1);
    return nextNumber.toString();
  };

  const buildSeriesCalldata = (name: string, gameNumber: string) => {
    const trimmedName = name.trim();
    const trimmedGameNumber = gameNumber.trim();
    const seriesNameFelt = trimmedName ? shortString.encodeShortString(trimmedName) : "0x0";
    const parsedSeriesGameNumber = trimmedGameNumber ? BigInt(trimmedGameNumber.replace(/[^\d]/g, "")) : BigInt(0);
    return {
      trimmedName,
      trimmedGameNumber,
      seriesNameFelt,
      seriesGameNumber: parsedSeriesGameNumber.toString(),
    };
  };

  const handleSeriesSuggestion = (series: FactorySeries) => {
    setSeriesName(series.name);
    const nextNumber = series.lastGameNumber !== null ? series.lastGameNumber + BigInt(1) : BigInt(1);
    setSeriesGameNumber(nextNumber.toString());
  };

  const handleCreateSeries = async () => {
    if (!account || !factoryAddress || !seriesConfigName.trim()) return;
    setSeriesConfigTx({ status: "running" });

    try {
      const seriesNameFelt = shortString.encodeShortString(seriesConfigName.trim());
      const result = await account.execute({
        contractAddress: factoryAddress,
        entrypoint: "set_series_config",
        calldata: [seriesNameFelt],
      });

      setSeriesConfigTx({ status: "success", hash: result.transaction_hash });
      await account.waitForTransaction(result.transaction_hash);
      await refetchSeries();
    } catch (err: any) {
      setSeriesConfigTx({ status: "error", error: err.message });
    }
  };

  // Add current world name to queue
  const handleAddToQueue = () => {
    if (!worldName) return;

    // Check if already in list
    const existing = getStoredWorldNames();
    const isExisting = existing.includes(worldName);

    // Add to localStorage
    if (!isExisting) {
      saveWorldNameToStorage(worldName);
      setStoredWorldNames(getStoredWorldNames());
    }

    const resolvedSeriesName = seriesName.trim();
    const resolvedSeriesGameNumber = resolvedSeriesName
      ? resolveSeriesGameNumber(resolvedSeriesName, seriesGameNumber.trim())
      : seriesGameNumber.trim();
    const metadata =
      resolvedSeriesName || resolvedSeriesGameNumber
        ? {
            seriesName: resolvedSeriesName || undefined,
            seriesGameNumber: resolvedSeriesGameNumber || undefined,
          }
        : null;
    applySeriesMetadataUpdate(worldName, metadata);

    // Generate new world name for next queue item
    if (!isExisting) {
      const newWorldName = generateWorldName();
      setWorldName(newWorldName);
      setCurrentWorldName(newWorldName);
    }
  };

  // Remove world name from queue
  const handleRemoveFromQueue = (worldName: string) => {
    try {
      const existing = getStoredWorldNames();
      const updated = existing.filter((name) => name !== worldName);
      persistStoredWorldNames(updated);
      setStoredWorldNames(updated);
      // Clear current world name if it matches the removed one
      if (getCurrentWorldName() === worldName) {
        setCurrentWorldName("");
      }
      applySeriesMetadataUpdate(worldName, null);
    } catch (err) {
      console.error("Failed to remove world name:", err);
    }
  };

  // Handle reload - clear all loading states and refresh data
  const handleReload = async () => {
    // Clear all transaction states
    setTx({ status: "idle" });
    setWorldConfigTx({});
    setVerifyingDeployment({});
    setCreatingIndexer({});

    // Refresh world statuses
    await checkAllWorldStatuses();
  };

  // Handle create indexer
  const handleCreateIndexer = async (worldName: string) => {
    // Check if on cooldown
    if (isWorldOnCooldown(worldName)) {
      return;
    }

    setIndexerActionErrors((prev) => ({ ...prev, [worldName]: "" }));
    setCreatingIndexer((prev) => ({ ...prev, [worldName]: true }));

    // Get torii config for current chain
    // Build torii config for current chain
    const envName = currentChain;

    // Get deployed world address from factory (required for indexer creation)
    const deployedWorldAddress = await getWorldDeployedAddressLocal(worldName);
    if (!deployedWorldAddress) {
      console.warn("World not deployed or address not found in factory indexer; cannot create indexer.");
      setCreatingIndexer((prev) => ({ ...prev, [worldName]: false }));
      setIndexerActionErrors((prev) => ({
        ...prev,
        [worldName]: "World is not deployed yet. Deploy first.",
      }));
      return;
    }

    try {
      // Immediately set cooldown so UI shows small wait timer right away
      setIndexerCooldown(worldName);

      let resolved = false;

      await createIndexerService({
        env: envName,
        rpc_url: getRpcUrlForChain(currentChain),
        torii_namespaces: DEFAULT_NAMESPACE,
        torii_prefix: worldName,
        torii_world_address: deployedWorldAddress,
        external_contracts: [],
      });

      // Poll for indexer status while waiting (every 10 seconds)
      const pollInterval = setInterval(async () => {
        const exists = await checkIndexerExists(worldName);
        if (exists) {
          resolved = true;
          setWorldIndexerStatus((prev) => ({ ...prev, [worldName]: true }));
          setIndexerActionErrors((prev) => ({ ...prev, [worldName]: "" }));
          setCreatingIndexer((prev) => ({ ...prev, [worldName]: false }));
          clearInterval(pollInterval);
        }
      }, 10000); // Check every 10 seconds

      // Stop polling after 6 minutes (safety limit)
      setTimeout(() => {
        clearInterval(pollInterval);
        if (!resolved) {
          setCreatingIndexer((prev) => ({ ...prev, [worldName]: false }));
          setIndexerActionErrors((prev) => ({
            ...prev,
            [worldName]: "Indexer creation is still pending. Wait a bit and try refresh.",
          }));
        }
      }, 360000); // 6 minutes
    } catch (error: any) {
      console.error("Error creating indexer:", error);
      setCreatingIndexer((prev) => ({ ...prev, [worldName]: false }));
      setIndexerActionErrors((prev) => ({
        ...prev,
        [worldName]: error?.message ?? "Failed to create indexer.",
      }));
    }
  };

  // Execute set_config only
  const handleSetConfig = async () => {
    if (!account || !parsedManifest || !factoryAddress || !worldName) return;

    setTx({ status: "running" });

    try {
      const result = await account.execute({
        contractAddress: factoryAddress,
        entrypoint: "set_factory_config",
        calldata: generatedCalldata,
      });

      setTx({ status: "success", hash: result.transaction_hash });
      await account.waitForTransaction(result.transaction_hash);

      // Mark world as configured after successful transaction
      markWorldAsConfigured(worldName);
    } catch (err: any) {
      setTx({ status: "error", error: err.message });
    }
  };

  const handleStopAutoDeploy = (name: string) => {
    autoDeployCancelRef.current[name] = true;
    setAutoDeployState((prev) => {
      const entry = prev[name];
      if (!entry) return prev;
      return { ...prev, [name]: { ...entry, status: "stopping" } };
    });
  };

  const handleQueueDeploy = async (name: string) => {
    if (!account || !factoryAddress || !name) return;

    const totalRepeats = Math.max(1, factoryDeployRepeats);
    autoDeployCancelRef.current[name] = false;
    setAutoDeployState((prev) => ({
      ...prev,
      [name]: { current: 0, total: totalRepeats, status: "running" },
    }));

    try {
      const worldNameFelt = shortString.encodeShortString(name);
      const metadata = worldSeriesMetadata[name];
      const series = buildSeriesCalldata(metadata?.seriesName ?? "", metadata?.seriesGameNumber ?? "");
      let deployedAddress: string | null = null;

      for (let i = 0; i < totalRepeats; i++) {
        if (autoDeployCancelRef.current[name]) break;

        setAutoDeployState((prev) => {
          const entry = prev[name];
          if (!entry) return prev;
          return { ...prev, [name]: { ...entry, current: i + 1 } };
        });

        setTx({ status: "running" });
        const result = await account.execute({
          contractAddress: factoryAddress,
          entrypoint: "create_game",
          calldata: [worldNameFelt, version, series.seriesNameFelt, series.seriesGameNumber],
        });
        setTx({ status: "success", hash: result.transaction_hash });

        const waitResult = (await Promise.race([
          account
            .waitForTransaction(result.transaction_hash)
            .then(() => ({ status: "confirmed" as const }))
            .catch((error) => ({ status: "error" as const, error })),
          new Promise((resolve) => setTimeout(() => resolve({ status: "timeout" as const }), 2000)),
        ])) as any;

        if (waitResult.status === "error") {
          throw waitResult.error;
        }

        deployedAddress = await getWorldDeployedAddressLocal(name);
        if (deployedAddress) {
          setWorldDeployedStatus((prev) => ({ ...prev, [name]: true }));
          cacheDeployedAddress(name, deployedAddress);
          break;
        }
      }

      const shouldVerify = !autoDeployCancelRef.current[name] && !deployedAddress;
      if (shouldVerify) {
        setVerifyingDeployment((prev) => ({ ...prev, [name]: true }));

        let addr: string | null = null;
        let attempts = 0;
        const maxAttempts = 10;
        const delayMs = 2000;

        while (attempts < maxAttempts && !addr) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          addr = await getWorldDeployedAddressLocal(name);
          attempts++;
        }

        const isDeployed = !!addr;
        setWorldDeployedStatus((prev) => ({ ...prev, [name]: isDeployed }));
        if (addr) cacheDeployedAddress(name, addr);

        setVerifyingDeployment((prev) => ({ ...prev, [name]: false }));
      }
    } catch (err: any) {
      setTx({ status: "error", error: err.message });
      setVerifyingDeployment((prev) => ({ ...prev, [name]: false }));
    } finally {
      setAutoDeployState((prev) => {
        if (!prev[name]) return prev;
        const next = { ...prev };
        delete next[name];
        return next;
      });
      autoDeployCancelRef.current[name] = false;
    }
  };

  const getTxStatusIcon = () => {
    switch (tx.status) {
      case "running":
        return <Loader2 className="w-4 h-4 animate-spin" />;
      case "success":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "error":
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div
      className={
        embedded
          ? "w-full overflow-x-hidden"
          : "fixed inset-0 w-full h-full overflow-y-auto overflow-x-hidden bg-gradient-to-br from-black via-brown/80 to-black"
      }
    >
      <div className={embedded ? "w-full" : "max-w-6xl mx-auto px-8 py-16"}>
        {!embedded && <AdminHeader network={currentChain} onBack={() => navigate("/")} onReload={handleReload} />}

        {/* Unified Configuration and Deployment */}
        {parsedManifest && (
          <div className="mb-12">
            <div className="relative overflow-hidden p-10 panel-wood rounded-3xl shadow-xl shadow-gold/10 border border-gold/20">
              <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-gold/15 to-transparent rounded-full blur-3xl" />
              <div className="relative space-y-8">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <h3 className="text-2xl font-bold text-gold">Ready to Deploy</h3>
                      <div className="flex items-center gap-2 px-3 py-1 bg-emerald-100 rounded-full">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                          Validated
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm text-gold/70">
                      <span className="font-medium">{parsedManifest.contracts.length} Contracts</span>
                      <span className="font-medium">{parsedManifest.models.length} Models</span>
                      <span className="font-medium">{parsedManifest.events.length} Events</span>
                    </div>
                  </div>
                </div>

                {/* Connection Status */}
                <div className="flex items-center justify-between p-6 bg-black/40 rounded-2xl border border-gold/20">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-gold/60 uppercase tracking-wider">Connected Wallet</span>
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${account?.address ? "bg-emerald-500" : "bg-gold/20"}`} />
                      {account?.address ? (
                        <span className="text-sm font-mono text-gold">
                          {`${account.address.slice(0, 6)}...${account.address.slice(-4)}`}
                        </span>
                      ) : (
                        <Controller className="h-8 px-3 min-w-0" />
                      )}
                    </div>
                  </div>
                  <div className="px-4 py-2 bg-black/40 rounded-xl border border-gold/20">
                    <span className="text-xs font-bold text-gold/70 uppercase tracking-wide">
                      Network: {currentChain}
                    </span>
                  </div>
                </div>

                {/* Deploy Section - Always Visible */}
                <div className="space-y-6 p-6 bg-gradient-to-br from-black/40 to-black/20 rounded-2xl border-2 border-gold/20 shadow-sm">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gold/90 uppercase tracking-wide">Game Name</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={worldName}
                          onChange={(e) => {
                            const newName = e.target.value;
                            setWorldName(newName);
                            setCurrentWorldName(newName);
                          }}
                          placeholder="ccf-fire-gate-42"
                          className="flex-1 px-4 py-3 bg-black/40 border-2 border-gold/20 hover:border-gold/40 focus:border-gold/60 rounded-xl text-gold placeholder-gold/40 font-mono focus:outline-none transition-all"
                        />
                        <button
                          onClick={handleGenerateWorldName}
                          className="p-3 bg-gold/15 hover:bg-gold/25 rounded-xl transition-colors group"
                          title="Generate new game name"
                        >
                          <RefreshCw className="w-5 h-5 text-gold/90 group-hover:rotate-180 transition-transform duration-500" />
                        </button>
                        <button
                          onClick={handleAddToQueue}
                          disabled={!worldName}
                          className="button-gold px-4 py-3 bg-gold/20 hover:bg-gold/30 disabled:bg-gold/20 disabled:cursor-not-allowed text-gold text-sm font-semibold rounded-xl transition-colors"
                        >
                          Add
                        </button>
                      </div>
                      <p className="text-xs text-gold/60">
                        Generate a game name and add it to the queue to deploy now or later
                      </p>
                    </div>

                    {/* Series selection */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-bold text-gold/90 uppercase tracking-wide">
                          Series (optional)
                        </label>
                        {(seriesLoading || seriesFetching) && account && (
                          <div className="flex items-center gap-2 text-xs text-gold/60">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Fetching your series
                          </div>
                        )}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input
                          type="text"
                          value={seriesName}
                          onChange={(e) => setSeriesName(e.target.value)}
                          placeholder="ccf-series-wars"
                          className="w-full px-4 py-3 bg-black/40 border-2 border-gold/20 hover:border-gold/40 focus:border-gold/60 rounded-xl text-gold placeholder-gold/40 font-sans focus:outline-none transition-all"
                        />
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={seriesGameNumber}
                          onChange={(e) => setSeriesGameNumber(e.target.value.replace(/[^\d]/g, ""))}
                          placeholder="Game #"
                          className="w-full px-4 py-3 bg-black/40 border-2 border-gold/20 hover:border-gold/40 focus:border-gold/60 rounded-xl text-gold placeholder-gold/40 font-sans focus:outline-none transition-all"
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gold/60">
                        <span className="font-medium text-gold/90">Series status:</span>
                        <span className="text-gold/60">
                          {seriesName ? `${seriesName} #${seriesGameNumber || "0"}` : "Not configured"}
                        </span>
                      </div>
                      {seriesError && (
                        <p className="text-[11px] text-red-600">
                          Unable to load your series ({seriesError.message || "unknown error"})
                        </p>
                      )}
                      {account ? (
                        <div className="space-y-1">
                          {ownedSeries.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {ownedSeries.map((series) => (
                                <button
                                  key={series.paddedName}
                                  type="button"
                                  onClick={() => handleSeriesSuggestion(series)}
                                  className="flex flex-col items-start gap-0.5 px-3 py-2 bg-black/40 border border-gold/20 rounded-2xl text-left text-[11px] text-gold/70 hover:border-gold/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold/60"
                                >
                                  <span className="font-semibold text-gold">{series.name}</span>
                                  <span className="text-[10px] text-gold/60">
                                    Last game #{series.lastGameNumber?.toString() ?? "n/a"}
                                  </span>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-gold/60">No series found for this wallet.</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-[11px] text-gold/60">
                          Connect your wallet to list the series you control.
                        </p>
                      )}
                    </div>

                    {/* Create Series */}
                    <div className="space-y-2 rounded-2xl border border-gold/20 bg-black/40 p-4">
                      <label className="text-xs font-bold text-gold/70 uppercase tracking-wide">Create Series</label>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <input
                          type="text"
                          value={seriesConfigName}
                          onChange={(e) => setSeriesConfigName(e.target.value)}
                          placeholder="ccf-series-wars"
                          className="flex-1 px-4 py-2.5 bg-black/40 border-2 border-gold/20 hover:border-gold/40 focus:border-gold/60 rounded-xl text-gold placeholder-gold/40 font-sans focus:outline-none transition-all"
                        />
                        <button
                          onClick={handleCreateSeries}
                          disabled={
                            !account ||
                            !factoryAddress ||
                            !seriesConfigName.trim() ||
                            seriesConfigTx.status === "running"
                          }
                          className="button-gold px-4 py-2.5 bg-gold/20 hover:bg-gold/30 disabled:bg-gold/20 disabled:cursor-not-allowed text-gold text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                          {seriesConfigTx.status === "running" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          Create Series
                        </button>
                      </div>
                      {seriesConfigTx.status === "success" && seriesConfigTx.hash && (
                        <div className="flex items-center gap-2 text-[11px] text-emerald-700">
                          <CheckCircle2 className="w-3 h-3" />
                          Created
                          <a
                            href={getExplorerTxUrl(currentChain as any, seriesConfigTx.hash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gold/90 hover:text-gold underline"
                          >
                            View Tx
                          </a>
                        </div>
                      )}
                      {seriesConfigTx.status === "error" && seriesConfigTx.error && (
                        <p className="text-[11px] text-red-600">{seriesConfigTx.error}</p>
                      )}
                    </div>

                    {/* Game Queue */}
                    {storedWorldNames.length > 0 && (
                      <div className="space-y-2">
                        <button
                          onClick={() => setShowStoredNames(!showStoredNames)}
                          className="flex items-center gap-2 text-sm font-semibold text-gold/90 hover:text-gold transition-colors"
                        >
                          {showStoredNames ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          Game List ({storedWorldNames.length})
                        </button>
                        {showStoredNames && (
                          <div className="pl-4 space-y-3">
                            {[...storedWorldNames].reverse().map((name) => {
                              const metadata = worldSeriesMetadata[name];
                              const metadataParts: string[] = [];
                              if (metadata?.seriesName) metadataParts.push(metadata.seriesName);
                              if (metadata?.seriesGameNumber) metadataParts.push(`#${metadata.seriesGameNumber}`);

                              return (
                                <div key={name} className="space-y-2">
                                  <div className="flex items-center gap-2 px-3 py-2 bg-black/40 rounded-lg border border-gold/20 hover:border-gold/40 transition-colors">
                                    <span className="flex-1 text-xs font-mono text-gold/90">{name}</span>

                                    {/* Copy Button */}
                                    <button
                                      onClick={async () => {
                                        try {
                                          await navigator.clipboard.writeText(name);
                                        } catch (err) {
                                          console.error("Failed to copy world name", err);
                                        }
                                      }}
                                      className="p-1 text-gold/40 hover:text-gold/90 hover:bg-black/40 rounded transition-colors"
                                      title="Copy world name"
                                      aria-label="Copy world name"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                    </button>

                                    {/* Remove Button */}
                                    <button
                                      onClick={() => handleRemoveFromQueue(name)}
                                      className="p-1 text-gold/40 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                      title="Remove from queue"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>

                                    {/* Divider */}
                                    <div className="h-4 w-px bg-gold/20" />

                                    {/* Verifying Deployment Status */}
                                    {verifyingDeployment[name] && (
                                      <span className="flex items-center gap-1.5 px-2 py-1 bg-black/40 text-gold/80 text-xs font-semibold rounded border border-gold/20">
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        Verifying...
                                      </span>
                                    )}

                                    {autoDeployState[name] && !verifyingDeployment[name] && (
                                      <span className="flex items-center gap-1.5 px-2 py-1 bg-black/40 text-gold/80 text-xs font-semibold rounded border border-gold/20">
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        {autoDeployState[name].status === "stopping" ? "Stopping" : "Deploying"}{" "}
                                        {autoDeployState[name].current}/{autoDeployState[name].total}
                                      </span>
                                    )}

                                    {/* Deployment Status Badge - Only show if deployed and not verifying */}
                                    {worldDeployedStatus[name] && !verifyingDeployment[name] && (
                                      <span className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded border border-emerald-200">
                                        <CheckCircle2 className="w-3 h-3" />
                                        Deployed
                                      </span>
                                    )}

                                    {/* Deploy Button - Only show if not deployed and not verifying */}
                                    {!worldDeployedStatus[name] &&
                                      !verifyingDeployment[name] &&
                                      !autoDeployState[name] && (
                                        <button
                                          onClick={() => handleQueueDeploy(name)}
                                          disabled={!account || !factoryAddress || tx.status === "running"}
                                          className="button-gold px-3 py-1 bg-gold/20 hover:bg-gold/30 disabled:bg-gold/20 disabled:cursor-not-allowed text-gold text-xs font-semibold rounded-md transition-colors flex items-center gap-1"
                                        >
                                          {tx.status === "running" && getTxStatusIcon()}
                                          {factoryDeployRepeats > 1 ? `Deploy x${factoryDeployRepeats}` : "Deploy"}
                                        </button>
                                      )}

                                    {!worldDeployedStatus[name] &&
                                      autoDeployState[name] &&
                                      !verifyingDeployment[name] && (
                                        <button
                                          onClick={() => handleStopAutoDeploy(name)}
                                          disabled={autoDeployState[name].status === "stopping"}
                                          className="px-3 py-1 bg-red-50 hover:bg-red-100 disabled:bg-gold/10 disabled:text-gold/40 text-red-700 text-xs font-semibold rounded-md border border-red-200 hover:border-red-300 transition-colors"
                                        >
                                          {autoDeployState[name].status === "stopping" ? "Stopping..." : "Stop"}
                                        </button>
                                      )}

                                    {/* Step 2: Configure - available before deploy to stage overrides */}
                                    {!isWorldConfigured(name) && (
                                      <button
                                        onClick={() => setWorldConfigOpen((prev) => ({ ...prev, [name]: !prev[name] }))}
                                        className="px-3 py-1 bg-black/40 hover:bg-gold/10 text-gold/90 text-xs font-semibold rounded-md border border-gold/20 hover:border-gold/20 transition-colors"
                                      >
                                        {worldConfigOpen[name]
                                          ? "Hide Config"
                                          : worldDeployedStatus[name]
                                            ? "Configure"
                                            : "Configure (Draft)"}
                                      </button>
                                    )}

                                    {/* Step 3: Indexer - Only available once deployed */}
                                    {worldDeployedStatus[name] && (
                                      <>
                                        {/* Indexer status/actions */}
                                        {worldIndexerStatus[name] ? (
                                          <a
                                            href={`${CARTRIDGE_API_BASE}/x/${name}/torii`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-md border border-emerald-200 hover:border-emerald-300 transition-colors"
                                          >
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                            Indexer On
                                          </a>
                                        ) : creatingIndexer[name] ? (
                                          <span className="flex items-center gap-1.5 px-3 py-1 bg-black/40 text-gold/80 text-xs font-semibold rounded-md border border-gold/20 cursor-wait">
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            Creating Indexer...
                                          </span>
                                        ) : isWorldOnCooldown(name) ? (
                                          <span className="flex items-center gap-1.5 px-3 py-1 bg-gold/10 text-gold/60 text-xs font-semibold rounded-md border border-gold/20 cursor-not-allowed">
                                            Wait {Math.floor(getRemainingCooldown(name) / 60)}m{" "}
                                            {getRemainingCooldown(name) % 60}s
                                          </span>
                                        ) : (
                                          <button
                                            onClick={() => handleCreateIndexer(name)}
                                            className="px-3 py-1 bg-black/40 hover:bg-gold/15 text-gold/80 text-xs font-semibold rounded-md border border-gold/20 hover:border-gold/40 transition-colors"
                                          >
                                            Create Indexer
                                          </button>
                                        )}
                                      </>
                                    )}
                                  </div>
                                  {metadataParts.length > 0 && (
                                    <p className="text-[11px] text-gold/60">Series: {metadataParts.join(" ")}</p>
                                  )}
                                  {indexerActionErrors[name] && !worldIndexerStatus[name] && (
                                    <p className="text-[11px] text-red-600">{indexerActionErrors[name]}</p>
                                  )}

                                  {/* No extra status panel; only small wait timer above */}

                                  {/* Per-world Config Panel */}
                                  {worldConfigOpen[name] && (
                                    <div className="ml-3 pl-3 py-4 border-l-2 border-gold/20">
                                      <div className="p-4 bg-black/40 border border-gold/20 rounded-xl shadow-sm space-y-3">
                                        <div className="flex items-center justify-between">
                                          <div>
                                            <p className="text-sm font-semibold text-gold">Configure Game</p>
                                            <p className="text-xs text-gold/60">
                                              Edit overrides any time. Set runs a live deployment check.
                                            </p>
                                          </div>
                                          {worldConfigTx[name]?.status === "running" && (
                                            <span className="inline-flex items-center gap-2 text-xs text-gold/80 bg-black/40 border border-gold/20 px-2 py-1 rounded">
                                              <Loader2 className="w-3 h-3 animate-spin" /> Running
                                            </span>
                                          )}
                                          {worldConfigTx[name]?.status === "success" && worldConfigTx[name]?.hash && (
                                            <div className="inline-flex items-center gap-2">
                                              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded">
                                                <CheckCircle2 className="w-3 h-3" /> Success
                                              </span>
                                              <a
                                                href={getExplorerTxUrl(currentChain as any, worldConfigTx[name].hash)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-gold/90 hover:text-gold underline"
                                              >
                                                View Tx
                                              </a>
                                            </div>
                                          )}
                                          {worldConfigTx[name]?.status === "error" && (
                                            <div className="flex flex-col items-end gap-1">
                                              <span className="inline-flex items-center gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 px-2 py-1 rounded">
                                                <XCircle className="w-3 h-3" /> Error
                                              </span>
                                              {worldConfigTx[name]?.error && (
                                                <p className="text-[10px] text-red-600 max-w-xs text-right">
                                                  {worldConfigTx[name].error}
                                                </p>
                                              )}
                                            </div>
                                          )}
                                        </div>

                                        {/* startMainAt override */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                          <div className="space-y-1">
                                            <label className="text-xs font-semibold text-gold/70">
                                              Game Start Time
                                            </label>
                                            <input
                                              type="datetime-local"
                                              min={(() => {
                                                const d = new Date();
                                                const pad = (n: number) => n.toString().padStart(2, "0");
                                                const yyyy = d.getFullYear();
                                                const mm = pad(d.getMonth() + 1);
                                                const dd = pad(d.getDate());
                                                const hh = pad(d.getHours());
                                                const mi = pad(d.getMinutes());
                                                return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
                                              })()}
                                              max={(() => {
                                                const d = new Date(Date.now() + MAX_START_TIME_HOURS * 3600 * 1000);
                                                const pad = (n: number) => n.toString().padStart(2, "0");
                                                const yyyy = d.getFullYear();
                                                const mm = pad(d.getMonth() + 1);
                                                const dd = pad(d.getDate());
                                                const hh = pad(d.getHours());
                                                const mi = pad(d.getMinutes());
                                                return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
                                              })()}
                                              value={(() => {
                                                const pad = (n: number) => n.toString().padStart(2, "0");
                                                const toLocalInput = (date: Date) => {
                                                  const yyyy = date.getFullYear();
                                                  const mm = pad(date.getMonth() + 1);
                                                  const dd = pad(date.getDate());
                                                  const hh = pad(date.getHours());
                                                  const mi = pad(date.getMinutes());
                                                  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
                                                };

                                                const ts = startMainAtOverrides[name];
                                                if (ts && ts > 0) {
                                                  return toLocalInput(new Date(ts * 1000));
                                                }
                                                // Default: start of next hour
                                                const now = new Date();
                                                const nextHour = new Date(now.getTime());
                                                nextHour.setMinutes(0, 0, 0);
                                                nextHour.setHours(nextHour.getHours() + 1);
                                                return toLocalInput(nextHour);
                                              })()}
                                              onChange={(e) => {
                                                const val = e.target.value;
                                                if (!val) {
                                                  setStartMainAtOverrides((p) => ({ ...p, [name]: 0 }));
                                                  setStartMainAtErrors((p) => ({ ...p, [name]: "" }));
                                                  return;
                                                }
                                                const selected = Math.floor(new Date(val).getTime() / 1000);
                                                const now = Math.floor(Date.now() / 1000);
                                                const maxAllowed = now + MAX_START_TIME_HOURS * 3600;
                                                if (selected < now) {
                                                  setStartMainAtErrors((p) => ({
                                                    ...p,
                                                    [name]: "Start time cannot be in the past",
                                                  }));
                                                } else if (selected > maxAllowed) {
                                                  setStartMainAtErrors((p) => ({
                                                    ...p,
                                                    [name]: `Start time cannot be more than ${MAX_START_TIME_HOURS.toLocaleString()} hours ahead`,
                                                  }));
                                                } else {
                                                  setStartMainAtErrors((p) => ({ ...p, [name]: "" }));
                                                }
                                                setStartMainAtOverrides((p) => ({ ...p, [name]: selected }));
                                              }}
                                              className="w-full px-3 py-2 text-sm bg-black/40 border border-gold/20 rounded-md"
                                            />
                                            <p className="text-[10px] text-gold/60">
                                              Optional. Max +{MAX_START_TIME_HOURS.toLocaleString()}h from now.
                                            </p>
                                            {startMainAtErrors[name] && (
                                              <p className="text-[11px] text-red-600">{startMainAtErrors[name]}</p>
                                            )}
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-xs font-semibold text-gold/70">
                                              Settling Start Time
                                            </label>
                                            <input
                                              type="datetime-local"
                                              min={(() => {
                                                const d = new Date();
                                                const pad = (n: number) => n.toString().padStart(2, "0");
                                                const yyyy = d.getFullYear();
                                                const mm = pad(d.getMonth() + 1);
                                                const dd = pad(d.getDate());
                                                const hh = pad(d.getHours());
                                                const mi = pad(d.getMinutes());
                                                return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
                                              })()}
                                              max={(() => {
                                                const d = new Date(Date.now() + MAX_START_TIME_HOURS * 3600 * 1000);
                                                const pad = (n: number) => n.toString().padStart(2, "0");
                                                const yyyy = d.getFullYear();
                                                const mm = pad(d.getMonth() + 1);
                                                const dd = pad(d.getDate());
                                                const hh = pad(d.getHours());
                                                const mi = pad(d.getMinutes());
                                                return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
                                              })()}
                                              value={(() => {
                                                const pad = (n: number) => n.toString().padStart(2, "0");
                                                const toLocalInput = (date: Date) => {
                                                  const yyyy = date.getFullYear();
                                                  const mm = pad(date.getMonth() + 1);
                                                  const dd = pad(date.getDate());
                                                  const hh = pad(date.getHours());
                                                  const mi = pad(date.getMinutes());
                                                  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
                                                };
                                                const ts = startSettlingAtOverrides[name];
                                                if (ts && ts > 0) {
                                                  return toLocalInput(new Date(ts * 1000));
                                                }
                                                const now = new Date();
                                                const nextHalfHour = new Date(now.getTime());
                                                nextHalfHour.setSeconds(0, 0);
                                                const addMinutes = 30 - (nextHalfHour.getMinutes() % 30 || 30);
                                                nextHalfHour.setMinutes(nextHalfHour.getMinutes() + addMinutes);
                                                return toLocalInput(nextHalfHour);
                                              })()}
                                              onChange={(e) => {
                                                const val = e.target.value;
                                                if (!val) {
                                                  setStartSettlingAtOverrides((p) => ({ ...p, [name]: 0 }));
                                                  setStartSettlingAtErrors((p) => ({ ...p, [name]: "" }));
                                                  return;
                                                }
                                                const selected = Math.floor(new Date(val).getTime() / 1000);
                                                const now = Math.floor(Date.now() / 1000);
                                                const maxAllowed = now + MAX_START_TIME_HOURS * 3600;
                                                if (selected < now) {
                                                  setStartSettlingAtErrors((p) => ({
                                                    ...p,
                                                    [name]: "Settling start cannot be in the past",
                                                  }));
                                                } else if (selected > maxAllowed) {
                                                  setStartSettlingAtErrors((p) => ({
                                                    ...p,
                                                    [name]: `Settling start cannot be more than ${MAX_START_TIME_HOURS.toLocaleString()} hours ahead`,
                                                  }));
                                                } else {
                                                  setStartSettlingAtErrors((p) => ({ ...p, [name]: "" }));
                                                }
                                                setStartSettlingAtOverrides((p) => ({ ...p, [name]: selected }));
                                              }}
                                              className="w-full px-3 py-2 text-sm bg-black/40 border border-gold/20 rounded-md"
                                            />
                                            <p className="text-[10px] text-gold/60">
                                              Optional. Max +{MAX_START_TIME_HOURS.toLocaleString()}h from now.
                                            </p>
                                            {startSettlingAtErrors[name] && (
                                              <p className="text-[11px] text-red-600">{startSettlingAtErrors[name]}</p>
                                            )}
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-xs font-semibold text-gold/70">Dev Mode</label>
                                            <div className="flex items-center gap-2">
                                              <input
                                                id={`dev-mode-${name}`}
                                                type="checkbox"
                                                checked={
                                                  Object.prototype.hasOwnProperty.call(devModeOverrides, name)
                                                    ? !!devModeOverrides[name]
                                                    : devModeOn
                                                }
                                                onChange={(e) =>
                                                  setDevModeOverrides((p) => ({ ...p, [name]: e.target.checked }))
                                                }
                                                className="h-4 w-4 accent-blue-600"
                                              />
                                              <label htmlFor={`dev-mode-${name}`} className="text-xs text-gold/90">
                                                Enable developer mode for this world
                                              </label>
                                            </div>
                                            <p className="text-[10px] text-gold/60">Controls in-game dev features.</p>
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-xs font-semibold text-gold/70">MMR System</label>
                                            <div className="flex items-center gap-2">
                                              <input
                                                id={`mmr-enabled-${name}`}
                                                type="checkbox"
                                                checked={
                                                  Object.prototype.hasOwnProperty.call(mmrEnabledOverrides, name)
                                                    ? !!mmrEnabledOverrides[name]
                                                    : mmrEnabledOn
                                                }
                                                onChange={(e) =>
                                                  setMmrEnabledOverrides((p) => ({ ...p, [name]: e.target.checked }))
                                                }
                                                className="h-4 w-4 accent-blue-600"
                                              />
                                              <label htmlFor={`mmr-enabled-${name}`} className="text-xs text-gold/90">
                                                Enable MMR tracking for this world
                                              </label>
                                            </div>
                                            <p className="text-[10px] text-gold/60">
                                              Tracks player skill ratings across Blitz games.
                                            </p>
                                          </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                          <div className="space-y-1">
                                            <label className="text-xs font-semibold text-gold/70">
                                              Game Duration (hours)
                                            </label>
                                            <input
                                              type="number"
                                              min={0}
                                              value={
                                                Object.prototype.hasOwnProperty.call(durationHoursOverrides, name)
                                                  ? Number(durationHoursOverrides[name] || 0)
                                                  : Number(durationHours || 0)
                                              }
                                              onChange={(e) =>
                                                setDurationHoursOverrides((p) => ({
                                                  ...p,
                                                  [name]: Number(e.target.value || 0),
                                                }))
                                              }
                                              className="w-full px-3 py-2 text-sm bg-black/40 border border-gold/20 rounded-md"
                                            />
                                            <p className="text-[10px] text-gold/60">
                                              Applies to season.durationSeconds.
                                            </p>
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-xs font-semibold text-gold/70">
                                              Game Duration (minutes)
                                            </label>
                                            <input
                                              type="number"
                                              min={0}
                                              max={59}
                                              value={
                                                Object.prototype.hasOwnProperty.call(durationMinutesOverrides, name)
                                                  ? Number(durationMinutesOverrides[name] || 0)
                                                  : baseDurationMinutes
                                              }
                                              onChange={(e) =>
                                                setDurationMinutesOverrides((p) => ({
                                                  ...p,
                                                  [name]: Math.min(59, Math.max(0, Number(e.target.value || 0))),
                                                }))
                                              }
                                              className="w-full px-3 py-2 text-sm bg-black/40 border border-gold/20 rounded-md"
                                            />
                                            <p className="text-[10px] text-gold/60">0–59 minutes (added to hours).</p>
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-xs font-semibold text-gold/70">
                                              Factory Address Override
                                            </label>
                                            <input
                                              type="text"
                                              placeholder={
                                                factoryAddress || (eternumConfig as any)?.factory_address || "0x..."
                                              }
                                              value={
                                                factoryAddressOverrides[name] ??
                                                (factoryAddress || (eternumConfig as any)?.factory_address || "")
                                              }
                                              onChange={(e) =>
                                                setFactoryAddressOverrides((p) => ({ ...p, [name]: e.target.value }))
                                              }
                                              className="w-full px-3 py-2 text-sm bg-black/40 border border-gold/20 rounded-md font-mono"
                                            />
                                            <p className="text-[10px] text-gold/60">
                                              Used by set_factory_address when configuring this world.
                                            </p>
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-xs font-semibold text-gold/70">
                                              Single Realm Mode
                                            </label>
                                            <div className="flex items-center gap-2">
                                              <input
                                                id={`single-realm-mode-${name}`}
                                                type="checkbox"
                                                checked={
                                                  Object.prototype.hasOwnProperty.call(singleRealmModeOverrides, name)
                                                    ? !!singleRealmModeOverrides[name]
                                                    : !!eternumConfig.settlement?.single_realm_mode
                                                }
                                                onChange={(e) =>
                                                  setSingleRealmModeOverrides((p) => ({
                                                    ...p,
                                                    [name]: e.target.checked,
                                                  }))
                                                }
                                                className="h-4 w-4 accent-blue-600"
                                              />
                                              <label
                                                htmlFor={`single-realm-mode-${name}`}
                                                className="text-xs text-gold/90"
                                              >
                                                Enable single realm mode for this world
                                              </label>
                                            </div>
                                            <p className="text-[10px] text-gold/60">
                                              Controls settlement spawning behavior.
                                            </p>
                                          </div>
                                        </div>

                                        {/* Blitz Registration Fee Configuration */}
                                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                                          <div className="space-y-1">
                                            <label className="text-xs font-semibold text-gold/70">
                                              Blitz Registration Fee Amount
                                            </label>
                                            <input
                                              type="text"
                                              placeholder={defaultBlitzRegistration.amount}
                                              value={blitzFeeAmountOverrides[name] ?? defaultBlitzRegistration.amount}
                                              onChange={(e) =>
                                                setBlitzFeeAmountOverrides((p) => ({ ...p, [name]: e.target.value }))
                                              }
                                              className="w-full px-3 py-2 text-sm bg-black/40 border border-gold/20 rounded-md font-mono"
                                            />
                                            <p className="text-[10px] text-gold/60">
                                              Default: {defaultBlitzRegistration.amount} with precision{" "}
                                              {defaultBlitzRegistration.precision}.
                                            </p>
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-xs font-semibold text-gold/70">
                                              Fee Precision (decimals)
                                            </label>
                                            <input
                                              type="number"
                                              min={0}
                                              step={1}
                                              placeholder={String(defaultBlitzRegistration.precision)}
                                              value={
                                                blitzFeePrecisionOverrides[name] ??
                                                String(defaultBlitzRegistration.precision)
                                              }
                                              onChange={(e) =>
                                                setBlitzFeePrecisionOverrides((p) => ({ ...p, [name]: e.target.value }))
                                              }
                                              className="w-full px-3 py-2 text-sm bg-black/40 border border-gold/20 rounded-md font-mono"
                                            />
                                            <p className="text-[10px] text-gold/60">
                                              Default: {defaultBlitzRegistration.precision} decimals.
                                            </p>
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-xs font-semibold text-gold/70">
                                              Blitz Registration Fee Token
                                            </label>
                                            <input
                                              type="text"
                                              placeholder={defaultBlitzRegistration.token || "0x..."}
                                              value={
                                                blitzFeeTokenOverrides[name] ??
                                                (defaultBlitzRegistration.token ||
                                                  (eternumConfig as any)?.blitz?.registration?.fee_token ||
                                                  "")
                                              }
                                              onChange={(e) =>
                                                setBlitzFeeTokenOverrides((p) => ({ ...p, [name]: e.target.value }))
                                              }
                                              className="w-full px-3 py-2 text-sm bg-black/40 border border-gold/20 rounded-md font-mono"
                                            />
                                            <p className="text-[10px] text-gold/60">
                                              Default: {defaultBlitzRegistration.token}. Leave empty for default.
                                            </p>
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-xs font-semibold text-gold/70">
                                              Registration Count Max
                                            </label>
                                            <input
                                              type="number"
                                              min={0}
                                              step={1}
                                              placeholder="30"
                                              value={
                                                registrationCountMaxOverrides[name] ??
                                                String(
                                                  (eternumConfig as any)?.blitz?.registration?.registration_count_max ??
                                                    30,
                                                )
                                              }
                                              onChange={(e) =>
                                                setRegistrationCountMaxOverrides((p) => ({
                                                  ...p,
                                                  [name]: e.target.value,
                                                }))
                                              }
                                              className="w-full px-3 py-2 text-sm bg-black/40 border border-gold/20 rounded-md font-mono"
                                            />
                                            <p className="text-[10px] text-gold/60">Default: 30.</p>
                                          </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                          <div className="space-y-1">
                                            <label className="text-xs font-semibold text-gold/70">
                                              Blitz Fee Recipient
                                            </label>
                                            <input
                                              type="text"
                                              placeholder={(eternumConfig as any)?.blitz?.registration?.fee_recipient || "0x..."}
                                              value={
                                                blitzFeeRecipientOverrides[name] ??
                                                ((eternumConfig as any)?.blitz?.registration?.fee_recipient || "")
                                              }
                                              onChange={(e) =>
                                                setBlitzFeeRecipientOverrides((p) => ({ ...p, [name]: e.target.value }))
                                              }
                                              className="w-full px-3 py-2 text-sm bg-black/40 border border-gold/20 rounded-md font-mono"
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-xs font-semibold text-gold/70">
                                              Registration Delay (seconds)
                                            </label>
                                            <input
                                              type="number"
                                              min={0}
                                              step={1}
                                              placeholder={String((eternumConfig as any)?.blitz?.registration?.registration_delay_seconds ?? 60)}
                                              value={
                                                registrationDelaySecondsOverrides[name] ??
                                                String(
                                                  (eternumConfig as any)?.blitz?.registration?.registration_delay_seconds ??
                                                    60,
                                                )
                                              }
                                              onChange={(e) =>
                                                setRegistrationDelaySecondsOverrides((p) => ({
                                                  ...p,
                                                  [name]: e.target.value,
                                                }))
                                              }
                                              className="w-full px-3 py-2 text-sm bg-black/40 border border-gold/20 rounded-md font-mono"
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-xs font-semibold text-gold/70">
                                              Registration Period (seconds)
                                            </label>
                                            <input
                                              type="number"
                                              min={0}
                                              step={1}
                                              placeholder={String((eternumConfig as any)?.blitz?.registration?.registration_period_seconds ?? 600)}
                                              value={
                                                registrationPeriodSecondsOverrides[name] ??
                                                String(
                                                  (eternumConfig as any)?.blitz?.registration?.registration_period_seconds ??
                                                    600,
                                                )
                                              }
                                              onChange={(e) =>
                                                setRegistrationPeriodSecondsOverrides((p) => ({
                                                  ...p,
                                                  [name]: e.target.value,
                                                }))
                                              }
                                              className="w-full px-3 py-2 text-sm bg-black/40 border border-gold/20 rounded-md font-mono"
                                            />
                                          </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                          <div className="space-y-1">
                                            <label className="text-xs font-semibold text-gold/70">
                                              Bridge Close After End (seconds)
                                            </label>
                                            <input
                                              type="number"
                                              min={0}
                                              step={1}
                                              placeholder={String((eternumConfig as any)?.season?.bridgeCloseAfterEndSeconds ?? 0)}
                                              value={
                                                seasonBridgeCloseAfterEndSecondsOverrides[name] ??
                                                String(
                                                  (eternumConfig as any)?.season?.bridgeCloseAfterEndSeconds ?? 0,
                                                )
                                              }
                                              onChange={(e) =>
                                                setSeasonBridgeCloseAfterEndSecondsOverrides((p) => ({
                                                  ...p,
                                                  [name]: e.target.value,
                                                }))
                                              }
                                              className="w-full px-3 py-2 text-sm bg-black/40 border border-gold/20 rounded-md font-mono"
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-xs font-semibold text-gold/70">
                                              Point Registration Close (seconds)
                                            </label>
                                            <input
                                              type="number"
                                              min={0}
                                              step={1}
                                              placeholder={String(
                                                (eternumConfig as any)?.season?.pointRegistrationCloseAfterEndSeconds ?? 0,
                                              )}
                                              value={
                                                seasonPointRegistrationCloseAfterEndSecondsOverrides[name] ??
                                                String(
                                                  (eternumConfig as any)?.season
                                                    ?.pointRegistrationCloseAfterEndSeconds ?? 0,
                                                )
                                              }
                                              onChange={(e) =>
                                                setSeasonPointRegistrationCloseAfterEndSecondsOverrides((p) => ({
                                                  ...p,
                                                  [name]: e.target.value,
                                                }))
                                              }
                                              className="w-full px-3 py-2 text-sm bg-black/40 border border-gold/20 rounded-md font-mono"
                                            />
                                          </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                          <div className="space-y-1">
                                            <label className="text-xs font-semibold text-gold/70">Settlement Center</label>
                                            <input
                                              type="number"
                                              min={0}
                                              step={1}
                                              placeholder={String((eternumConfig as any)?.settlement?.center ?? 0)}
                                              value={
                                                settlementCenterOverrides[name] ??
                                                String((eternumConfig as any)?.settlement?.center ?? 0)
                                              }
                                              onChange={(e) =>
                                                setSettlementCenterOverrides((p) => ({ ...p, [name]: e.target.value }))
                                              }
                                              className="w-full px-3 py-2 text-sm bg-black/40 border border-gold/20 rounded-md font-mono"
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-xs font-semibold text-gold/70">
                                              Settlement Base Distance
                                            </label>
                                            <input
                                              type="number"
                                              min={0}
                                              step={1}
                                              placeholder={String((eternumConfig as any)?.settlement?.base_distance ?? 0)}
                                              value={
                                                settlementBaseDistanceOverrides[name] ??
                                                String((eternumConfig as any)?.settlement?.base_distance ?? 0)
                                              }
                                              onChange={(e) =>
                                                setSettlementBaseDistanceOverrides((p) => ({
                                                  ...p,
                                                  [name]: e.target.value,
                                                }))
                                              }
                                              className="w-full px-3 py-2 text-sm bg-black/40 border border-gold/20 rounded-md font-mono"
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-xs font-semibold text-gold/70">
                                              Settlement Subsequent Distance
                                            </label>
                                            <input
                                              type="number"
                                              min={0}
                                              step={1}
                                              placeholder={String((eternumConfig as any)?.settlement?.subsequent_distance ?? 0)}
                                              value={
                                                settlementSubsequentDistanceOverrides[name] ??
                                                String((eternumConfig as any)?.settlement?.subsequent_distance ?? 0)
                                              }
                                              onChange={(e) =>
                                                setSettlementSubsequentDistanceOverrides((p) => ({
                                                  ...p,
                                                  [name]: e.target.value,
                                                }))
                                              }
                                              className="w-full px-3 py-2 text-sm bg-black/40 border border-gold/20 rounded-md font-mono"
                                            />
                                          </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                          <div className="space-y-1">
                                            <label className="text-xs font-semibold text-gold/70">Trade Max Count</label>
                                            <input
                                              type="number"
                                              min={0}
                                              step={1}
                                              placeholder={String((eternumConfig as any)?.trade?.maxCount ?? 0)}
                                              value={
                                                tradeMaxCountOverrides[name] ??
                                                String((eternumConfig as any)?.trade?.maxCount ?? 0)
                                              }
                                              onChange={(e) =>
                                                setTradeMaxCountOverrides((p) => ({ ...p, [name]: e.target.value }))
                                              }
                                              className="w-full px-3 py-2 text-sm bg-black/40 border border-gold/20 rounded-md font-mono"
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-xs font-semibold text-gold/70">Battle Grace Ticks</label>
                                            <input
                                              type="number"
                                              min={0}
                                              step={1}
                                              placeholder={String((eternumConfig as any)?.battle?.graceTickCount ?? 0)}
                                              value={
                                                battleGraceTickCountOverrides[name] ??
                                                String((eternumConfig as any)?.battle?.graceTickCount ?? 0)
                                              }
                                              onChange={(e) =>
                                                setBattleGraceTickCountOverrides((p) => ({
                                                  ...p,
                                                  [name]: e.target.value,
                                                }))
                                              }
                                              className="w-full px-3 py-2 text-sm bg-black/40 border border-gold/20 rounded-md font-mono"
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-xs font-semibold text-gold/70">
                                              Battle Hyperstructure Grace Ticks
                                            </label>
                                            <input
                                              type="number"
                                              min={0}
                                              step={1}
                                              placeholder={String((eternumConfig as any)?.battle?.graceTickCountHyp ?? 0)}
                                              value={
                                                battleGraceTickCountHypOverrides[name] ??
                                                String((eternumConfig as any)?.battle?.graceTickCountHyp ?? 0)
                                              }
                                              onChange={(e) =>
                                                setBattleGraceTickCountHypOverrides((p) => ({
                                                  ...p,
                                                  [name]: e.target.value,
                                                }))
                                              }
                                              className="w-full px-3 py-2 text-sm bg-black/40 border border-gold/20 rounded-md font-mono"
                                            />
                                          </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                          <div className="space-y-1">
                                            <label className="text-xs font-semibold text-gold/70">Battle Delay (seconds)</label>
                                            <input
                                              type="number"
                                              min={0}
                                              step={1}
                                              placeholder={String((eternumConfig as any)?.battle?.delaySeconds ?? 0)}
                                              value={
                                                battleDelaySecondsOverrides[name] ??
                                                String((eternumConfig as any)?.battle?.delaySeconds ?? 0)
                                              }
                                              onChange={(e) =>
                                                setBattleDelaySecondsOverrides((p) => ({ ...p, [name]: e.target.value }))
                                              }
                                              className="w-full px-3 py-2 text-sm bg-black/40 border border-gold/20 rounded-md font-mono"
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-xs font-semibold text-gold/70">Agent Max Current</label>
                                            <input
                                              type="number"
                                              min={0}
                                              step={1}
                                              placeholder={String((eternumConfig as any)?.agent?.max_current_count ?? 0)}
                                              value={
                                                agentMaxCurrentCountOverrides[name] ??
                                                String((eternumConfig as any)?.agent?.max_current_count ?? 0)
                                              }
                                              onChange={(e) =>
                                                setAgentMaxCurrentCountOverrides((p) => ({ ...p, [name]: e.target.value }))
                                              }
                                              className="w-full px-3 py-2 text-sm bg-black/40 border border-gold/20 rounded-md font-mono"
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <label className="text-xs font-semibold text-gold/70">Agent Max Lifetime</label>
                                            <input
                                              type="number"
                                              min={0}
                                              step={1}
                                              placeholder={String((eternumConfig as any)?.agent?.max_lifetime_count ?? 0)}
                                              value={
                                                agentMaxLifetimeCountOverrides[name] ??
                                                String((eternumConfig as any)?.agent?.max_lifetime_count ?? 0)
                                              }
                                              onChange={(e) =>
                                                setAgentMaxLifetimeCountOverrides((p) => ({
                                                  ...p,
                                                  [name]: e.target.value,
                                                }))
                                              }
                                              className="w-full px-3 py-2 text-sm bg-black/40 border border-gold/20 rounded-md font-mono"
                                            />
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                          <button
                                            onClick={async () => {
                                              if (!account) return;
                                              setWorldConfigTx((p) => ({ ...p, [name]: { status: "running" } }));
                                              let localProvider: any = null;
                                              try {
                                                const deployedWorldAddress = await getWorldDeployedAddressLocal(name);
                                                if (!deployedWorldAddress) {
                                                  throw new Error("World is not deployed yet. Deploy first.");
                                                }

                                                // 1) Build runtime profile, patch manifest, create provider for this world
                                                const profile = await buildWorldProfile(currentChain as Chain, name);
                                                const baseManifest = getGameManifest(currentChain as Chain);
                                                const patched = patchManifestWithFactory(
                                                  baseManifest as any,
                                                  profile.worldAddress,
                                                  profile.contractsBySelector,
                                                );
                                                localProvider = new EternumProvider(
                                                  patched,
                                                  env.VITE_PUBLIC_NODE_URL,
                                                  env.VITE_PUBLIC_VRF_PROVIDER_ADDRESS,
                                                );

                                                // 2) Batch and run all config functions (same order as config-admin-page)
                                                await localProvider.beginBatch({ signer: account });

                                                // prepare optional overrides and build typed config
                                                const nowSec = Math.floor(Date.now() / 1000);
                                                const maxAllowed = nowSec + MAX_START_TIME_HOURS * 3600;
                                                const selectedStartRaw = startMainAtOverrides[name];
                                                const nextHourDefault = (() => {
                                                  const now = Date.now();
                                                  const nextHourMs = Math.ceil(now / 3600000) * 3600000;
                                                  return Math.floor(nextHourMs / 1000);
                                                })();
                                                const chosenStart =
                                                  selectedStartRaw && selectedStartRaw > 0
                                                    ? selectedStartRaw
                                                    : nextHourDefault;
                                                const selectedStart = Math.max(
                                                  nowSec,
                                                  Math.min(chosenStart, maxAllowed),
                                                );

                                                const selectedSettlingRaw = startSettlingAtOverrides[name];
                                                const selectedSettling =
                                                  selectedSettlingRaw && selectedSettlingRaw > 0
                                                    ? Math.max(nowSec, Math.min(selectedSettlingRaw, maxAllowed))
                                                    : undefined;
                                                if (selectedSettling && selectedSettling > selectedStart) {
                                                  throw new Error("Settling start cannot be later than game start");
                                                }

                                                const hasDevOverride = Object.prototype.hasOwnProperty.call(
                                                  devModeOverrides,
                                                  name,
                                                );
                                                const hasMmrOverride = Object.prototype.hasOwnProperty.call(
                                                  mmrEnabledOverrides,
                                                  name,
                                                );
                                                const hasSingleRealmOverride = Object.prototype.hasOwnProperty.call(
                                                  singleRealmModeOverrides,
                                                  name,
                                                );
                                                const hasDurationHoursOverride = Object.prototype.hasOwnProperty.call(
                                                  durationHoursOverrides,
                                                  name,
                                                );
                                                const hasDurationMinutesOverride = Object.prototype.hasOwnProperty.call(
                                                  durationMinutesOverrides,
                                                  name,
                                                );

                                                const configForWorld = buildWorldConfigForFactory({
                                                  baseConfig: eternumConfig as any,
                                                  defaults: {
                                                    factoryAddress:
                                                      factoryAddress || ((eternumConfig as any)?.factory_address ?? ""),
                                                    devModeOn,
                                                    mmrEnabledOn,
                                                    durationHours,
                                                    baseDurationMinutes,
                                                    defaultBlitzRegistration,
                                                  },
                                                  overrides: {
                                                    startMainAt: selectedStart,
                                                    startSettlingAt: selectedSettling,
                                                    devModeOn: hasDevOverride ? !!devModeOverrides[name] : undefined,
                                                    mmrEnabled: hasMmrOverride ? !!mmrEnabledOverrides[name] : undefined,
                                                    durationHours: hasDurationHoursOverride
                                                      ? String(durationHoursOverrides[name] ?? 0)
                                                      : undefined,
                                                    durationMinutes: hasDurationMinutesOverride
                                                      ? String(durationMinutesOverrides[name] ?? 0)
                                                      : undefined,
                                                    blitzFeeAmount: blitzFeeAmountOverrides[name],
                                                    blitzFeePrecision: blitzFeePrecisionOverrides[name],
                                                    blitzFeeToken: blitzFeeTokenOverrides[name],
                                                    blitzFeeRecipient: blitzFeeRecipientOverrides[name],
                                                    registrationCountMax: registrationCountMaxOverrides[name],
                                                    registrationDelaySeconds: registrationDelaySecondsOverrides[name],
                                                    registrationPeriodSeconds: registrationPeriodSecondsOverrides[name],
                                                    factoryAddress: factoryAddressOverrides[name],
                                                    singleRealmMode: hasSingleRealmOverride
                                                      ? !!singleRealmModeOverrides[name]
                                                      : undefined,
                                                    seasonBridgeCloseAfterEndSeconds:
                                                      seasonBridgeCloseAfterEndSecondsOverrides[name],
                                                    seasonPointRegistrationCloseAfterEndSeconds:
                                                      seasonPointRegistrationCloseAfterEndSecondsOverrides[name],
                                                    settlementCenter: settlementCenterOverrides[name],
                                                    settlementBaseDistance: settlementBaseDistanceOverrides[name],
                                                    settlementSubsequentDistance:
                                                      settlementSubsequentDistanceOverrides[name],
                                                    tradeMaxCount: tradeMaxCountOverrides[name],
                                                    battleGraceTickCount: battleGraceTickCountOverrides[name],
                                                    battleGraceTickCountHyp: battleGraceTickCountHypOverrides[name],
                                                    battleDelaySeconds: battleDelaySecondsOverrides[name],
                                                    agentMaxCurrentCount: agentMaxCurrentCountOverrides[name],
                                                    agentMaxLifetimeCount: agentMaxLifetimeCountOverrides[name],
                                                  },
                                                });

                                                const ctx = {
                                                  account,
                                                  provider: localProvider as any,
                                                  config: configForWorld,
                                                } as any;

                                                await setWorldConfig(ctx);
                                                await setVRFConfig(ctx);
                                                await setGameModeConfig(ctx);
                                                await setFactoryAddressConfig(ctx);
                                                await setMMRConfig(ctx);
                                                await setVictoryPointsConfig(ctx);
                                                await setDiscoverableVillageSpawnResourcesConfig(ctx);
                                                await setBlitzRegistrationConfig(ctx);
                                                await setAgentConfig(ctx);
                                                await setVillageControllersConfig(ctx);
                                                await setTradeConfig(ctx);
                                                await setSeasonConfig(ctx);
                                                await setResourceBridgeFeesConfig(ctx);
                                                await setBattleConfig(ctx);
                                                await setStructureMaxLevelConfig(ctx);
                                                await setupGlobals(ctx);
                                                await setCapacityConfig(ctx);
                                                await setSpeedConfig(ctx);
                                                await setHyperstructureConfig(ctx);
                                                await setSettlementConfig(ctx);
                                                await setStartingResourcesConfig(ctx);
                                                await setWeightConfig(ctx);
                                                await setRealmUpgradeConfig(ctx);
                                                await setTroopConfig(ctx);
                                                await setBuildingConfig(ctx);
                                                await SetResourceFactoryConfig(ctx);
                                                // await setResourceBridgeWtlConfig(ctx);

                                                const receipt = await localProvider.endBatch({ flush: true });
                                                setWorldConfigTx((p) => ({
                                                  ...p,
                                                  [name]: { status: "success", hash: receipt?.transaction_hash },
                                                }));

                                                // Mark world as configured after successful transaction
                                                markWorldAsConfigured(name);

                                                // Close the config panel after successful configuration
                                                setWorldConfigOpen((prev) => ({ ...prev, [name]: false }));
                                              } catch (e: any) {
                                                const msg = e?.message ?? String(e);
                                                setWorldConfigTx((p) => ({
                                                  ...p,
                                                  [name]: { status: "error", error: msg },
                                                }));
                                                try {
                                                  // attempt to cancel if batching
                                                  // @ts-ignore
                                                  await (localProvider as any)?.endBatch?.({ flush: false });
                                                } catch {}
                                              }
                                            }}
                                            className="button-gold px-4 py-2 bg-gold/20 hover:bg-gold/30 text-gold text-xs font-semibold rounded-md disabled:bg-gold/20 disabled:cursor-not-allowed"
                                            disabled={
                                              !account ||
                                              worldConfigTx[name]?.status === "running" ||
                                              !!startMainAtErrors[name] ||
                                              !!startSettlingAtErrors[name]
                                            }
                                          >
                                            Set
                                          </button>

                                          {worldConfigTx[name]?.hash && (
                                            <a
                                              href={getExplorerTxUrl(currentChain as any, worldConfigTx[name]!.hash)}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-xs text-gold/90 hover:underline ml-2"
                                            >
                                              View Tx
                                            </a>
                                          )}
                                        </div>

                                        {worldConfigTx[name]?.error && (
                                          <p className="text-xs text-red-600">{worldConfigTx[name]?.error}</p>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dev Section at the Bottom */}
        {parsedManifest && (
          <div className="space-y-4 mt-12">
            <button
              onClick={() => setShowDevConfig(!showDevConfig)}
              className="flex items-center gap-2 text-sm font-semibold text-gold/70 hover:text-gold transition-colors"
            >
              {showDevConfig ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Are you a dev?
            </button>

            {showDevConfig && (
              <div className="space-y-8">
                {/* Configuration Section */}
                <div className="p-6 bg-black/40 rounded-2xl border-2 border-gold/20">
                  <h3 className="text-lg font-bold text-gold mb-4">Configuration</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gold/70 uppercase tracking-wide">
                        Factory Address
                      </label>
                      <input
                        type="text"
                        value={factoryAddress}
                        disabled
                        className="w-full px-4 py-3 bg-gold/20 border-2 border-gold/20 rounded-xl text-gold/60 font-mono text-sm cursor-not-allowed"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gold/70 uppercase tracking-wide">Version</label>
                      <input
                        type="text"
                        value={version}
                        onChange={(e) => setVersion(e.target.value)}
                        className="w-full px-4 py-3 bg-black/40 border-2 border-gold/20 hover:border-gold/40 focus:border-gold/60 rounded-xl text-gold focus:outline-none transition-all"
                      />
                      {version !== DEFAULT_VERSION && (
                        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-amber-800">
                            <span className="font-semibold">Warning:</span> This needs to be updated in the code so new
                            deployers automatically use version {version}. For now, only you can use this version
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gold/70 uppercase tracking-wide">Namespace</label>
                      <input
                        type="text"
                        value={namespace}
                        disabled
                        className="w-full px-4 py-3 bg-gold/20 border-2 border-gold/20 rounded-xl text-gold/60 cursor-not-allowed"
                      />
                    </div>

                    <button
                      onClick={handleSetConfig}
                      disabled={!factoryAddress || !account || tx.status === "running"}
                      className="button-gold w-full px-6 py-3 bg-gradient-to-r from-gold/20 to-gold/20 hover:from-gold/30 hover:to-gold/30 disabled:from-gold/20 disabled:to-gold/20 disabled:cursor-not-allowed text-gold font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
                    >
                      {tx.status === "running" && getTxStatusIcon()}
                      <span>Set Configuration</span>
                    </button>

                    {/* Transaction Status for Set Configuration */}
                    {tx.status === "success" && tx.hash && (
                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span className="text-sm font-semibold text-emerald-900">Configuration Successful</span>
                          </div>
                          <a
                            href={getExplorerTxUrl(currentChain as any, tx.hash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-semibold text-gold/90 hover:text-gold underline"
                          >
                            View Transaction
                          </a>
                        </div>
                      </div>
                    )}
                    {tx.status === "error" && tx.error && (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                        <div className="flex items-start gap-2">
                          <XCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-red-900">Configuration Failed</p>
                            <p className="text-xs text-red-700 mt-1">{tx.error}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Deployment Summary Section */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-2xl font-bold text-gold">Deployment Summary</h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowFullConfig((v) => !v)}
                        className="button-wood px-6 py-3 text-sm font-semibold text-gold/90 hover:text-gold bg-gold/10 hover:bg-gold/15 border-2 border-gold/20 hover:border-gold/40 rounded-2xl transition-all duration-200 uppercase tracking-wide shadow-sm hover:shadow-lg hover:shadow-emerald-500/20"
                      >
                        {showFullConfig ? "Hide" : "View"} Full Config
                      </button>
                      <button
                        onClick={() => setShowCairoOutput(!showCairoOutput)}
                        className="button-wood px-6 py-3 text-sm font-semibold text-gold/90 hover:text-gold bg-gold/10 hover:bg-gold/15 border-2 border-gold/20 hover:border-gold/40 rounded-2xl transition-all duration-200 uppercase tracking-wide shadow-sm hover:shadow-lg hover:shadow-gold/20"
                      >
                        {showCairoOutput ? "Hide" : "View"} Cairo Code
                      </button>
                    </div>
                  </div>

                  <div className="p-8 bg-black/40 border-2 border-gold/20 rounded-3xl shadow-lg space-y-1">
                    <div className="flex items-center justify-between py-5 border-b-2 border-gold/10">
                      <span className="text-sm font-bold text-gold/70 uppercase tracking-wide">World Class Hash</span>
                      <span className="text-sm text-gold font-mono bg-black/40 px-4 py-2 rounded-lg border border-gold/20">
                        {parsedManifest.world.class_hash.slice(0, 20)}...
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-5 border-b-2 border-gold/10">
                      <span className="text-sm font-bold text-gold/70 uppercase tracking-wide">Namespace</span>
                      <span className="text-sm font-semibold text-gold bg-black/40 px-4 py-2 rounded-lg border border-gold/20">
                        {namespace}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-5">
                      <span className="text-sm font-bold text-gold/70 uppercase tracking-wide">
                        Calldata Arguments
                      </span>
                      <span className="text-sm font-bold text-gold font-mono bg-black/40 px-4 py-2 rounded-lg border border-gold/20">
                        {generatedCalldata.length}
                      </span>
                    </div>
                  </div>

                  {showCairoOutput && (
                    <div className="p-8 panel-wood border-2 border-gold/20 rounded-3xl shadow-2xl">
                      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gold/20">
                        <div className="h-10 w-10 rounded-xl bg-gold/15 flex items-center justify-center">
                          <Download className="w-5 h-5 text-gold" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gold">Generated Cairo Code</p>
                          <p className="text-xs text-gold/60">Factory configuration output</p>
                        </div>
                      </div>
                      <pre className="text-xs text-gold/90 overflow-x-auto leading-relaxed font-mono">
                        {generateCairoOutput(parsedManifest, version, maxActions, defaultNamespaceWriterAll, namespace)}
                      </pre>
                    </div>
                  )}

                  {showFullConfig && (
                    <div className="p-8 bg-black/40 border-2 border-gold/20 rounded-3xl shadow-lg">
                      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gold/20">
                        <div className="h-10 w-10 rounded-xl bg-gold/15 flex items-center justify-center">
                          <Download className="w-5 h-5 text-gold" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gold">Full Configuration (read-only)</p>
                          <p className="text-xs text-gold/60">Effective config for current chain</p>
                        </div>
                      </div>
                      <pre className="text-xs text-gold overflow-x-auto leading-relaxed font-mono whitespace-pre-wrap">
                        {JSON.stringify(eternumConfig, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
