import { getContractByName } from "@dojoengine/core";
import type { Token, TokenBalance } from "@dojoengine/torii-wasm";
import { useAccount } from "@starknet-react/core";
import { useMemo } from "react";

import type { MarketClass } from "@/pm/class";
import { useDojoSdk } from "@/pm/hooks/dojo/useDojoSdk";
import { useTokens } from "@/pm/hooks/dojo/useTokens";
import { formatUnits } from "@/pm/utils";
import { MaybeController } from "../MaybeController";

type HolderPosition = {
  account: string;
  positions: Array<{
    label: string;
    amountFormatted: string;
  }>;
  totalRaw: bigint;
};

const formatBalance = (balance: TokenBalance, token: Token | undefined, decimalsFallback: number) => {
  const decimals = token?.decimals ? Number(token.decimals) : decimalsFallback;
  return formatUnits(BigInt(balance.balance), decimals, 4);
};

export const MarketPositions = ({ market }: { market: MarketClass }) => {
  const { account } = useAccount();
  const {
    config: { manifest },
  } = useDojoSdk();

  const vaultPositionsAddress = getContractByName(manifest, "pm", "VaultPositions").address;
  const vaultFeesAddress = getContractByName(manifest, "pm", "VaultFees").address;

  const positionTokenIds = useMemo(() => (market.position_ids || []).map((id) => BigInt(id)), [market.position_ids]);

  const { tokens, balances } = useTokens(
    {
      contractAddresses: [vaultPositionsAddress],
      // contractAddresses: [vaultPositionsAddress, vaultFeesAddress],
      tokenIds: undefined,
      accountAddresses: undefined,
      pagination: {
        cursor: undefined,
        direction: "Backward",
        limit: 1_000,
        order_by: [],
      },
    },
    false,
  );

  const outcomes = useMemo(() => market.getMarketOutcomes(), [market]);

  const holders = useMemo(() => {
    const map = new Map<string, HolderPosition>();

    balances.forEach((balance) => {
      if (BigInt(balance.balance) === 0n) return;

      const token = tokens.find(
        (t) =>
          BigInt(t.contract_address) === BigInt(balance.contract_address) &&
          BigInt(t.token_id || 0) === BigInt(balance.token_id || 0),
      );

      const positionIndex = positionTokenIds.findIndex((id) => BigInt(id) === BigInt(balance.token_id || 0));
      const isPositionToken = positionIndex >= 0;

      if (!isPositionToken) return;

      const holder = map.get(balance.account_address) ?? {
        account: balance.account_address,
        positions: [],
        totalRaw: 0n,
      };

      const amountFormatted = formatBalance(balance, token, Number(market.collateralToken.decimals));
      holder.totalRaw += BigInt(balance.balance);

      const outcome = outcomes[positionIndex];
      holder.positions.push({
        label: outcome?.name ?? `Outcome #${positionIndex + 1}`,
        amountFormatted,
      });

      map.set(balance.account_address, holder);
    });

    return Array.from(map.values()).sort((a, b) => (a.totalRaw < b.totalRaw ? 1 : -1));
  }, [balances, tokens, positionTokenIds, outcomes, market.collateralToken.decimals]);

  const symbol = market.collateralToken.symbol || "";

  if (holders.length === 0) {
    return (
      <div className="rounded-md border border-white/10 bg-black/40 p-4 text-sm text-gold/80">
        <p>No positions have been opened in this market yet.</p>
        <p className="mt-1 text-xs text-gold/60">Once players buy outcomes, their positions will appear here.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-white/10 bg-black/40 p-4 text-sm text-white/80">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-white">Market holders</p>
        <p className="text-xs text-gold/70">{symbol}</p>
      </div>

      <div className="divide-y divide-white/10">
        {holders.map((holder) => {
          const isYou = account && BigInt(holder.account) === BigInt(account.address);
          return (
            <div key={holder.account} className="space-y-2 py-3">
              <div className="flex items-center justify-between">
                <MaybeController address={holder.account} className="text-white/90" />
                {isYou ? <span className="text-xs text-gold/70">You</span> : null}
              </div>

              <div className="space-y-1">
                {holder.positions.map((pos, idx) => (
                  <div key={`${holder.account}-pos-${idx}`} className="flex items-center justify-between">
                    <span className="text-gold/70">
                      {/^0x[0-9a-fA-F]+$/.test(pos.label) ? <MaybeController address={pos.label} /> : pos.label}
                    </span>
                    <span className="text-white">
                      {pos.amountFormatted} {symbol}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
