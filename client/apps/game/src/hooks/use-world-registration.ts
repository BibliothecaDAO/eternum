/**
 * Hook to handle registration for a specific world from the world selector.
 * Supports full entry token flow: obtain token -> wait for confirmation -> register.
 * On non-mainnet environments, auto-tops up fee tokens from master account if needed.
 */
import { getFactorySqlBaseUrl } from "@/runtime/world";
import { resolveWorldContracts } from "@/runtime/world/factory-resolver";
import { normalizeSelector } from "@/runtime/world/normalize";
import { buildRegisterPolicies } from "@/hooks/context/policies";
import { refreshSessionPoliciesWithPolicies } from "@/hooks/context/session-policy-refresh";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { getRpcUrlForChain } from "@/ui/features/admin/constants";
import { ENTRY_TOKEN_LOCK_ID } from "@bibliothecadao/eternum";
import type { Chain } from "@contracts";
import { useAccount } from "@starknet-react/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { Account, CallData, RpcProvider, uint256, type Call } from "starknet";
import { env } from "../../env";
import { useUsername } from "./use-username";
import type { WorldConfigMeta } from "./use-world-availability";

// Known contract selector for blitz_realm_systems
const BLITZ_REALM_SYSTEMS_SELECTOR = "0x3414be5ba2c90784f15eb572e9222b5c83a6865ec0e475a57d7dc18af9b3742";

/**
 * Fetch ERC20 token balance using RPC call
 */
const fetchTokenBalance = async (
  rpcProvider: RpcProvider,
  tokenAddress: string,
  accountAddress: string,
): Promise<bigint> => {
  try {
    const result = await rpcProvider.callContract({
      contractAddress: tokenAddress,
      entrypoint: "balance_of",
      calldata: [accountAddress],
    });
    // Result is [low, high] for Uint256
    if (result && result.length >= 2) {
      const low = BigInt(result[0] ?? 0);
      const high = BigInt(result[1] ?? 0);
      return low + (high << 128n);
    }
    return 0n;
  } catch (error) {
    console.error("Failed to fetch token balance:", error);
    return 0n;
  }
};

/**
 * Create master account for auto top-up (non-mainnet only)
 */
const createMasterAccount = (rpcProvider: RpcProvider): Account | null => {
  try {
    const masterAddress = env.VITE_PUBLIC_MASTER_ADDRESS;
    const masterPrivateKey = env.VITE_PUBLIC_MASTER_PRIVATE_KEY;
    if (!masterAddress || !masterPrivateKey) return null;
    return new Account({
      provider: rpcProvider,
      address: masterAddress,
      signer: masterPrivateKey,
    });
  } catch {
    return null;
  }
};

export type RegistrationStage =
  | "idle"
  | "preparing"
  | "obtaining-token"
  | "waiting-for-token"
  | "registering"
  | "done"
  | "error";

interface UseWorldRegistrationProps {
  worldName: string;
  chain: Chain;
  config: WorldConfigMeta | null;
  isRegistered: boolean;
  enabled?: boolean;
}

interface UseWorldRegistrationReturn {
  /** Execute registration */
  register: () => Promise<void>;
  /** Current registration stage */
  registrationStage: RegistrationStage;
  /** Whether registration is in progress */
  isRegistering: boolean;
  /** Error message if registration failed */
  error: string | null;
  /** Whether entry token is required for this world */
  requiresEntryToken: boolean;
  /** Fee amount in wei */
  feeAmount: bigint;
  /** Whether registration is currently possible */
  canRegister: boolean;
  /** Whether fee balance is being checked */
  isCheckingFeeBalance: boolean;
  /** Whether wallet has enough fee token balance for registration */
  hasSufficientFeeBalance: boolean;
}

/**
 * Check if a player has an available entry token using RPC calls.
 * Returns the first available token ID or null if none found.
 */
