import { useCall } from "@starknet-react/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CairoCustomEnum, Call, CallData, uint256, type Abi, type RawArgsObject, type Uint256 } from "starknet";

import { useAccountStore } from "@/hooks/store/use-account-store";
import { getPmSqlApi } from "@/pm/hooks/queries";
import { getPredictionMarketConfig } from "@/pm/prediction-market-config";
import { normalizeHex } from "@/runtime/world/normalize";
import { LordsAbi } from "@bibliothecadao/eternum";

import {
  addressToUint256,
  parseLordsToBaseUnits,
  stringToHexData,
} from "@/ui/features/landing/sections/markets/market-utils";
import {
  buildToriiBaseUrl,
  fetchRegisteredPlayers,
  type MarketPlayer,
} from "@/ui/features/landing/sections/markets/use-market-servers";

// Import player odds configuration
import playerOddsConfig from "../config/player-odds.json";

// Constants
const MAX_SELECTED_PLAYERS = 5;
const MIN_SELECTED_PLAYERS = 1;
const MIN_FUNDING_LORDS = 100;
const DEFAULT_CREATOR_FEE = "10";
const DEFAULT_FEE_CURVE_RANGE = { start: 0, end: 2000 };
const DEFAULT_FEE_SHARE_CURVE_RANGE = { start: 10000, end: 0 };
const DEFAULT_ORACLE_EXTRA_PARAMS = ["0"];
const MARKET_CHECK_POLL_INTERVAL = 10_000; // 10 seconds

/**
 * Check if a market already exists for the given oracle address.
 * Returns true if market exists, false otherwise.
 */
const checkMarketExists = async (oracleAddress: string): Promise<boolean> => {
  try {
    const normalizedAddress = normalizeHex(oracleAddress);
    const api = getPmSqlApi();
    const market = await api.fetchMarketByPrizeAddress(normalizedAddress);
    return market !== null;
  } catch (e) {
    console.warn("[checkMarketExists] Error checking market:", e);
    // On error, return false to allow creation attempt (contract will reject if duplicate)
    return false;
  }
};

export interface UseQuickMarketCreateResult {
  // Market creation
  createMarket: () => Promise<void>;
  isCreating: boolean;
  canCreate: boolean;

  // All players from the game
  allPlayers: MarketPlayer[];
  playersLoaded: boolean;
  loadingPlayers: boolean;
  playerError: string | null;
  createError: string | null;

  // Player selection (when > 5 players)
  selectedPlayers: MarketPlayer[];
  setSelectedPlayers: (players: MarketPlayer[]) => void;
  togglePlayerSelection: (player: MarketPlayer) => void;
  requiresManualSelection: boolean;
  selectionComplete: boolean;
  minSelectedPlayers: number;
  maxSelectedPlayers: number;

  // Funding amount
  fundingAmount: string;
  setFundingAmount: (amount: string) => void;
  minFundingAmount: number;
  isFundingValid: boolean;

  // Balance info
  balance: bigint;
  requiredAmount: bigint;
  hasSufficientBalance: boolean;
  isBalanceLoading: boolean;

  // Odds/weights
  getPlayerOddsWeight: (player: MarketPlayer) => number;
  getPlayerChancePercent: (player: MarketPlayer) => number;
  playerWeights: Record<string, number>;
  setPlayerWeight: (playerAddress: string, weight: number) => void;
  noneWeight: number;
  setNoneWeight: (weight: number) => void;
  noneChancePercent: number;
  totalWeight: number;

  // Preconditions
  preconditions: {
    hasWallet: boolean;
    hasOracleAddress: boolean;
    hasPlayers: boolean;
    hasSufficientBalance: boolean;
    hasValidSelection: boolean;
    hasValidFunding: boolean;
    hasGameEndTime: boolean;
  };
}

