/**
 * Hook to handle world entry from the world selector.
 * Blitz worlds now enter through a single `settle` action.
 * On non-mainnet environments, auto-tops up fee tokens from master account if needed.
 */
import { getCachedRpcProvider } from "@/utils/cached-rpc-provider";
import { namespaceForChain } from "@/dojo/game-scope";
import { executeObservedClientTransaction } from "@/observability/observed-client-transaction";
import { getFactorySqlBaseUrl } from "@/runtime/world";
import { resolveWorldContracts } from "@/runtime/world/factory-resolver";
import { normalizeSelector } from "@/runtime/world/normalize";
import { resolveAppchainWorldIdForGame } from "@/runtime/world/game-registry";
import { getDefaultWorld, getWorldById } from "@/runtime/world/world-directory";
import { buildBlitzSettleCalls } from "@/services/blitz/blitz-settlement-calls";
import { getRpcUrlForChain } from "@/runtime/chain-rpc";
import { waitForTransactionConfirmation } from "@/ui/utils/transactions";
import { getGameManifest, type Chain } from "@contracts";
import { useAccount } from "@starknet-react/core";
import { getContractByName } from "@dojoengine/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Account, CallData, RpcProvider, uint256 } from "starknet";
import { env } from "../../env";
import { isRegistrationCapacityReached, resolveEffectiveRegistrationCountMax } from "./registration-capacity";
import { useUsername } from "./use-username";
import type { WorldConfigMeta } from "./use-world-availability";

interface SeasonRegistrationParams {
  realmId?: number;
  ownerAddress?: string;
  frontendAddress?: string;
  side?: number;
  layer?: number;
  point?: number;
}

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

export type EntryStage = "idle" | "preparing" | "settling" | "done" | "error";

interface UseWorldRegistrationProps {
  worldName: string;
  chain: Chain;
  config: WorldConfigMeta | null;
  isRegistered: boolean;
  enabled?: boolean;
}

interface UseWorldRegistrationReturn {
  /** Execute the world entry flow */
  settle: (params?: SeasonRegistrationParams) => Promise<void>;
  /** Current entry stage */
  entryStage: EntryStage;
  /** Whether world entry is in progress */
  isSettling: boolean;
  /** Error message if world entry failed */
  error: string | null;
  /** Fee amount in wei */
  feeAmount: bigint;
  /** Whether world entry is currently possible */
  canSettle: boolean;
  /** Whether registration capacity has been reached */
  isRegistrationFull: boolean;
  /** Whether fee balance is being checked */
  isCheckingFeeBalance: boolean;
  /** Whether wallet has enough fee token balance for settlement */
  hasSufficientFeeBalance: boolean;
}

const waitForWorldEntryTransactionConfirmation = async ({
  txHash,
  chain,
  label,
  account,
}: {
  txHash: string;
  chain: Chain;
  label: string;
  account: Account;
}) => {
  const provider = getCachedRpcProvider(getRpcUrlForChain(chain));
  await waitForTransactionConfirmation({
    txHash,
    account: account as unknown as { waitForTransaction?: (txHash: string) => Promise<unknown> },
    label,
    provider: provider as unknown as { waitForTransactionWithCheck?: (txHash: string) => Promise<unknown> },
  });
};

