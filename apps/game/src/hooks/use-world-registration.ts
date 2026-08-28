/**
 * Hook to handle world entry from the world selector.
 * Blitz worlds now enter through a single `settle` action.
 * Appchain tops up its fee token from the configured faucet when needed.
 */
import { getCachedRpcProvider } from "@/utils/cached-rpc-provider";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { resolvePlayerNameFelt } from "@/services/identity/player-name";
import { namespaceForChain } from "@/dojo/game-scope";
import { executeObservedClientTransaction } from "@/observability/observed-client-transaction";
import { normalizeSelector } from "@/runtime/world/normalize";
import { resolveWorldIdForGame } from "@/runtime/world/game-registry";
import { getDefaultWorld, getWorldById } from "@/runtime/world/world-directory";
import { buildBlitzSettleCalls } from "@/services/blitz/blitz-settlement-calls";
import { getRpcUrlForChain } from "@/runtime/chain-rpc";
import { createAppchainFaucetAccount } from "./appchain-faucet-account";
import { getGameManifest } from "@contracts";
import type { GameChain as Chain } from "@realms-world/chain";
import { getContractByName } from "@dojoengine/core";
import { useCallback, useMemo, useRef, useState } from "react";
import { Account, CallData, RpcProvider, uint256 } from "starknet";
import { env } from "../../env";
import { isRegistrationCapacityReached, resolveEffectiveRegistrationCountMax } from "./registration-capacity";
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
}

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

  if (chain !== "appchain") {
    throw new Error("Automatic fee-token top-up is restricted to the appchain.");
  }
  const masterAccount = createAppchainFaucetAccount(rpcProvider, {
    address: env.VITE_PUBLIC_MASTER_ADDRESS,
    privateKey: env.VITE_PUBLIC_MASTER_PRIVATE_KEY,
  });

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
  });

  const confirmedBalance = await fetchTokenBalance(rpcProvider, feeTokenAddress, accountAddress);
  if (confirmedBalance < feeAmount) {
    throw new Error("Fee-token top-up was submitted but the balance did not update.");
  }
};

export const useWorldRegistration = ({
  worldName,
  chain,
  config,
  isRegistered,
  enabled = true,
}: UseWorldRegistrationProps): UseWorldRegistrationReturn => {
  const account = useAccountStore((state) => state.account);
  const accountName = useAccountStore((state) => state.accountName);
  const address = account?.address;
  const usernameFelt = useMemo(
    () => (address ? resolvePlayerNameFelt(address, accountName) : null),
    [accountName, address],
  );

  const [entryStage, setEntryStage] = useState<EntryStage>("idle");
  const [error, setError] = useState<string | null>(null);

  // Cache resolved contracts
  const contractsCacheRef = useRef<Record<string, string> | null>(null);
  const systemManifest = useMemo(() => getGameManifest(chain), [chain]);

  const feeAmount = config?.feeAmount ?? 0n;
  const devModeOn = config?.devModeOn ?? false;
  const registrationCount = config?.registrationCount ?? 0;
  const registrationCountMax = resolveEffectiveRegistrationCountMax(config);
  const isRegistrationFull = isRegistrationCapacityReached(registrationCount, registrationCountMax);

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
    !!usernameFelt &&
    !isRegistrationFull &&
    // Appchain settle needs the chosen game's id as its first argument.
    (chain !== "appchain" || Boolean(config?.gameId)) &&
    canAttemptSettle;

  const isSettling = entryStage !== "idle" && entryStage !== "done" && entryStage !== "error";

  /**
   * Resolve contract addresses: the appchain worlds ship their contract map
   * in the committed manifest (world directory); legacy chains resolve from
   * the factory (dormant path, kept until the W7 excision).
   */
  const resolveContracts = useCallback(async (): Promise<Record<string, string>> => {
    if (contractsCacheRef.current) return contractsCacheRef.current;

    const worldId = await resolveWorldIdForGame(worldName);
    const contracts = (getWorldById(worldId) ?? getDefaultWorld()).contractsBySelector;
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
    (blitzSystemsAddress: string) => {
      if (!address || !usernameFelt) {
        throw new Error("Gameplay account is not ready for settlement.");
      }
      return buildBlitzSettleCalls({
        blitzSystemsAddress,
        signerAddress: address,
        usernameFelt,
        // Settle targets the chosen game explicitly (meta carries its id).
        gameId: config?.gameId,
        vrfProviderAddress: env.VITE_PUBLIC_VRF_PROVIDER_ADDRESS,
        entryTokenAddress: config?.entryTokenAddress,
        feeTokenAddress: config?.feeTokenAddress,
        feeAmount: config?.feeAmount,
      });
    },
    [address, config, usernameFelt],
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
        if (chain === "appchain" && feeAmount > 0n && config?.feeTokenAddress) {
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
  };
};