// Helper to normalize uint256 balance from contract call
const normalizeUint256 = (value: unknown): bigint => {
  if (!value) return 0n;
  if (typeof value === "bigint") return value;
  if (Array.isArray(value)) {
    if (value.length === 2) {
      const [low, high] = value;
      return BigInt(low ?? 0) + (BigInt(high ?? 0) << 128n);
    }
    if (value.length === 1) return BigInt(value[0] ?? 0);
  }
  if (typeof value === "object" && value !== null) {
    const maybeUint = value as { low?: bigint | number | string; high?: bigint | number | string };
    if (maybeUint.low !== undefined && maybeUint.high !== undefined) {
      return BigInt(maybeUint.low) + (BigInt(maybeUint.high) << 128n);
    }
  }
  try {
    return BigInt(value as string);
  } catch {
    return 0n;
  }
};

/**
 * Get odds weight for a player by name lookup.
 * Falls back to defaultWeight (1) if player name not found.
 */
const getOddsWeightByName = (playerName: string | null): number => {
  if (!playerName) return playerOddsConfig.defaultWeight;

  const normalizedName = playerName.toLowerCase().trim();
  const players = playerOddsConfig.players as Record<string, number>;

  // Try exact match first
  if (players[normalizedName] !== undefined) {
    return players[normalizedName];
  }

  // Try case-insensitive lookup
  for (const [name, weight] of Object.entries(players)) {
    if (name.toLowerCase() === normalizedName) {
      return weight;
    }
  }

  return playerOddsConfig.defaultWeight;
};

const getOracleParams = (blitzOracleAddress: string) => [
  "0",
  BigInt(blitzOracleAddress),
  "0x0",
  "0x626c69747a5f6765745f77696e6e6572", // "blitz_get_winner" as felt
  "0x10",
  "0",
];

const buildOracleValueTypeEnum = () =>
  new CairoCustomEnum({
    u256: undefined,
    ContractAddress: {},
    felt252: undefined,
  });

const buildFeeCurveEnum = (range: { start: number; end: number }) =>
  new CairoCustomEnum({
    Linear: {
      start: range.start,
      end: range.end,
    },
  });

const buildVaultModelEnum = (initialRepartition: number[], fundingAmount: Uint256) =>
  new CairoCustomEnum({
    Vault: {
      initial_repartition: initialRepartition,
      funding_amount: fundingAmount,
      fee_curve: buildFeeCurveEnum(DEFAULT_FEE_CURVE_RANGE),
      fee_share_curve: buildFeeCurveEnum(DEFAULT_FEE_SHARE_CURVE_RANGE),
    },
    Amm: undefined,
  });

const buildCategoricalMarketTypeEnum = (outcomes: Uint256[]) =>
  new CairoCustomEnum({
    Binary: undefined,
    Categorical: new CairoCustomEnum({
      ValueEq: outcomes,
      Ranges: undefined,
    }),
  });

type VariantShape = { variant: Record<string, unknown> };

const isVariantShape = (value: unknown): value is VariantShape =>
  Boolean(value && typeof value === "object" && "variant" in (value as Record<string, unknown>));

const normalizeVariants = (value: unknown): unknown => {
  if (value instanceof CairoCustomEnum) return value;
  if (isVariantShape(value)) {
    const entries = Object.entries(value.variant).map(([variantKey, variantValue]) => [
      variantKey,
      normalizeVariants(variantValue),
    ]);
    return new CairoCustomEnum(Object.fromEntries(entries));
  }
  if (Array.isArray(value)) return value.map((item) => normalizeVariants(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, nestedValue]) => [key, normalizeVariants(nestedValue)]));
  }
  return value;
};

/**
 * Builds market parameters with custom weights.
 * Players are weighted based on custom weights or JSON config fallback.
 */
