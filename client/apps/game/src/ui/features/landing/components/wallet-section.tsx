/**
 * Wallet section for the profile page.
 * Always fetches mainnet balances from the connected wallet.
 */
import { useCallback, useEffect, useState } from "react";
import { useAccount } from "@starknet-react/core";
import { RpcProvider, uint256 } from "starknet";
import { getSeasonAddresses } from "@contracts";
import { displayAddress } from "@/ui/utils/utils";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useCartridgeUsername } from "@/hooks/use-cartridge-username";
import { getAvatarUrl, useMyAvatar } from "@/hooks/use-player-avatar";

// Token configs - always mainnet
interface TokenConfig {
  symbol: string;
  address: string;
  decimals: number;
  logo: string;
}

// Always use mainnet tokens
const MAINNET_TOKENS: TokenConfig[] = (() => {
  const addresses = getSeasonAddresses("mainnet");
  return [
    {
      symbol: "LORDS",
      address: addresses.lords || "0x0124aeb495b947201f5fac96fd1138e326ad86195b98df6dec9009158a533b49",
      decimals: 18,
      logo: "/tokens/lords.png",
    },
    {
      symbol: "ETH",
      address: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
      decimals: 18,
      logo: "/tokens/eth.png",
    },
    {
      symbol: "STRK",
      address: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
      decimals: 18,
      logo: "/tokens/strk.png",
    },
  ];
})();

// Always use mainnet RPC
const MAINNET_RPC_URL = "https://api.cartridge.gg/x/starknet/mainnet";

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

  // Avatar support
  const accountName = useAccountStore((state) => state.accountName);
  const { username: cartridgeUsername } = useCartridgeUsername();
  const displayName = accountName || cartridgeUsername || "";
  const playerId = address ?? "";
  const { data: myAvatar } = useMyAvatar(playerId, playerId, displayName);
  const avatarUrl = getAvatarUrl(address || "", myAvatar?.avatarUrl);

  /**
   * Fetch balance for a single token
   */
  const fetchTokenBalance = useCallback(async (token: TokenConfig, walletAddress: string): Promise<TokenBalance> => {
    try {
      const provider = new RpcProvider({ nodeUrl: MAINNET_RPC_URL });

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
  }, []);

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
    MAINNET_TOKENS.forEach((token) => {
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
    const results = await Promise.all(MAINNET_TOKENS.map((token) => fetchTokenBalance(token, address)));

    const newBalances = new Map<string, TokenBalance>();
    results.forEach((result) => {
      newBalances.set(result.symbol, result);
    });

    setBalances(newBalances);
    setIsLoading(false);
  }, [address, isConnected, fetchTokenBalance]);

  // Fetch balances when address changes
  useEffect(() => {
    void fetchAllBalances();
  }, [fetchAllBalances]);

  if (!isConnected || !address) {
    return (
      <section className="w-full max-w-4xl rounded-3xl border border-gold/20 bg-gradient-to-br from-gold/5 via-black/40 to-black/90 p-8 shadow-[0_35px_70px_-25px_rgba(12,10,35,0.85)] backdrop-blur-xl">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-lg text-gold/60">Connect your wallet to view balances</p>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full max-w-4xl space-y-6 rounded-3xl border border-gold/20 bg-gradient-to-br from-gold/5 via-black/40 to-black/90 p-8 shadow-[0_35px_70px_-25px_rgba(12,10,35,0.85)] backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 overflow-hidden rounded-full border-2 border-gold/30 bg-gradient-to-br from-gold/30 to-gold/10">
            <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
          </div>
          <div>
            <p className="text-xl font-medium text-gold">{displayName || displayAddress(address)}</p>
            <p className="text-sm text-gold/50">Starknet Mainnet</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void fetchAllBalances()}
          disabled={isLoading}
          className="rounded-xl border border-gold/30 bg-gold/10 px-5 py-2.5 text-sm font-medium text-gold transition hover:bg-gold/20 disabled:opacity-50"
        >
          {isLoading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {/* Token balances */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium uppercase tracking-wider text-gold/50">Token Balances</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          {MAINNET_TOKENS.map((token) => {
            const balance = balances.get(token.symbol);
            return (
              <div
                key={token.symbol}
                className="rounded-2xl border border-gold/10 bg-black/40 p-5 transition hover:border-gold/20"
              >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 overflow-hidden rounded-full bg-gold/10 p-1">
                    <img src={token.logo} alt={token.symbol} className="h-full w-full object-contain" />
                  </div>
                  <div>
                    <p className="text-sm text-gold/60">{token.symbol}</p>
                    {balance?.isLoading ? (
                      <p className="text-2xl font-semibold text-gold/50">...</p>
                    ) : balance?.error ? (
                      <p className="text-sm text-red-400/70">Error</p>
                    ) : (
                      <p className="text-2xl font-semibold text-gold">{balance?.balance || "0.00"}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <a
        href={`https://voyager.online/contract/${address}`}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full rounded-xl border border-gold/20 bg-gold/5 py-4 text-center font-medium text-gold/70 transition hover:bg-gold/10 hover:text-gold"
      >
        View on Voyager Explorer
      </a>
    </section>
  );
};