const ensureFeeTokenBalance = async ({
  accountAddress,
  chain,
  feeAmount,
  feeTokenAddress,
  worldName,
}: {
  accountAddress: string;
  chain: Chain;
  feeAmount: bigint;
  feeTokenAddress: string;
  worldName: string;
}): Promise<void> => {
  const rpcProvider = getCachedRpcProvider(getRpcUrlForChain(chain));
  const currentBalance = await fetchTokenBalance(rpcProvider, feeTokenAddress, accountAddress);
  if (currentBalance >= feeAmount) return;

  const masterAccount = createMasterAccount(rpcProvider);
  if (!masterAccount) {
    throw new Error("Fee token balance is insufficient and no development top-up account is configured.");
  }

  const shortfall = feeAmount - currentBalance;
  const amount = uint256.bnToUint256(shortfall);
  await executeObservedClientTransaction({
    account: masterAccount,
    calls: {
      contractAddress: feeTokenAddress,
      entrypoint: "transfer",
      calldata: CallData.compile([accountAddress, amount.low, amount.high]),
    },
    surface: "registration",
    operation: "fee_token.transfer_top_up",
    chain,
    worldName,
    confirm: async (txHash, observedAccount) => {
      await waitForWorldEntryTransactionConfirmation({
        txHash,
        chain,
        label: "fee_token.transfer_top_up",
        account: observedAccount as Account,
      });
    },
  });

  const confirmedBalance = await fetchTokenBalance(rpcProvider, feeTokenAddress, accountAddress);
  if (confirmedBalance < feeAmount) {
    throw new Error("Fee token top-up confirmed, but the required balance is not available.");
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
  const { usernameFelt, isLoading: usernameLoading } = useUsername();

  const [entryStage, setEntryStage] = useState<EntryStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isCheckingFeeBalance, setIsCheckingFeeBalance] = useState(false);
  const [hasSufficientFeeBalance, setHasSufficientFeeBalance] = useState(true);

  // Cache resolved contracts
  const contractsCacheRef = useRef<Record<string, string> | null>(null);
  const systemManifest = useMemo(() => getGameManifest(chain), [chain]);

  const feeAmount = config?.feeAmount ?? 0n;
  const devModeOn = config?.devModeOn ?? false;
  const registrationCount = config?.registrationCount ?? 0;
  const registrationCountMax = resolveEffectiveRegistrationCountMax(config);
  const isRegistrationFull = isRegistrationCapacityReached(registrationCount, registrationCountMax);
  const requiresFeeBalanceForSettlement = chain === "mainnet";
  const needsSettlementFeeBalanceCheck =
    requiresFeeBalanceForSettlement && Boolean(config?.feeTokenAddress && feeAmount > 0n);

  // Check if blitz settlement is open.
  const now = Date.now() / 1000;
  const registrationStartAt = config?.registrationStartAt ?? 0;
  const registrationEndAt = config?.registrationEndAt ?? 0;
  const isInRegistrationWindow =
    registrationStartAt > 0 &&
    registrationEndAt > registrationStartAt &&
    now >= registrationStartAt &&
    now < registrationEndAt;
  const isSettlementWindowOpen = isInRegistrationWindow || (devModeOn && now >= registrationStartAt);
  const canAttemptSettle = entryStage === "idle" || entryStage === "error";

  const canSettle =
    enabled &&
    !isRegistered &&
    isSettlementWindowOpen &&
    !!account &&
    !!address &&
    !usernameLoading &&
    !!usernameFelt &&
    !isCheckingFeeBalance &&
    hasSufficientFeeBalance &&
    !isRegistrationFull &&
    // Appchain settle needs the chosen game's id as its first argument.
    (chain !== "appchain" || Boolean(config?.gameId)) &&
    canAttemptSettle;

  const isSettling = entryStage !== "idle" && entryStage !== "done" && entryStage !== "error";

  // Pre-check fee token balance so entry stays disabled when the wallet can't pay.
  useEffect(() => {
    let cancelled = false;
    const feeTokenAddress = config?.feeTokenAddress;

    const resetAsAvailable = () => {
      setIsCheckingFeeBalance(false);
      setHasSufficientFeeBalance(true);
    };

    if (!enabled || !address || !needsSettlementFeeBalanceCheck || !feeTokenAddress) {
      resetAsAvailable();
      return () => {
        cancelled = true;
      };
    }

    const runBalanceCheck = async () => {
      setIsCheckingFeeBalance(true);
      try {
        const rpcUrl = getRpcUrlForChain(chain);
        const rpcProvider = getCachedRpcProvider(rpcUrl);
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
  }, [enabled, address, chain, config?.feeTokenAddress, feeAmount, needsSettlementFeeBalanceCheck]);

  /**
   * Resolve contract addresses: the appchain worlds ship their contract map
   * in the committed manifest (world directory); legacy chains resolve from
   * the factory (dormant path, kept until the W7 excision).
   */
  const resolveContracts = useCallback(async (): Promise<Record<string, string>> => {
    if (contractsCacheRef.current) return contractsCacheRef.current;

    if (chain === "appchain") {
      const worldId = await resolveAppchainWorldIdForGame(worldName);
      const contracts = (getWorldById(worldId) ?? getDefaultWorld()).contractsBySelector;
      contractsCacheRef.current = contracts;
      return contracts;
    }

    const factorySqlBaseUrl = getFactorySqlBaseUrl(chain);
    if (!factorySqlBaseUrl) throw new Error("Factory SQL not available for this chain");

    const contracts = await resolveWorldContracts(factorySqlBaseUrl, worldName);
    contractsCacheRef.current = contracts;
    return contracts;
  }, [chain, worldName]);

  const getWorldSystemAddress = useCallback(
    (contracts: Record<string, string>, systemName: string): string => {
      const contract = getContractByName(systemManifest, namespaceForChain(chain), systemName) as {
        selector?: string;
      };
      const selector = contract.selector ? normalizeSelector(contract.selector) : null;
      if (!selector) {
        throw new Error(`${systemName} selector not found in manifest`);
      }

      const address = contracts[selector];
      if (!address) {
        throw new Error(`${systemName} contract not found for this world`);
      }

      return address;
    },
    [systemManifest],
  );

  /**
   * Build calls to settle directly into a blitz world.
   */
  const buildSettleCalls = useCallback(
    (blitzSystemsAddress: string) =>
      buildBlitzSettleCalls({
        blitzSystemsAddress,
        signerAddress: address!,
        usernameFelt,
        // Settle targets the chosen game explicitly (meta carries its id).
        gameId: config?.gameId,
        vrfProviderAddress: env.VITE_PUBLIC_VRF_PROVIDER_ADDRESS,
        entryTokenAddress: config?.entryTokenAddress,
        feeTokenAddress: config?.feeTokenAddress,
        feeAmount: config?.feeAmount,
      }),
    [config, usernameFelt],
  );

  /**
   * Execute the world entry flow
   */
  const settle = useCallback(
    async (params?: SeasonRegistrationParams) => {
      if (!canSettle || !account) return;

      setError(null);
      setEntryStage("preparing");

      try {
        // Resolve contracts
        const contracts = await resolveContracts();

        // Cast account to starknet Account for execute
        const starknetAccount = account as unknown as Account;

        // Eternum seasons settle exclusively through the entry modal's planner
        // path (placement + realm id are real choices there). A quick-settle
        // with placeholder placement would collide on the shared world.
        if (config?.mode === "eternum") {
          throw new Error("Eternum seasons settle through the entry modal.");
        }

        const blitzSystemsAddress = getWorldSystemAddress(contracts, "blitz_realm_systems");
        const isNonMainnet = chain !== "mainnet";
        if (isNonMainnet && feeAmount > 0n && config?.feeTokenAddress) {
          await ensureFeeTokenBalance({
            accountAddress: address!,
            chain,
            feeAmount,
            feeTokenAddress: config.feeTokenAddress,
            worldName,
          });
        }

        setEntryStage("settling");
        const settleCalls = buildSettleCalls(blitzSystemsAddress);
        await executeObservedClientTransaction({
          account: starknetAccount,
          calls: settleCalls,
          surface: "registration",
          operation: "blitz_realm_systems.settle",
          chain,
          worldName,
          confirm: async (txHash, observedAccount) => {
            await waitForWorldEntryTransactionConfirmation({
              txHash,
              chain,
              label: "blitz_realm_systems.settle",
              account: observedAccount as Account,
            });
          },
        });

        setEntryStage("done");
      } catch (err) {
        console.error("Entry settlement failed:", err);
        setError(err instanceof Error ? err.message : "Settlement failed");
        setEntryStage("error");
      }
    },
    [
      canSettle,
      account,
      address,
      config,
      worldName,
      chain,
      feeAmount,
      resolveContracts,
      getWorldSystemAddress,
      buildSettleCalls,
    ],
  );

  return {
    settle,
    entryStage,
    isSettling,
    error,
    feeAmount,
    canSettle,
    isRegistrationFull,
    isCheckingFeeBalance,
    hasSufficientFeeBalance,
  };
};