const fetchAvailableEntryTokenId = async (
  rpcProvider: RpcProvider,
  entryTokenAddress: string,
  playerAddress: string,
): Promise<bigint | null> => {
  try {
    // Get ERC721 balance using balance_of(owner)
    const balanceResult = await rpcProvider.callContract({
      contractAddress: entryTokenAddress,
      entrypoint: "balance_of",
      calldata: [playerAddress],
    });

    // Balance is a Uint256 [low, high]
    if (!balanceResult || balanceResult.length < 2) return null;
    const balanceLow = BigInt(balanceResult[0] ?? 0);
    const balanceHigh = BigInt(balanceResult[1] ?? 0);
    const balance = balanceLow + (balanceHigh << 128n);

    if (balance === 0n) return null;

    // Get the first token ID using token_of_owner_by_index(owner, index)
    // Index is 0 for the first token, passed as Uint256
    const tokenResult = await rpcProvider.callContract({
      contractAddress: entryTokenAddress,
      entrypoint: "token_of_owner_by_index",
      calldata: [playerAddress, "0", "0"], // owner, index.low, index.high
    });

    // Token ID is a Uint256 [low, high]
    if (!tokenResult || tokenResult.length < 2) return null;
    const tokenIdLow = BigInt(tokenResult[0] ?? 0);
    const tokenIdHigh = BigInt(tokenResult[1] ?? 0);
    const tokenId = tokenIdLow + (tokenIdHigh << 128n);

    return tokenId;
  } catch (error) {
    console.error("Failed to fetch entry token:", error);
    return null;
  }
};

