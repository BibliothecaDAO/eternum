/**
 * Wallet section for the profile page.
 * Fetches and displays token balances from the connected wallet.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount } from "@starknet-react/core";
import { RpcProvider, uint256, hash } from "starknet";
import { Chain, getSeasonAddresses } from "@contracts";
import { env } from "../../../../../env";
import { displayAddress } from "@/ui/utils/utils";

// ERC20 balanceOf selector
const BALANCE_OF_SELECTOR = hash.getSelectorFromName("balanceOf");

// Token configs by chain
interface TokenConfig {
  symbol: string;
  address: string;
  decimals: number;
}

const getTokensForChain = (chain: Chain): TokenConfig[] => {
  const addresses = getSeasonAddresses(chain);
  const tokens: TokenConfig[] = [];

  // LORDS token
  if (chain === "mainnet") {
    tokens.push({
      symbol: "LORDS",
      address: addresses.lords || "0x0124aeb495b947201f5fac96fd1138e326ad86195b98df6dec9009158a533b49",
      decimals: 18,
    });
    // ETH on mainnet
    tokens.push({
      symbol: "ETH",
      address: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
      decimals: 18,
    });
  } else {
    // On testnet/slot, use STRK
    tokens.push({
      symbol: "STRK",
      address: addresses.strk || "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
      decimals: 18,
    });
    // ETH on sepolia
    tokens.push({
      symbol: "ETH",
      address: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
      decimals: 18,
    });
  }

  return tokens;
};

// RPC URL for balance queries (always use mainnet/sepolia for balances, not katana)
const getRpcUrl = (chain: Chain): string => {
  if (chain === "mainnet") {
    return "https://api.cartridge.gg/x/starknet/mainnet";
  }
  return "https://api.cartridge.gg/x/starknet/sepolia";
};

interface TokenBalance {
  symbol: string;
  balance: string;
  rawBalance: bigint;
  isLoading: boolean;
  error: string | null;
}

export const WalletSection = () => {
  const { address, isConnected } = useAccount();
  const [balances, setBalances] = useState<Map<string, TokenBalance>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  const chain = env.VITE_PUBLIC_CHAIN as Chain;
  const tokens = useMemo(() => getTokensForChain(chain), [chain]);
  const rpcUrl = useMemo(() => getRpcUrl(chain), [chain]);

  /**
   * Fetch balance for a single token
   */
  const fetchTokenBalance = useCallback(
    async (token: TokenConfig, walletAddress: string): Promise<TokenBalance> => {
      try {
        const provider = new RpcProvider({ nodeUrl: rpcUrl });

        const result = await provider.callContract({
          contractAddress: token.address,
          entrypoint: "balanceOf",
          calldata: [walletAddress],
        });

        // Result is uint256 (low, high)
        const low = BigInt(result[0] || "0");
        const high = BigInt(result[1] || "0");
        const rawBalance = uint256.uint256ToBN({ low, high });

        // Format with decimals
        const divisor = BigInt(10 ** token.decimals);
        const wholePart = rawBalance / divisor;
        const fractionalPart = rawBalance % divisor;
        const fractionalStr = fractionalPart.toString().padStart(token.decimals, "0").slice(0, 4);
        const balance = `${wholePart}.${fractionalStr}`;

        return {
          symbol: token.symbol,
          balance,
          rawBalance,
          isLoading: false,
          error: null,
        };
      } catch (e) {
        console.warn(`Failed to fetch ${token.symbol} balance:`, e);
        return {
          symbol: token.symbol,
          balance: "0.00",
          rawBalance: 0n,
          isLoading: false,
          error: "Failed to fetch",
        };
      }
    },
    [rpcUrl],
  );

  /**
   * Fetch all token balances
   */
  const fetchAllBalances = useCallback(async () => {
    if (!address || !isConnected) {
      setBalances(new Map());
      return;
    }

    setIsLoading(true);

    // Initialize with loading state
    const initialBalances = new Map<string, TokenBalance>();
    tokens.forEach((token) => {
      initialBalances.set(token.symbol, {
        symbol: token.symbol,
        balance: "...",
        rawBalance: 0n,
        isLoading: true,
        error: null,
      });
    });
    setBalances(initialBalances);

    // Fetch all balances in parallel
    const results = await Promise.all(tokens.map((token) => fetchTokenBalance(token, address)));

    const newBalances = new Map<string, TokenBalance>();
    results.forEach((result) => {
      newBalances.set(result.symbol, result);
    });

    setBalances(newBalances);
    setIsLoading(false);
  }, [address, isConnected, tokens, fetchTokenBalance]);

  // Fetch balances when address changes
  useEffect(() => {
    void fetchAllBalances();
  }, [fetchAllBalances]);

  if (!isConnected || !address) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-gold/60">Connect your wallet to view balances</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Address display */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-gold/30 to-gold/10" />
          <div>
            <p className="font-medium text-gold">{displayAddress(address)}</p>
            <p className="text-xs text-gold/50">{chain === "mainnet" ? "Starknet Mainnet" : "Starknet Sepolia"}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void fetchAllBalances()}
          disabled={isLoading}
          className="rounded-lg border border-gold/30 bg-gold/10 px-3 py-1.5 text-sm text-gold transition hover:bg-gold/20 disabled:opacity-50"
        >
          {isLoading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {/* Token balances */}
      <div className="space-y-3">
        {tokens.map((token) => {
          const balance = balances.get(token.symbol);
          return (
            <div
              key={token.symbol}
              className="flex items-center justify-between rounded-xl border border-gold/10 bg-black/30 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/10 text-xs font-bold text-gold">
                  {token.symbol.slice(0, 2)}
                </div>
                <span className="font-medium text-gold/80">{token.symbol}</span>
              </div>
              <div className="text-right">
                {balance?.isLoading ? (
                  <span className="text-gold/50">...</span>
                ) : balance?.error ? (
                  <span className="text-red-400/70 text-sm">Error</span>
                ) : (
                  <span className="text-lg font-semibold text-gold">{balance?.balance || "0.00"}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <a
          href={
            chain === "mainnet"
              ? `https://voyager.online/contract/${address}`
              : `https://sepolia.voyager.online/contract/${address}`
          }
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 rounded-xl border border-gold/20 bg-gold/5 py-3 text-center text-sm font-medium text-gold/70 transition hover:bg-gold/10 hover:text-gold"
        >
          View on Explorer
        </a>
      </div>
    </div>
  );
};