const buildQuickMarketParams = (
  worldName: string,
  players: MarketPlayer[],
  blitzOracleAddress: string,
  fundingLords: string,
  startAt: number,
  endAt: number,
  resolveAt: number,
  customWeights: Record<string, number>,
  noneWeight: number,
): RawArgsObject | null => {
  if (players.length === 0) return null;

  // Get weights - use custom weight if set, otherwise fall back to JSON config
  const weights = players.map((player) => {
    if (customWeights[player.address] !== undefined) {
      return customWeights[player.address];
    }
    return getOddsWeightByName(player.name);
  });

  const fundingBase = parseLordsToBaseUnits(fundingLords);
  if (fundingBase == null) return null;

  const fundingAmount = uint256.bnToUint256(fundingBase);
  const titleText = worldName.padEnd(10, " ");
  const titleData = stringToHexData(titleText);
  const questionData = stringToHexData("Who will be the winner?");

  const params = normalizeVariants({
    oracle: getPredictionMarketConfig().oracleAddress,
    collateral_token: getPredictionMarketConfig().collateralToken,
    model: buildVaultModelEnum([...weights, noneWeight], fundingAmount),
    oracle_params: getOracleParams(blitzOracleAddress),
    oracle_extra_params: DEFAULT_ORACLE_EXTRA_PARAMS,
    oracle_value_type: buildOracleValueTypeEnum(),
    typ: buildCategoricalMarketTypeEnum(players.map((player) => addressToUint256(player.address))),
    start_at: String(startAt),
    end_at: String(endAt),
    resolve_at: String(resolveAt),
    title: {
      data: [],
      pending_word: titleData.hex,
      pending_word_len: titleData.length,
    },
    question: {
      data: [],
      pending_word: questionData.hex,
      pending_word_len: questionData.length,
    },
    creator_fee: DEFAULT_CREATOR_FEE,
  }) as RawArgsObject;

  return params;
};

/**
 * Hook for quick market creation with enhanced features:
 *
 * - Player selection: If > 5 players, user must select exactly 5
 * - Odds from JSON: Player weights looked up by name
 * - User-selectable LORDS amount (min 1000)
 * - Timestamps: start=now, end=gameEndTime, resolve=gameEndTime+1min
 * - Pre-creation check: Verifies no market exists before attempting to create
 * - Periodic polling: Checks if a market was created by someone else
 */