export const useWorldRegistration = ({
  worldName,
  chain,
  config,
  isRegistered,
  enabled = true,
}: UseWorldRegistrationProps): UseWorldRegistrationReturn => {
  const { account, address } = useAccount();
  const connector = useAccountStore((state) => state.connector);
  const { usernameFelt, isLoading: usernameLoading } = useUsername();

  const [registrationStage, setRegistrationStage] = useState<RegistrationStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isCheckingFeeBalance, setIsCheckingFeeBalance] = useState(false);
  const [hasSufficientFeeBalance, setHasSufficientFeeBalance] = useState(true);

  // Cache resolved contracts
  const contractsCacheRef = useRef<Record<string, string> | null>(null);

  const requiresEntryToken = Boolean(config?.entryTokenAddress && config.feeAmount > 0n);
  const feeAmount = config?.feeAmount ?? 0n;
  const devModeOn = config?.devModeOn ?? false;
  const requiresFeeBalanceForRegistration = chain === "mainnet";
  const needsFeeBalanceCheck = requiresFeeBalanceForRegistration && Boolean(config?.feeTokenAddress && feeAmount > 0n);

  // Check if registration is open
  const now = Date.now() / 1000;
  const registrationStartAt = config?.registrationStartAt ?? 0;
  const registrationEndAt = config?.registrationEndAt ?? 0;
  // Normal registration window check
  const isInRegistrationWindow =
    registrationStartAt > 0 &&
    registrationEndAt > registrationStartAt &&
    now >= registrationStartAt &&
    now < registrationEndAt;
  // In dev mode, allow registration even after the window closes (during ongoing game)
  const isRegistrationOpen = isInRegistrationWindow || (devModeOn && now >= registrationStartAt);

  const canRegister =
    enabled &&
    !isRegistered &&
    isRegistrationOpen &&
    !!account &&
    !!address &&
    !usernameLoading &&
    !!usernameFelt &&
    !isCheckingFeeBalance &&
    hasSufficientFeeBalance &&
    registrationStage === "idle";

  const isRegistering = registrationStage !== "idle" && registrationStage !== "done" && registrationStage !== "error";

  // Pre-check fee token balance so "Register" is disabled when the wallet can't pay.
  useEffect(() => {
    let cancelled = false;
    const feeTokenAddress = config?.feeTokenAddress;

    const resetAsAvailable = () => {
      setIsCheckingFeeBalance(false);
      setHasSufficientFeeBalance(true);
    };

    if (!enabled || !address || !needsFeeBalanceCheck || !feeTokenAddress) {
      resetAsAvailable();
      return () => {
        cancelled = true;
      };
    }

    const runBalanceCheck = async () => {
      setIsCheckingFeeBalance(true);
      try {
        const rpcUrl = getRpcUrlForChain(chain);
        const rpcProvider = new RpcProvider({ nodeUrl: rpcUrl });
        const currentBalance = await fetchTokenBalance(rpcProvider, feeTokenAddress, address);
        if (!cancelled) {
          setHasSufficientFeeBalance(currentBalance >= feeAmount);
        }
      } catch {
        if (!cancelled) {
          setHasSufficientFeeBalance(false);
        }
      } finally {
        if (!cancelled) {
          setIsCheckingFeeBalance(false);
        }
      }
    };

    void runBalanceCheck();

    return () => {
      cancelled = true;
    };
  }, [enabled, address, chain, config?.feeTokenAddress, feeAmount, needsFeeBalanceCheck]);

  /**
   * Resolve contract addresses from factory (cached)
   */
  const resolveContracts = useCallback(async (): Promise<Record<string, string>> => {
    if (contractsCacheRef.current) return contractsCacheRef.current;

    const factorySqlBaseUrl = getFactorySqlBaseUrl(chain);
    if (!factorySqlBaseUrl) throw new Error("Factory SQL not available for this chain");

    const contracts = await resolveWorldContracts(factorySqlBaseUrl, worldName);
    contractsCacheRef.current = contracts;
    return contracts;
  }, [chain, worldName]);

  /**
   * Get the blitz_realm_systems contract address
   */
  const getBlitzRealmSystemsAddress = useCallback(async (contracts: Record<string, string>): Promise<string> => {
    const normalizedSelector = normalizeSelector(BLITZ_REALM_SYSTEMS_SELECTOR);
    const address = contracts[normalizedSelector];
    if (!address) throw new Error("blitz_realm_systems contract not found for this world");
    return address;
  }, []);

  const ensureRegistrationSessionPolicies = useCallback(
    async (blitzRealmSystemsAddress: string): Promise<void> => {
      if (!connector) return;

      try {
        const registerPolicies = buildRegisterPolicies({
          blitzRealmSystemsAddress,
          feeTokenAddress: config?.feeTokenAddress,
          entryTokenAddress: config?.entryTokenAddress,
          vrfProviderAddress: env.VITE_PUBLIC_VRF_PROVIDER_ADDRESS,
        });

        await refreshSessionPoliciesWithPolicies(connector, registerPolicies, `blitz-actions:${chain}:${worldName}`);
      } catch (policyError) {
        console.warn("Failed to refresh registration session policies:", policyError);
      }
    },
    [connector, config?.feeTokenAddress, config?.entryTokenAddress, chain, worldName],
  );

  /**
   * Build calls to obtain entry token (approve fee + mint)
   */
  const buildObtainTokenCalls = useCallback(
    (blitzSystemsAddress: string): Call[] => {
      if (!config?.feeTokenAddress || !config.feeAmount) return [];

      const calls: Call[] = [];

      // Approve fee token spend
      if (config.feeAmount > 0n) {
        const amountUint256 = uint256.bnToUint256(config.feeAmount);
        calls.push({
          contractAddress: config.feeTokenAddress,
          entrypoint: "approve",
          calldata: CallData.compile([blitzSystemsAddress, amountUint256.low, amountUint256.high]),
        });
      }

      // Call obtain_entry_token
      calls.push({
        contractAddress: blitzSystemsAddress,
        entrypoint: "obtain_entry_token",
        calldata: [],
      });

      return calls;
    },
    [config],
  );

  /**
   * Build calls to register with token lock
   */
  const buildRegisterCalls = useCallback(
    (blitzSystemsAddress: string, tokenId: bigint): Call[] => {
      const calls: Call[] = [];

      // Lock entry token if required
      if (config?.entryTokenAddress && tokenId > 0n) {
        const tokenIdUint256 = uint256.bnToUint256(tokenId);
        calls.push({
          contractAddress: config.entryTokenAddress,
          entrypoint: "token_lock",
          calldata: CallData.compile([tokenIdUint256, ENTRY_TOKEN_LOCK_ID]),
        });
      }

      // Register
      calls.push({
        contractAddress: blitzSystemsAddress,
        entrypoint: "register",
        calldata: [usernameFelt, tokenId.toString(), "0"],
      });

      return calls;
    },
    [config, usernameFelt],
  );

  /**
   * Wait for entry token to appear on-chain
   */
  const waitForEntryToken = useCallback(
    async (rpcProvider: RpcProvider): Promise<bigint | null> => {
      if (!config?.entryTokenAddress || !address) {
        console.log("waitForEntryToken: Missing config.entryTokenAddress or address; aborting.", {
          hasEntryTokenAddress: !!config?.entryTokenAddress,
          address,
        });
        return null;
      }

      const maxAttempts = 30;
      const pollInterval = 2000;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        console.log(`waitForEntryToken [${attempt + 1}/${maxAttempts}]: Checking for entry token via RPC`, {
          entryTokenAddress: config.entryTokenAddress,
          playerAddress: address,
        });
        const tokenId = await fetchAvailableEntryTokenId(rpcProvider, config.entryTokenAddress, address);
        if (tokenId != null) {
          console.log("waitForEntryToken: Entry token found!", { tokenId });
          return tokenId;
        }
        console.log(`waitForEntryToken: Entry token not found, waiting ${pollInterval}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }

      console.log("waitForEntryToken: Entry token not found after max attempts.");
      return null;
    },
    [config, address],
  );

  /**
   * Execute full registration flow
   */
  const register = useCallback(async () => {
    if (!canRegister || !account) return;

    setError(null);
    setRegistrationStage("preparing");

    try {
      // Resolve contracts
      const contracts = await resolveContracts();
      const blitzSystemsAddress = await getBlitzRealmSystemsAddress(contracts);

      await ensureRegistrationSessionPolicies(blitzSystemsAddress);

      // Cast account to starknet Account for execute
      const starknetAccount = account as unknown as Account;

      if (requiresEntryToken && config?.entryTokenAddress && config?.feeTokenAddress) {
        // Create RPC provider for balance checks and entry token queries
        const rpcUrl = getRpcUrlForChain(chain);
        const rpcProvider = new RpcProvider({ nodeUrl: rpcUrl });

        // Check if we already have an entry token
        let tokenId = await fetchAvailableEntryTokenId(rpcProvider, config.entryTokenAddress, address!);

        if (!tokenId) {
          // Auto top-up on non-mainnet if fee balance is insufficient
          const isNonMainnet = chain !== "mainnet";
          if (isNonMainnet && feeAmount > 0n) {
            // Check current fee token balance
            const currentBalance = await fetchTokenBalance(rpcProvider, config.feeTokenAddress, address!);

            if (currentBalance < feeAmount) {
              // Transfer shortfall from master account
              const masterAccount = createMasterAccount(rpcProvider);
              if (masterAccount) {
                const shortfall = feeAmount - currentBalance;
                const amount = uint256.bnToUint256(shortfall);
                try {
                  await masterAccount.execute({
                    contractAddress: config.feeTokenAddress,
                    entrypoint: "transfer",
                    calldata: CallData.compile([address!, amount.low, amount.high]),
                  });
                  // Wait a bit for the transfer to be indexed
                  await new Promise((resolve) => setTimeout(resolve, 2000));
                } catch (topUpError) {
                  console.error("Auto top-up failed:", topUpError);
                  // Continue anyway - the user might have gotten tokens elsewhere
                }
              }
            }
          }

          // Step 1: Obtain entry token
          setRegistrationStage("obtaining-token");
          const obtainCalls = buildObtainTokenCalls(blitzSystemsAddress);
          await starknetAccount.execute(obtainCalls);

          // Step 2: Wait for token
          setRegistrationStage("waiting-for-token");
          tokenId = await waitForEntryToken(rpcProvider);
          console.log({ tokenId });
          if (!tokenId) {
            throw new Error("Failed to obtain entry token. Please try again.");
          }
        }

        // Step 3: Register with token
        setRegistrationStage("registering");
        const registerCalls = buildRegisterCalls(blitzSystemsAddress, tokenId);
        await starknetAccount.execute(registerCalls);
      } else {
        // No entry token required - direct registration
        setRegistrationStage("registering");
        const registerCalls = buildRegisterCalls(blitzSystemsAddress, 0n);
        await starknetAccount.execute(registerCalls);
      }

      setRegistrationStage("done");
    } catch (err) {
      console.error("Registration failed:", err);
      setError(err instanceof Error ? err.message : "Registration failed");
      setRegistrationStage("error");
    }
  }, [
    canRegister,
    account,
    address,
    config,
    worldName,
    chain,
    feeAmount,
    requiresEntryToken,
    resolveContracts,
    getBlitzRealmSystemsAddress,
    ensureRegistrationSessionPolicies,
    buildObtainTokenCalls,
    buildRegisterCalls,
    waitForEntryToken,
  ]);

  return {
    register,
    registrationStage,
    isRegistering,
    error,
    requiresEntryToken,
    feeAmount,
    canRegister,
    isCheckingFeeBalance,
    hasSufficientFeeBalance,
  };
};
