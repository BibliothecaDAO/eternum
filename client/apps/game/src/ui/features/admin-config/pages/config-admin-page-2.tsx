import { useAccountStore } from "@/hooks/store/use-account-store";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Download,
  Factory,
  Loader2,
  RefreshCw,
  Trash2,
  XCircle,
  Copy,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { byteArray, shortString } from "starknet";
import { env } from "../../../../../env";
import { getManifestJsonString, type ChainType } from "../utils/manifest-loader";
import { ETERNUM_CONFIG } from "@/utils/config";
import { getGameManifest, type Chain } from "@contracts";
import { buildWorldProfile, patchManifestWithFactory } from "@/runtime/world";
import { EternumProvider } from "@bibliothecadao/provider";
import type { Config as EternumConfig } from "@bibliothecadao/types";
import {
  SetResourceFactoryConfig,
  setAgentConfig,
  setBattleConfig,
  setBlitzPreviousGame,
  setBlitzRegistrationConfig,
  setBuildingConfig,
  setCapacityConfig,
  setDiscoverableVillageSpawnResourcesConfig,
  setGameModeConfig,
  setHyperstructureConfig,
  setRealmUpgradeConfig,
  setResourceBridgeFeesConfig,
  setResourceBridgeWtlConfig,
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
  setWonderBonusConfig,
  setWorldConfig,
  setupGlobals,
} from "@config-deployer/config";

type TxState = { status: "idle" | "running" | "success" | "error"; hash?: string; error?: string };

// Local storage keys
const WORLD_NAMES_STORAGE_KEY = "eternum_world_names";
const CURRENT_WORLD_NAME_KEY = "eternum_current_world_name";
const INDEXER_CREATION_COOLDOWN_KEY = "eternum_indexer_cooldown";

// Indexer creation cooldown (5 minutes in milliseconds)
const INDEXER_COOLDOWN_MS = 5 * 60 * 1000;
// Cache of deployed world addresses: worldName -> contract_address
const WORLD_DEPLOYED_ADDRESS_MAP_KEY = "eternum_world_deployed_address_map";

// Helper to generate world name: first 10 letters of controller name (or fallback) + - + 5 random numbers
const generateWorldName = (controllerName?: string): string => {
  const base = (controllerName || "world").toString();
  const sanitizedName = base
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 10) || "world";
  const randomNumbers = Math.floor(10000 + Math.random() * 90000); // 5-digit number
  return `${sanitizedName}-${randomNumbers}`;
};