export const useQuickMarketCreate = (
  worldName: string | null,
  oracleAddress: string | null,
  gameEndTime: number | null = null,
  onMarketFound?: () => void,
): UseQuickMarketCreateResult => {
  const account = useAccountStore((state) => state.account);
  const onMarketFoundRef = useRef(onMarketFound);
  onMarketFoundRef.current = onMarketFound;

  // State
  const [isCreating, setIsCreating] = useState(false);
  const [allPlayers, setAllPlayers] = useState<MarketPlayer[]>([]);
  const [playersLoaded, setPlayersLoaded] = useState(false);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  // Player selection state
  const [selectedPlayers, setSelectedPlayers] = useState<MarketPlayer[]>([]);

  // Custom weights per player (address -> weight)
  const [playerWeights, setPlayerWeights] = useState<Record<string, number>>({});

  // "None of the above" weight
  const [noneWeight, setNoneWeightState] = useState<number>(1);

  // Set weight for a specific player
  const setPlayerWeight = useCallback((playerAddress: string, weight: number) => {
    setPlayerWeights((prev) => ({
      ...prev,
      [playerAddress]: Math.max(1, Math.floor(weight)), // Ensure weight is at least 1
    }));
  }, []);

  // Set weight for "None of the above"
  const setNoneWeight = useCallback((weight: number) => {
    setNoneWeightState(Math.max(1, Math.floor(weight))); // Ensure weight is at least 1
  }, []);

  // Funding amount state (default to minimum)
  const [fundingAmount, setFundingAmount] = useState<string>(String(MIN_FUNDING_LORDS));

  // Get market address and collateral token from PM config
  const { marketAddress, collateralToken } = useMemo(() => {
    try {
      const config = getPredictionMarketConfig();
      return {
        marketAddress: config.marketsAddress || null,
        collateralToken: config.collateralToken || null,
      };
    } catch {
      return { marketAddress: null, collateralToken: null };
    }
  }, []);

  // Check if manual selection is required (> 5 players)
  const requiresManualSelection = allPlayers.length > MAX_SELECTED_PLAYERS;

  // Selection is complete when we have 1-5 players selected
  const selectionComplete =
    selectedPlayers.length >= MIN_SELECTED_PLAYERS && selectedPlayers.length <= MAX_SELECTED_PLAYERS;

  // Validate funding amount
  const isFundingValid = useMemo(() => {
    const amount = parseFloat(fundingAmount);
    return !isNaN(amount) && amount >= MIN_FUNDING_LORDS;
  }, [fundingAmount]);

  // Calculate required amount based on user input
  const requiredAmount = useMemo(() => {
    const parsed = parseLordsToBaseUnits(fundingAmount);
    return parsed ?? 0n;
  }, [fundingAmount]);

  // Fetch user's LORDS balance
  const balanceCall = useCall({
    abi: LordsAbi as Abi,
    functionName: "balance_of",
    address: (collateralToken ?? "0x0") as `0x${string}`,
    args: [(account?.address as `0x${string}`) ?? "0x0"],
    watch: true,
    refetchInterval: 10_000,
    enabled: Boolean(account?.address && collateralToken),
  });

  const balance = useMemo(() => normalizeUint256(balanceCall.data), [balanceCall.data]);
  const isBalanceLoading = balanceCall.isLoading && Boolean(collateralToken);
  const hasSufficientBalance = balance >= requiredAmount;

  // Load players when world name is available
  useEffect(() => {
    if (!worldName) {
      setAllPlayers([]);
      setSelectedPlayers([]);
      setPlayersLoaded(false);
      return;
    }

    const loadPlayers = async () => {
      setLoadingPlayers(true);
      setPlayerError(null);

      try {
        const toriiBaseUrl = buildToriiBaseUrl(worldName);
        const fetchedPlayers = await fetchRegisteredPlayers(toriiBaseUrl);
        setAllPlayers(fetchedPlayers);
        setPlayersLoaded(true);

        // Auto-select all players if <= 5
        if (fetchedPlayers.length <= MAX_SELECTED_PLAYERS) {
          setSelectedPlayers(fetchedPlayers);
        } else {
          // Reset selection when players change and manual selection needed
          setSelectedPlayers([]);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to load players";
        setPlayerError(message);
        setAllPlayers([]);
        setSelectedPlayers([]);
      } finally {
        setLoadingPlayers(false);
      }
    };

    loadPlayers();
  }, [worldName]);

  // Periodic polling to detect if market was created by someone else
  useEffect(() => {
    if (!oracleAddress || isCreating) return;

    const checkForExistingMarket = async () => {
      const exists = await checkMarketExists(oracleAddress);
      if (exists) {
        toast.info("A market was just created for this game!");
        onMarketFoundRef.current?.();
      }
    };

    // Initial check after a short delay (give time for initial load)
    const initialTimeout = setTimeout(checkForExistingMarket, 2000);

    // Periodic polling
    const interval = setInterval(checkForExistingMarket, MARKET_CHECK_POLL_INTERVAL);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [oracleAddress, isCreating]);

  // Toggle player selection
  const togglePlayerSelection = useCallback(
    (player: MarketPlayer) => {
      setSelectedPlayers((current) => {
        const isSelected = current.some((p) => p.address === player.address);

        if (isSelected) {
          // Remove player
          return current.filter((p) => p.address !== player.address);
        } else {
          // Add player (if under limit)
          if (current.length >= MAX_SELECTED_PLAYERS) {
            toast.error(`Maximum ${MAX_SELECTED_PLAYERS} players can be selected`);
            return current;
          }
          return [...current, player];
        }
      });
    },
    [setSelectedPlayers],
  );

  // Get odds weight for a player (custom weight takes priority over JSON config)
  // Returns 0 for unselected players
  const getPlayerOddsWeight = useCallback(
    (player: MarketPlayer) => {
      const isSelected = selectedPlayers.some((p) => p.address === player.address);
      if (!isSelected) return 0;

      // Check custom weight first
      if (playerWeights[player.address] !== undefined) {
        return playerWeights[player.address];
      }
      // Fall back to JSON config
      return getOddsWeightByName(player.name);
    },
    [playerWeights, selectedPlayers],
  );

  // Calculate total weight of all selected players + "None"
  const totalWeight = useMemo(() => {
    const playersWeight = selectedPlayers.reduce((sum, player) => {
      if (playerWeights[player.address] !== undefined) {
        return sum + playerWeights[player.address];
      }
      return sum + getOddsWeightByName(player.name);
    }, 0);
    return playersWeight + noneWeight;
  }, [selectedPlayers, playerWeights, noneWeight]);

  // Get % chance for a player (based on weight / totalWeight)
  const getPlayerChancePercent = useCallback(
    (player: MarketPlayer) => {
      const isSelected = selectedPlayers.some((p) => p.address === player.address);
      if (!isSelected || totalWeight === 0) return 0;

      const weight = playerWeights[player.address] ?? getOddsWeightByName(player.name);
      return (weight / totalWeight) * 100;
    },
    [selectedPlayers, playerWeights, totalWeight],
  );

  // Get % chance for "None of the above"
  const noneChancePercent = useMemo(() => {
    if (totalWeight === 0) return 0;
    return (noneWeight / totalWeight) * 100;
  }, [noneWeight, totalWeight]);

  // Preconditions
  const preconditions = useMemo(
    () => ({
      hasWallet: Boolean(account),
      hasOracleAddress: Boolean(oracleAddress),
      hasPlayers: allPlayers.length > 0,
      hasSufficientBalance,
      hasValidSelection: selectionComplete,
      hasValidFunding: isFundingValid,
      hasGameEndTime: Boolean(gameEndTime && gameEndTime > Math.floor(Date.now() / 1000)),
    }),
    [account, oracleAddress, allPlayers.length, hasSufficientBalance, selectionComplete, isFundingValid, gameEndTime],
  );

  const canCreate = useMemo(() => {
    return (
      preconditions.hasWallet &&
      preconditions.hasOracleAddress &&
      preconditions.hasPlayers &&
      preconditions.hasSufficientBalance &&
      preconditions.hasValidSelection &&
      preconditions.hasValidFunding &&
      preconditions.hasGameEndTime &&
      Boolean(marketAddress) &&
      !isCreating &&
      !loadingPlayers &&
      !isBalanceLoading
    );
  }, [preconditions, marketAddress, isCreating, loadingPlayers, isBalanceLoading]);

  const createMarket = useCallback(async () => {
    if (!canCreate || !account || !oracleAddress || !worldName || !marketAddress || !gameEndTime) {
      return;
    }

    // Clear previous error
    setCreateError(null);
    setIsCreating(true);

    // PRE-CREATION CHECK: Verify no market exists before attempting to create
    // This prevents race conditions where two users click create at the same time
    try {
      const marketAlreadyExists = await checkMarketExists(oracleAddress);
      if (marketAlreadyExists) {
        const errorMsg = "A market already exists for this game. Refreshing...";
        setCreateError(errorMsg);
        toast.error(errorMsg);
        setIsCreating(false);
        // Notify parent to refresh and show existing market
        onMarketFoundRef.current?.();
        return;
      }
    } catch (e) {
      // If check fails, proceed anyway - the contract will reject duplicates
      console.warn("[createMarket] Pre-creation check failed, proceeding:", e);
    }

    // Calculate timestamps based on requirements:
    // - Start: now
    // - End: game end time
    // - Resolve: 1 minute after game end
    const nowSec = Math.floor(Date.now() / 1000);
    const startAt = nowSec;
    const endAt = gameEndTime;
    const resolveAt = gameEndTime + 60; // 1 minute after game end

    const params = buildQuickMarketParams(
      worldName,
      selectedPlayers,
      oracleAddress,
      fundingAmount,
      startAt,
      endAt,
      resolveAt,
      playerWeights,
      noneWeight,
    );

    if (!params) {
      const errorMsg = "Failed to build market parameters";
      setCreateError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    const fundingBase = parseLordsToBaseUnits(fundingAmount);
    if (fundingBase == null) {
      const errorMsg = "Invalid funding amount";
      setCreateError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    // Build approval call
    const approveCall: Call = {
      contractAddress: getPredictionMarketConfig().collateralToken,
      entrypoint: "approve",
      calldata: [marketAddress, uint256.bnToUint256(fundingBase)],
    };

    // Build market creation call
    const createMarketCall: Call = {
      contractAddress: marketAddress,
      entrypoint: "create_market",
      calldata: CallData.compile([params]),
    };

    try {
      // Estimate fee first to catch errors early
      await account.estimateInvokeFee([approveCall, createMarketCall], {
        blockIdentifier: "pre_confirmed",
      });

      // Execute the transaction
      const result = await account.execute([approveCall, createMarketCall]);

      // Wait for confirmation if the account supports it
      if ("waitForTransaction" in account && typeof account.waitForTransaction === "function") {
        await account.waitForTransaction(result.transaction_hash);
      }

      toast.success(`Prediction market created for ${worldName}!`);
    } catch (e) {
      console.error("[useQuickMarketCreate] Error:", e);
      const message = e instanceof Error ? e.message : "Failed to create market";
      setCreateError(message);
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  }, [
    canCreate,
    account,
    oracleAddress,
    worldName,
    marketAddress,
    selectedPlayers,
    fundingAmount,
    gameEndTime,
    playerWeights,
    noneWeight,
  ]);

  return useMemo(
    () => ({
      createMarket,
      isCreating,
      canCreate,
      allPlayers,
      playersLoaded,
      loadingPlayers,
      playerError,
      createError,
      selectedPlayers,
      setSelectedPlayers,
      togglePlayerSelection,
      requiresManualSelection,
      selectionComplete,
      minSelectedPlayers: MIN_SELECTED_PLAYERS,
      maxSelectedPlayers: MAX_SELECTED_PLAYERS,
      fundingAmount,
      setFundingAmount,
      minFundingAmount: MIN_FUNDING_LORDS,
      isFundingValid,
      balance,
      requiredAmount,
      hasSufficientBalance,
      isBalanceLoading,
      getPlayerOddsWeight,
      getPlayerChancePercent,
      playerWeights,
      setPlayerWeight,
      noneWeight,
      setNoneWeight,
      noneChancePercent,
      totalWeight,
      preconditions,
    }),
    [
      createMarket,
      isCreating,
      canCreate,
      allPlayers,
      playersLoaded,
      loadingPlayers,
      playerError,
      createError,
      selectedPlayers,
      setSelectedPlayers,
      togglePlayerSelection,
      requiresManualSelection,
      selectionComplete,
      fundingAmount,
      setFundingAmount,
      isFundingValid,
      balance,
      requiredAmount,
      hasSufficientBalance,
      isBalanceLoading,
      getPlayerOddsWeight,
      getPlayerChancePercent,
      playerWeights,
      setPlayerWeight,
      noneWeight,
      setNoneWeight,
      noneChancePercent,
      totalWeight,
      preconditions,
    ],
  );
};

export type { MarketPlayer, UseQuickMarketCreateResult as UseQuickMarketCreateReturn };