// Helper to get stored world names
const getStoredWorldNames = (): string[] => {
  try {
    const stored = localStorage.getItem(WORLD_NAMES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

// Helper to save world name after successful deployment
const saveWorldNameToStorage = (worldName: string) => {
  try {
    const existing = getStoredWorldNames();
    if (!existing.includes(worldName)) {
      const updated = [...existing, worldName];
      localStorage.setItem(WORLD_NAMES_STORAGE_KEY, JSON.stringify(updated));
    }
  } catch (err) {
    console.error("Failed to save world name:", err);
  }
};

// Helper to get current world name
const getCurrentWorldName = (): string | null => {
  try {
    return localStorage.getItem(CURRENT_WORLD_NAME_KEY);
  } catch {
    return null;
  }
};

// Helper to set current world name
const setCurrentWorldName = (worldName: string) => {
  try {
    localStorage.setItem(CURRENT_WORLD_NAME_KEY, worldName);
  } catch (err) {
    console.error("Failed to set current world name:", err);
  }
};

// Helper to get cooldown data for a world
const getIndexerCooldown = (worldName: string): number | null => {
  try {
    const stored = localStorage.getItem(`${INDEXER_CREATION_COOLDOWN_KEY}_${worldName}`);
    return stored ? parseInt(stored, 10) : null;
  } catch {
    return null;
  }
};

// ===== World deployed address cache helpers =====
const getDeployedAddressMap = (): Record<string, string> => {
  try {
    const raw = localStorage.getItem(WORLD_DEPLOYED_ADDRESS_MAP_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
};

const setDeployedAddressMap = (map: Record<string, string>) => {
  try {
    localStorage.setItem(WORLD_DEPLOYED_ADDRESS_MAP_KEY, JSON.stringify(map));
  } catch (err) {
    console.error("Failed to persist deployed address map:", err);
  }
};

const getCachedDeployedAddress = (worldName: string): string | null => {
  const map = getDeployedAddressMap();
  return map[worldName] ?? null;
};

const cacheDeployedAddress = (worldName: string, address: string) => {
  const map = getDeployedAddressMap();
  if (address) {
    map[worldName] = address;
    setDeployedAddressMap(map);
  }
};

// Helper to set cooldown for a world
const setIndexerCooldown = (worldName: string) => {
  try {
    const cooldownUntil = Date.now() + INDEXER_COOLDOWN_MS;
    localStorage.setItem(`${INDEXER_CREATION_COOLDOWN_KEY}_${worldName}`, cooldownUntil.toString());
  } catch (err) {
    console.error("Failed to set indexer cooldown:", err);
  }
};

// Helper to check if world is on cooldown
const isWorldOnCooldown = (worldName: string): boolean => {
  const cooldownUntil = getIndexerCooldown(worldName);
  if (!cooldownUntil) return false;
  return Date.now() < cooldownUntil;
};

// Helper to get remaining cooldown time in seconds
const getRemainingCooldown = (worldName: string): number => {
  const cooldownUntil = getIndexerCooldown(worldName);
  if (!cooldownUntil) return 0;
  const remaining = Math.max(0, cooldownUntil - Date.now());
  return Math.ceil(remaining / 1000); // Convert to seconds
};

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

// Factory addresses by chain
const FACTORY_ADDRESSES: Record<ChainType, string> = {
  sepolia: "0x053412958d530f1a639c6d2928f27b13cbd65b0652edfd2817fb96c69d160e4b",
  local: "",
  mainnet: "",
  slot: "",
  slottest: "",
};

// Factory Torii SQL endpoints by chain
const FACTORY_TORII_URLS: Record<ChainType, string> = {
  sepolia: "https://api.cartridge.gg/x/eternum-dojo-world-factory/torii/sql",
  local: "",
  mainnet: "",
  slot: "",
  slottest: "",
};

// Torii configuration by chain
interface ToriiConfig {
  env: string;
  rpc_url: string;
  torii_namespaces: string;
  workflow_file?: string;
  ref?: string;
  external_contracts?: string[]; // Array of "type:address" strings
}

const TORII_CONFIGS: Record<ChainType, Partial<ToriiConfig>> = {
  sepolia: {
    env: "sepolia",
    rpc_url: "https://api.cartridge.gg/x/starknet/sepolia",
    torii_namespaces: "s1_eternum",
    external_contracts: [],
  },
  slot: {
    env: "slot",
    rpc_url: "https://api.cartridge.gg/x/eternum-blitz-slot-1/katana",
    torii_namespaces: "s1_eternum",
    workflow_file: "deploy-blitz-torii.yml",
    ref: "blitz",
    external_contracts: [],
  },
  slottest: {
    env: "slottest",
    rpc_url: "https://api.cartridge.gg/x/eternum-blitz-slot-test/katana",
    torii_namespaces: "s1_eternum",
    external_contracts: [],
  },
  local: {},
  mainnet: {},
};

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
}

// Generate factory config calldata from manifest
const generateFactoryCalldata = (
  manifest: ManifestData,
  version: string,
  namespace: string,
  maxActions: number = 20,
  defaultNamespaceWriterAll: boolean = true,
): any[] => {
  const calldata: any[] = [];

  // Version (felt252)
  calldata.push(version);

  // Max actions (u64)
  calldata.push(maxActions);

  // World class hash
  calldata.push(manifest.world.class_hash);

  // Default namespace (as ByteArray)
  const namespaceByteArray = byteArray.byteArrayFromString(namespace);
  calldata.push(namespaceByteArray);

  // Default namespace writer all (bool)
  calldata.push(defaultNamespaceWriterAll ? 1 : 0);

  // Contracts count
  calldata.push(manifest.contracts.length);

  // Contracts array: selector, class_hash, init_calldata_count, ...init_calldata
  for (const contract of manifest.contracts) {
    calldata.push(contract.selector);
    calldata.push(contract.class_hash);
    const initCalldataCount = contract.init_calldata?.length || 0;
    calldata.push(initCalldataCount);
    if (initCalldataCount > 0) {
      calldata.push(...(contract.init_calldata || []));
    }
    calldata.push(0); // writer of resources
    calldata.push(0); // owner of resources
  }

  // Models count
  calldata.push(manifest.models.length);

  // Models array: class_hash
  for (const model of manifest.models) {
    calldata.push(model.class_hash);
  }

  // Events count
  calldata.push(manifest.events.length);

  // Events array: class_hash
  for (const event of manifest.events) {
    calldata.push(event.class_hash);
  }

  return calldata;
};

// Generate Cairo code output similar to sozo inspect --output-factory
const generateCairoOutput = (
  manifest: ManifestData,
  version: string,
  maxActions: number,
  defaultNamespaceWriterAll: boolean,
  namespace: string,
): string => {
  let output = `let factory_config = FactoryConfig {\n`;
  output += `    version: '${version}',\n`;
  output += `    max_actions: ${maxActions},\n`;
  output += `    world_class_hash: TryInto::<felt252, ClassHash>::try_into(${manifest.world.class_hash}).unwrap(),\n`;
  output += `    default_namespace: "${namespace}",\n`;
  output += `    default_namespace_writer_all: ${defaultNamespaceWriterAll},\n`;
  output += `    contracts: array![\n`;

  for (const contract of manifest.contracts) {
    const initArgsCount = contract.init_calldata?.length || 0;
    output += `        (selector_from_tag!("${contract.tag}"), TryInto::<felt252, ClassHash>::try_into(${contract.class_hash}).unwrap(), array![`;
    if (initArgsCount > 0) {
      output += contract.init_calldata?.join(", ");
    }
    output += `]),\n`;
  }

  output += `    ],\n`;
  output += `    models: array![\n`;

  for (const model of manifest.models) {
    output += `        TryInto::<felt252, ClassHash>::try_into(${model.class_hash}).unwrap(),\n`;
  }

  output += `    ],\n`;
  output += `    events: array![\n`;

  for (const event of manifest.events) {
    output += `        TryInto::<felt252, ClassHash>::try_into(${event.class_hash}).unwrap(),\n`;
  }

  output += `    ],\n`;
  output += `};\n`;

  return output;
};

export const ConfigAdminPage2 = () => {
  const navigate = useNavigate();
  const { account, accountName } = useAccountStore();

  const currentChain = env.VITE_PUBLIC_CHAIN as ChainType;
  const DEFAULT_VERSION = "180";

  const [factoryAddress, setFactoryAddress] = useState<string>("");
  const [version, setVersion] = useState<string>(DEFAULT_VERSION);
  const [namespace, setNamespace] = useState<string>("s1_eternum");
  const [worldName, setWorldName] = useState<string>("");
  const [maxActions, setMaxActions] = useState<number>(20);
  const [defaultNamespaceWriterAll, setDefaultNamespaceWriterAll] = useState<boolean>(true);
  const [manifestJson, setManifestJson] = useState<string>("");
  const [parsedManifest, setParsedManifest] = useState<ManifestData | null>(null);
  const [tx, setTx] = useState<TxState>({ status: "idle" });
  const [generatedCalldata, setGeneratedCalldata] = useState<any[]>([]);
  const [showCairoOutput, setShowCairoOutput] = useState<boolean>(false);
  const [showFullConfig, setShowFullConfig] = useState<boolean>(false);
  const [showDevConfig, setShowDevConfig] = useState<boolean>(false);
  const [storedWorldNames, setStoredWorldNames] = useState<string[]>([]);
  const [showStoredNames, setShowStoredNames] = useState<boolean>(true); // Show by default
  const [worldIndexerStatus, setWorldIndexerStatus] = useState<Record<string, boolean>>({});
  const [creatingIndexer, setCreatingIndexer] = useState<Record<string, boolean>>({});
  const [cooldownTimers, setCooldownTimers] = useState<Record<string, number>>({});
  const [indexerCreationCountdown, setIndexerCreationCountdown] = useState<Record<string, number>>({});
  const [worldDeployedStatus, setWorldDeployedStatus] = useState<Record<string, boolean>>({});
  // Per-world config execution state
  const [worldConfigOpen, setWorldConfigOpen] = useState<Record<string, boolean>>({});
  const [worldConfigTx, setWorldConfigTx] = useState<Record<string, TxState>>({});
  // Per-world season start override (epoch seconds)
  const [startMainAtOverrides, setStartMainAtOverrides] = useState<Record<string, number>>({});
  const [startMainAtErrors, setStartMainAtErrors] = useState<Record<string, string>>({});

  // Shared Eternum config (static values), manifest will be patched per-world at runtime
  const eternumConfig: EternumConfig = useMemo(() => ETERNUM_CONFIG(), []);

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

    // Initialize world name from storage or generate new one
    const savedWorldName = getCurrentWorldName();
    if (savedWorldName) {
      setWorldName(savedWorldName);
    } else if (accountName) {
      const newWorldName = generateWorldName(accountName);
      setWorldName(newWorldName);
      setCurrentWorldName(newWorldName);
    } else {
      // Fallback to a default world name when no accountName is present (e.g., after HMR)
      const newWorldName = generateWorldName();
      setWorldName(newWorldName);
      setCurrentWorldName(newWorldName);
    }
  }, [currentChain]);

  // Generate world name when account name changes
  useEffect(() => {
    if (accountName && !worldName) {
      const newWorldName = generateWorldName(accountName);
      setWorldName(newWorldName);
      setCurrentWorldName(newWorldName);
    }
  }, [accountName]);

  // Check indexer and deployment statuses when stored world names change
  useEffect(() => {
    if (storedWorldNames.length > 0) {
      checkAllWorldStatuses();
    }
  }, [storedWorldNames.length]);

  // Update cooldown timers every second
  useEffect(() => {
    const interval = setInterval(() => {
      const updatedTimers: Record<string, number> = {};
      let hasActiveTimers = false;

      storedWorldNames.forEach((worldName) => {
        const remaining = getRemainingCooldown(worldName);
        if (remaining > 0) {
          updatedTimers[worldName] = remaining;
          hasActiveTimers = true;
        }
      });

      if (hasActiveTimers) {
        setCooldownTimers(updatedTimers);
      } else {
        setCooldownTimers({});
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [storedWorldNames]);

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

  // Load manifest from config files
  const handleLoadFromConfig = (chain: ChainType) => {
    const jsonString = getManifestJsonString(chain);
    if (jsonString) {
      setManifestJson(jsonString);
    }
  };

  // Generate new world name
  const handleGenerateWorldName = () => {
    const newWorldName = generateWorldName(accountName || undefined);
    setWorldName(newWorldName);
    setCurrentWorldName(newWorldName);
  };

  // Add current world name to queue
  const handleAddToQueue = () => {
    if (!worldName) return;

    // Check if already in list
    const existing = getStoredWorldNames();
    if (existing.includes(worldName)) return;

    // Add to localStorage
    saveWorldNameToStorage(worldName);
    setStoredWorldNames(getStoredWorldNames());

    // Generate new world name for next queue item regardless of accountName
    const newWorldName = generateWorldName(accountName || undefined);
    setWorldName(newWorldName);
    setCurrentWorldName(newWorldName);
  };

  // Remove world name from queue
  const handleRemoveFromQueue = (worldName: string) => {
    try {
      const existing = getStoredWorldNames();
      const updated = existing.filter((name) => name !== worldName);
      localStorage.setItem(WORLD_NAMES_STORAGE_KEY, JSON.stringify(updated));
      setStoredWorldNames(updated);

      // Clear current world name if it matches the removed one
      if (getCurrentWorldName() === worldName) {
        localStorage.removeItem(CURRENT_WORLD_NAME_KEY);
      }
    } catch (err) {
      console.error("Failed to remove world name:", err);
    }
  };

  // Check if world is deployed via factory Torii SQL
  const checkWorldDeployed = async (worldName: string): Promise<boolean> => {
    try {
      const addr = await getWorldDeployedAddress(worldName);
      return !!addr;
    } catch (error) {
      console.error(`Error checking if world ${worldName} is deployed:`, error);
      return false;
    }
  };

  // Check if indexer exists for a world name
  const checkIndexerExists = async (worldName: string): Promise<boolean> => {
    try {
      const response = await fetch(`https://api.cartridge.gg/x/${worldName}/torii/sql`, {
        method: "HEAD", // Use HEAD to avoid downloading response body
      });
      return response.status === 200;
    } catch (error) {
      console.error(`Error checking indexer for ${worldName}:`, error);
      return false;
    }
  };

  // Fetch deployed world address from factory Torii (returns null if not deployed)
  const getWorldDeployedAddress = async (worldName: string): Promise<string | null> => {
    try {
      // 1) check cache first
      const cached = getCachedDeployedAddress(worldName);
      if (cached) return cached;

      const factoryToriiUrl = FACTORY_TORII_URLS[currentChain];
      if (!factoryToriiUrl) return null;

      const worldNameFeltPadded = textToFeltPadded(worldName);
      const query = `SELECT * FROM [wf-WorldDeployed] WHERE name = "${worldNameFeltPadded}" LIMIT 1;`;
      const encodedQuery = encodeURIComponent(query);

      const response = await fetch(`${factoryToriiUrl}?query=${encodedQuery}`);
      if (!response.ok) return null;

      const data = await response.json();
      if (!data || !Array.isArray(data) || data.length === 0) return null;

      const row = data[0] as any;
      // Prefer explicit address field; fall back to contract_address if schema differs
      const addr = (row.address as string) || (row.contract_address as string) || null;
      if (addr) cacheDeployedAddress(worldName, addr);
      return addr;
    } catch (error) {
      console.error(`Error fetching deployed world address for ${worldName}:`, error);
      return null;
    }
  };

  // Check indexer and deployment status for all stored worlds
  const checkAllWorldStatuses = async () => {
    const worlds = getStoredWorldNames();
    const statusPromises = worlds.map(async (worldName) => {
      const [indexerExists, deployedAddress] = await Promise.all([
        checkIndexerExists(worldName),
        getWorldDeployedAddress(worldName),
      ]);
      return { worldName, indexerExists, isDeployed: !!deployedAddress, deployedAddress };
    });

    const results = await Promise.all(statusPromises);
    const indexerStatusMap: Record<string, boolean> = {};
    const deployedStatusMap: Record<string, boolean> = {};

    results.forEach(({ worldName, indexerExists, isDeployed, deployedAddress }) => {
      indexerStatusMap[worldName] = indexerExists;
      deployedStatusMap[worldName] = isDeployed;
      if (deployedAddress) cacheDeployedAddress(worldName, deployedAddress);
    });

    setWorldIndexerStatus(indexerStatusMap);
    setWorldDeployedStatus(deployedStatusMap);
  };

  // Handle create indexer
  const handleCreateIndexer = async (worldName: string) => {
    // Check if on cooldown
    if (isWorldOnCooldown(worldName)) {
      return;
    }

    // Get torii config for current chain
    const toriiConfig = TORII_CONFIGS[currentChain];
    if (!toriiConfig || Object.keys(toriiConfig).length === 0) {
      return;
    }

    // Get deployed world address from factory (required for indexer creation)
    const deployedWorldAddress = await getWorldDeployedAddress(worldName);
    if (!deployedWorldAddress) {
      console.warn("World not deployed or address not found in factory indexer; cannot create indexer.");
      return;
    }

    try {
      // Immediately set cooldown so UI shows small wait timer right away
      setIndexerCooldown(worldName);
      setCooldownTimers((prev) => ({ ...prev, [worldName]: getRemainingCooldown(worldName) }));

      // Build query parameters
      const params = new URLSearchParams({
        env: toriiConfig.env || "",
        torii_prefix: worldName,
        rpc_url: toriiConfig.rpc_url || "",
        // World contract address to follow
        torii_world_address: deployedWorldAddress,
        torii_namespaces: toriiConfig.torii_namespaces || "",
      });

      // Add optional parameters if they exist
      if (toriiConfig.workflow_file) {
        params.append("workflow_file", toriiConfig.workflow_file);
      }
      if (toriiConfig.ref) {
        params.append("ref", toriiConfig.ref);
      }

      // Add external contracts using &contract= syntax
      if (toriiConfig.external_contracts && toriiConfig.external_contracts.length > 0) {
        toriiConfig.external_contracts.forEach((contract) => {
          params.append("contract", contract);
        });
      }

      // TODO: Replace with your actual Cloudflare Worker URL
      const workerUrl = "https://torii-creator.zerocredence.workers.dev/dispatch/torii";
      const response = await fetch(`${workerUrl}?${params.toString()}`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`Failed to create indexer: ${response.statusText}`);
      }

      // Poll for indexer status while waiting (every 10 seconds)
      const pollInterval = setInterval(async () => {
        const exists = await checkIndexerExists(worldName);
        if (exists) {
          setWorldIndexerStatus((prev) => ({ ...prev, [worldName]: true }));
          clearInterval(pollInterval);
        }
      }, 10000); // Check every 10 seconds

      // Stop polling after 6 minutes (safety limit)
      setTimeout(() => {
        clearInterval(pollInterval);
      }, 360000); // 6 minutes
    } catch (error: any) {
      console.error("Error creating indexer:", error);
    }
  };

  // Execute set_config only
  const handleSetConfig = async () => {
    if (!account || !parsedManifest || !factoryAddress) return;

    setTx({ status: "running" });

    try {
      const result = await account.execute({
        contractAddress: factoryAddress,
        entrypoint: "set_config",
        calldata: generatedCalldata,
      });

      setTx({ status: "success", hash: result.transaction_hash });
      await account.waitForTransaction(result.transaction_hash);
    } catch (err: any) {
      setTx({ status: "error", error: err.message });
    }
  };

  // Execute deploy only
  const handleDeploy = async () => {
    if (!account || !factoryAddress || !worldName) return;

    setTx({ status: "running" });

    try {
      const worldNameFelt = shortString.encodeShortString(worldName);
      const result = await account.execute({
        contractAddress: factoryAddress,
        entrypoint: "deploy",
        calldata: [worldNameFelt, version],
      });

      setTx({ status: "success", hash: result.transaction_hash });
      await account.waitForTransaction(result.transaction_hash);

      // Save world name to storage after successful deployment
      saveWorldNameToStorage(worldName);
      setStoredWorldNames(getStoredWorldNames());
    } catch (err: any) {
      setTx({ status: "error", error: err.message });
    }
  };

  // Execute both set_config and deploy in multicall
  const handleSetConfigAndDeploy = async () => {
    if (!account || !parsedManifest || !factoryAddress || !worldName) return;

    setTx({ status: "running" });

    console.log("Generated Calldata:", generatedCalldata);

    try {
      const worldNameFelt = shortString.encodeShortString(worldName);
      const result = await account.execute([
        {
          contractAddress: factoryAddress,
          entrypoint: "set_config",
          calldata: generatedCalldata,
        },
        {
          contractAddress: factoryAddress,
          entrypoint: "deploy",
          calldata: [worldNameFelt, version],
        },
      ]);

      setTx({ status: "success", hash: result.transaction_hash });
      await account.waitForTransaction(result.transaction_hash);

      // Save world name to storage after successful deployment
      saveWorldNameToStorage(worldName);
      setStoredWorldNames(getStoredWorldNames());
    } catch (err: any) {
      setTx({ status: "error", error: err.message });
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

  const getDisabledReason = (action: "configAndDeploy" | "config" | "deploy"): string | null => {
    if (tx.status === "running") return "Transaction in progress";
    if (!account) return "Wallet not connected";
    if (!factoryAddress) return "Factory address required";
    if ((action === "configAndDeploy" || action === "deploy") && !worldName) return "World name required";
    return null;
  };

  return (
    <div className="fixed inset-0 w-full h-full overflow-y-auto overflow-x-hidden bg-gradient-to-br from-slate-200 via-blue-200 to-indigo-200">
      <div className="max-w-6xl mx-auto px-8 py-16">
        {/* Header */}
        <div className="mb-16">
          <button
            onClick={() => navigate("/config-admin")}
            className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors mb-12 group font-medium"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Admin
          </button>

          <div className="space-y-4">
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full">
              <Factory className="w-5 h-5 text-white" />
              <span className="text-sm font-semibold text-white uppercase tracking-wide">Factory Deploy</span>
            </div>
            <h1 className="text-6xl font-bold text-slate-900 tracking-tight leading-tight">
              World Contract
              <br />
              Deployment
            </h1>
            <p className="text-xl text-slate-600 max-w-2xl leading-relaxed">
              Configure and deploy your Dojo world contracts directly from the browser using the factory pattern
            </p>
          </div>
        </div>

        {/* Unified Configuration and Deployment */}
        {parsedManifest && (
          <div className="mb-12">
            <div className="relative overflow-hidden p-10 bg-white rounded-3xl shadow-xl shadow-indigo-500/10 border border-slate-200">
              <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-full blur-3xl" />
              <div className="relative space-y-8">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <h3 className="text-2xl font-bold text-slate-900">Ready to Deploy</h3>
                      <div className="flex items-center gap-2 px-3 py-1 bg-emerald-100 rounded-full">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                          Validated
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm text-slate-600">
                      <span className="font-medium">{parsedManifest.contracts.length} Contracts</span>
                      <span className="font-medium">{parsedManifest.models.length} Models</span>
                      <span className="font-medium">{parsedManifest.events.length} Events</span>
                    </div>
                  </div>
                </div>

                {/* Status Messages */}
                {tx.status === "success" && tx.hash && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        <span className="text-sm font-semibold text-emerald-900">Transaction Successful</span>
                      </div>
                      <a
                        href={`https://${currentChain === "sepolia" ? "sepolia." : ""}voyager.online/tx/${tx.hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        View on Explorer →
                      </a>
                    </div>
                  </div>
                )}
                {tx.status === "error" && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <XCircle className="w-5 h-5 text-red-600" />
                      <p className="text-sm font-medium text-red-900">{tx.error}</p>
                    </div>
                  </div>
                )}

                {/* Connection Status */}
                <div className="flex items-center justify-between p-6 bg-white rounded-2xl border border-slate-200">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Connected Wallet</span>
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${account?.address ? "bg-emerald-500" : "bg-slate-300"}`} />
                      <span className="text-sm font-mono text-slate-900">
                        {account?.address
                          ? `${account.address.slice(0, 6)}...${account.address.slice(-4)}`
                          : "Not connected"}
                      </span>
                    </div>
                  </div>
                  <div className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                      Network: {currentChain}
                    </span>
                  </div>
                </div>

                {/* Deploy Section - Always Visible */}
                <div className="space-y-6 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200 shadow-sm">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">World Name</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={worldName}
                          readOnly
                          placeholder="username-12345"
                          className="flex-1 px-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 font-mono cursor-default"
                        />
                        <button
                          onClick={handleGenerateWorldName}
                          className="p-3 bg-blue-100 hover:bg-blue-200 rounded-xl transition-colors group"
                          title="Generate new world name"
                        >
                          <RefreshCw className="w-5 h-5 text-blue-600 group-hover:rotate-180 transition-transform duration-500" />
                        </button>
                        <button
                          onClick={handleAddToQueue}
                          disabled={!worldName || storedWorldNames.includes(worldName)}
                          className="px-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
                        >
                          Queue
                        </button>
                      </div>
                      <p className="text-xs text-slate-500">
                        Generate a world name and add it to the queue to deploy later
                      </p>
                    </div>

                    {/* World Queue */}
                    {storedWorldNames.length > 0 && (
                      <div className="space-y-2">
                        <button
                          onClick={() => setShowStoredNames(!showStoredNames)}
                          className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors"
                        >
                          {showStoredNames ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          World Queue ({storedWorldNames.length})
                        </button>
                        {showStoredNames && (
                          <div className="pl-4 space-y-3">
                            {[...storedWorldNames].reverse().map((name, idx) => (
                              <div key={idx} className="space-y-2">
                                <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-slate-200 hover:border-blue-300 transition-colors">
                                  <span className="flex-1 text-xs font-mono text-slate-700">{name}</span>

                                  {/* Copy Button */}
                                  <button
                                    onClick={async () => {
                                      try {
                                        await navigator.clipboard.writeText(name);
                                      } catch (err) {
                                        console.error("Failed to copy world name", err);
                                      }
                                    }}
                                    className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded transition-colors"
                                    title="Copy world name"
                                    aria-label="Copy world name"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Remove Button */}
                                  <button
                                    onClick={() => handleRemoveFromQueue(name)}
                                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title="Remove from queue"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Deployment Status Badge */}
                                  {worldDeployedStatus[name] ? (
                                    <span className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded border border-emerald-200">
                                      <CheckCircle2 className="w-3 h-3" />
                                      Deployed
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 text-slate-500 text-xs font-semibold rounded border border-slate-200">
                                      Not Deployed
                                    </span>
                                  )}

                                  {/* Deploy Button - Only show if not deployed */}
                                  {!worldDeployedStatus[name] && (
                                    <button
                                      onClick={async () => {
                                        if (!account || !factoryAddress || !name) return;
                                        setTx({ status: "running" });
                                        try {
                                          const worldNameFelt = shortString.encodeShortString(name);
                                          const result = await account.execute({
                                            contractAddress: factoryAddress,
                                            entrypoint: "deploy",
                                            calldata: [worldNameFelt, version],
                                          });
                                          setTx({ status: "success", hash: result.transaction_hash });
                                          await account.waitForTransaction(result.transaction_hash);

                                          // Refresh deployment status after successful deploy
                                          // Refresh deployment status and cache address post-deploy
                                          const addr = await getWorldDeployedAddress(name);
                                          const isDeployed = !!addr;
                                          setWorldDeployedStatus((prev) => ({ ...prev, [name]: isDeployed }));
                                        } catch (err: any) {
                                          setTx({ status: "error", error: err.message });
                                        }
                                      }}
                                      disabled={!account || !factoryAddress || tx.status === "running"}
                                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-md transition-colors flex items-center gap-1"
                                    >
                                      {tx.status === "running" && getTxStatusIcon()}
                                      Deploy
                                    </button>
                                  )}

                                  {/* Indexer Status/Actions - Only show if deployed */}
                                  {worldDeployedStatus[name] && (
                                    <>
                                      {/* Step 2: Configure (can run before indexer) */}
                                      <button
                                        onClick={() => setWorldConfigOpen((prev) => ({ ...prev, [name]: !prev[name] }))}
                                        className="px-3 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-md border border-slate-200 hover:border-slate-300 transition-colors"
                                      >
                                        {worldConfigOpen[name] ? "Hide Config" : "Configure"}
                                      </button>

                                      {/* Step 3: Indexer */}
                                      {worldIndexerStatus[name] ? (
                                        <a
                                          href={`https://api.cartridge.gg/x/${name}/torii`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-md border border-emerald-200 hover:border-emerald-300 transition-colors"
                                        >
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                          Indexer On
                                        </a>
                                      ) : isWorldOnCooldown(name) ? (
                                        <span className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-500 text-xs font-semibold rounded-md border border-slate-200 cursor-not-allowed">
                                          Wait {Math.floor(getRemainingCooldown(name) / 60)}m{" "}
                                          {getRemainingCooldown(name) % 60}s
                                        </span>
                                      ) : (
                                        <button
                                          onClick={() => handleCreateIndexer(name)}
                                          className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-md border border-blue-200 hover:border-blue-300 transition-colors"
                                        >
                                          Create Indexer
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>

                                {/* No extra status panel; only small wait timer above */}

                                {/* Per-world Config Panel */}
                                {worldConfigOpen[name] && (
                                  <div className="ml-3 pl-3 py-4 border-l-2 border-slate-200">
                                      <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm space-y-3">
                                        <div className="flex items-center justify-between">
                                          <div>
                                            <p className="text-sm font-semibold text-slate-800">Configure World</p>
                                            <p className="text-xs text-slate-500">Runs full config using live manifest</p>
                                          </div>
                                        {worldConfigTx[name]?.status === "running" && (
                                          <span className="inline-flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2 py-1 rounded">
                                            <Loader2 className="w-3 h-3 animate-spin" /> Running
                                          </span>
                                        )}
                                        {worldConfigTx[name]?.status === "success" && (
                                          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded">
                                            <CheckCircle2 className="w-3 h-3" /> Done
                                          </span>
                                        )}
                                        {worldConfigTx[name]?.status === "error" && (
                                          <span className="inline-flex items-center gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 px-2 py-1 rounded">
                                            <XCircle className="w-3 h-3" /> Error
                                          </span>
                                        )}
                                      </div>

                                      {/* startMainAt override */}
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                          <label className="text-xs font-semibold text-slate-600">Game Start Time</label>
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
                                              const d = new Date(Date.now() + 8 * 3600 * 1000);
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
                                              const maxAllowed = now + 8 * 3600;
                                              if (selected < now) {
                                                setStartMainAtErrors((p) => ({
                                                  ...p,
                                                  [name]: "Start time cannot be in the past",
                                                }));
                                              } else if (selected > maxAllowed) {
                                                setStartMainAtErrors((p) => ({
                                                  ...p,
                                                  [name]: "Start time cannot be more than 8 hours ahead",
                                                }));
                                              } else {
                                                setStartMainAtErrors((p) => ({ ...p, [name]: "" }));
                                              }
                                              setStartMainAtOverrides((p) => ({ ...p, [name]: selected }));
                                            }}
                                            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-md"
                                          />
                                          <p className="text-[10px] text-slate-500">Optional. Max +8h from now.</p>
                                          {startMainAtErrors[name] && (
                                            <p className="text-[11px] text-red-600">{startMainAtErrors[name]}</p>
                                          )}
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={async () => {
                                            if (!account) return;
                                            setWorldConfigTx((p) => ({ ...p, [name]: { status: "running" } }));
                                            try {
                                              // 1) Build runtime profile, patch manifest, create provider for this world
                                              const profile = await buildWorldProfile(currentChain as Chain, name);
                                              const baseManifest = getGameManifest(currentChain as Chain);
                                              const patched = patchManifestWithFactory(
                                                baseManifest as any,
                                                profile.worldAddress,
                                                profile.contractsBySelector,
                                              );
                                              let localProvider: any = new EternumProvider(
                                                patched,
                                                env.VITE_PUBLIC_NODE_URL,
                                                env.VITE_PUBLIC_VRF_PROVIDER_ADDRESS,
                                              );

                                              // 2) Batch and run all config functions (same order as config-admin-page)
                                              await localProvider.beginBatch({ signer: account });

                                              // prepare optional override for startMainAt (clamped to +8h)
                                              const nowSec = Math.floor(Date.now() / 1000);
                                              const maxAllowed = nowSec + 8 * 3600;
                                              const sel = startMainAtOverrides[name];
                                              // default to start of next hour if not provided
                                              const nextHourDefault = (() => {
                                                const now = Date.now();
                                                const nextHourMs = Math.ceil(now / 3600000) * 3600000;
                                                return Math.floor(nextHourMs / 1000);
                                              })();
                                              const chosenStart = sel && sel > 0 ? sel : nextHourDefault;
                                              const selectedStart = Math.max(nowSec, Math.min(chosenStart, maxAllowed));

                                              const configForWorld = selectedStart
                                                ? ({
                                                    ...eternumConfig,
                                                    season: {
                                                      ...eternumConfig.season,
                                                      startMainAt: selectedStart,
                                                    },
                                                  } as any)
                                                : eternumConfig;

                                              const ctx = {
                                                account,
                                                provider: localProvider as any,
                                                config: configForWorld,
                                              } as any;

                                              await setWorldConfig(ctx);
                                              await setGameModeConfig(ctx);
                                              await setBlitzPreviousGame(ctx);
                                              await setVictoryPointsConfig(ctx);
                                              await setDiscoverableVillageSpawnResourcesConfig(ctx);
                                              await setBlitzRegistrationConfig(ctx);
                                              await setWonderBonusConfig(ctx);
                                              await setAgentConfig(ctx);
                                              await setVillageControllersConfig(ctx);
                                              await setTradeConfig(ctx);
                                              await setSeasonConfig(ctx);
                                              await setVRFConfig(ctx);
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
                                              await setResourceBridgeWtlConfig(ctx);

                                              const receipt = await localProvider.endBatch({ flush: true });
                                              setWorldConfigTx((p) => ({
                                                ...p,
                                                [name]: { status: "success", hash: receipt?.transaction_hash },
                                              }));
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
                                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md disabled:bg-slate-300 disabled:cursor-not-allowed"
                                          disabled={!account || worldConfigTx[name]?.status === "running" || !!startMainAtErrors[name]}
                                        >
                                          Set
                                        </button>

                                        {worldConfigTx[name]?.hash && (
                                          <a
                                            href={`https://sepolia.voyager.online/tx/${worldConfigTx[name]!.hash}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-blue-700 hover:underline ml-2"
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
                            ))}
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
              className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
            >
              {showDevConfig ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Are you a dev?
            </button>

            {showDevConfig && (
              <div className="space-y-8">
                {/* Configuration Section */}
                <div className="p-6 bg-slate-50 rounded-2xl border-2 border-slate-200">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Configuration</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                        Factory Address
                      </label>
                      <input
                        type="text"
                        value={factoryAddress}
                        disabled
                        className="w-full px-4 py-3 bg-slate-200 border-2 border-slate-300 rounded-xl text-slate-500 font-mono text-sm cursor-not-allowed"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Version</label>
                      <input
                        type="text"
                        value={version}
                        onChange={(e) => setVersion(e.target.value)}
                        className="w-full px-4 py-3 bg-white border-2 border-slate-200 hover:border-blue-300 focus:border-blue-500 rounded-xl text-slate-900 focus:outline-none transition-all"
                      />
                      {version !== DEFAULT_VERSION && (
                        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-amber-800">
                            <span className="font-semibold">Warning:</span> This needs to be updated in the code so new
                            deployers automatically use version {version}.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Namespace</label>
                      <input
                        type="text"
                        value={namespace}
                        disabled
                        className="w-full px-4 py-3 bg-slate-200 border-2 border-slate-300 rounded-xl text-slate-500 cursor-not-allowed"
                      />
                    </div>

                    <button
                      onClick={handleSetConfig}
                      disabled={!factoryAddress || !account || tx.status === "running"}
                      className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
                    >
                      {tx.status === "running" && getTxStatusIcon()}
                      <span>Set Configuration</span>
                    </button>
                  </div>
                </div>

                {/* Deployment Summary Section */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-2xl font-bold text-slate-900">Deployment Summary</h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowFullConfig((v) => !v)}
                        className="px-6 py-3 text-sm font-semibold text-slate-700 hover:text-white bg-slate-100 hover:bg-gradient-to-r hover:from-emerald-600 hover:to-teal-600 border-2 border-slate-200 hover:border-transparent rounded-2xl transition-all duration-200 uppercase tracking-wide shadow-sm hover:shadow-lg hover:shadow-emerald-500/20"
                      >
                        {showFullConfig ? "Hide" : "View"} Full Config
                      </button>
                      <button
                        onClick={() => setShowCairoOutput(!showCairoOutput)}
                        className="px-6 py-3 text-sm font-semibold text-slate-700 hover:text-white bg-slate-100 hover:bg-gradient-to-r hover:from-blue-600 hover:to-indigo-600 border-2 border-slate-200 hover:border-transparent rounded-2xl transition-all duration-200 uppercase tracking-wide shadow-sm hover:shadow-lg hover:shadow-blue-500/20"
                      >
                        {showCairoOutput ? "Hide" : "View"} Cairo Code
                      </button>
                    </div>
                  </div>

                  <div className="p-8 bg-white border-2 border-slate-200 rounded-3xl shadow-lg space-y-1">
                    <div className="flex items-center justify-between py-5 border-b-2 border-slate-100">
                      <span className="text-sm font-bold text-slate-600 uppercase tracking-wide">World Class Hash</span>
                      <span className="text-sm text-slate-900 font-mono bg-slate-50 px-4 py-2 rounded-lg border border-slate-200">
                        {parsedManifest.world.class_hash.slice(0, 20)}...
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-5 border-b-2 border-slate-100">
                      <span className="text-sm font-bold text-slate-600 uppercase tracking-wide">Namespace</span>
                      <span className="text-sm font-semibold text-slate-900 bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                        {namespace}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-5">
                      <span className="text-sm font-bold text-slate-600 uppercase tracking-wide">
                        Calldata Arguments
                      </span>
                      <span className="text-sm font-bold text-slate-900 font-mono bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-200">
                        {generatedCalldata.length}
                      </span>
                    </div>
                  </div>

                  {showCairoOutput && (
                    <div className="p-8 bg-slate-900 border-2 border-slate-700 rounded-3xl shadow-2xl">
                      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-700">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                          <Download className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">Generated Cairo Code</p>
                          <p className="text-xs text-slate-400">Factory configuration output</p>
                        </div>
                      </div>
                      <pre className="text-xs text-emerald-400 overflow-x-auto leading-relaxed font-mono">
                        {generateCairoOutput(parsedManifest, version, maxActions, defaultNamespaceWriterAll, namespace)}
                      </pre>
                    </div>
                  )}

                  {showFullConfig && (
                    <div className="p-8 bg-white border-2 border-slate-200 rounded-3xl shadow-lg">
                      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                          <Download className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">Full Configuration (read-only)</p>
                          <p className="text-xs text-slate-500">Effective config for current chain</p>
                        </div>
                      </div>
                      <pre className="text-xs text-slate-800 overflow-x-auto leading-relaxed font-mono whitespace-pre-wrap">
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
