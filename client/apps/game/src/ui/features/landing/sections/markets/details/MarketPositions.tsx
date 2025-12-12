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

const HolderAvatar = ({ address, highlight }: { address: string; highlight?: boolean }) => {
  const initials = address ? address.slice(2, 4).toUpperCase() : "??";

  return (
    <div
      className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold ${
        highlight ? "bg-gold/20 text-dark ring-1 ring-gold/50" : "bg-white/10 text-white ring-1 ring-white/10"
      }`}
    >
      {initials}
    </div>
  );
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
  // const vaultFeesAddress = getContractByName(manifest, "pm", "VaultFees").address;

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
      <div className="w-full rounded-lg border border-dashed border-white/10 bg-black/40 px-4 py-5 text-sm text-gold/80">
        <p className="text-white">Market holders</p>
        <p className="mt-1 text-xs text-gold/60">Once players buy outcomes, their positions will appear here.</p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gold/80">
          {holders.length} {holders.length === 1 ? "holder" : "holders"}
        </div>
      </div>

      <div className="space-y-3">
        {holders.map((holder, holderIdx) => {
          const isYou = account && BigInt(holder.account) === BigInt(account.address);
          const totalFormatted = formatUnits(holder.totalRaw, Number(market.collateralToken.decimals), 4);

          return (
            <div
              key={`${holder.account}-${holderIdx}`}
              className={`flex items-start gap-3 rounded-lg border px-3 py-3 ${
                isYou ? "border-gold/50 bg-gold/5" : "border-white/10 bg-white/5"
              }`}
            >
              <HolderAvatar address={holder.account} highlight={isYou} />

              <div className="flex flex-1 flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gold/70">
                  <div className="flex items-center gap-2">
                    <MaybeController address={holder.account} className="text-white" />
                    {isYou ? (
                      <span className="rounded-full bg-gold/20 px-2 py-[2px] text-[10px] font-semibold uppercase text-dark">
                        You
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1 text-gold/60">
                    <span>Holdings</span>
                    <span className="text-white font-semibold">{totalFormatted}</span>
                    {symbol ? <span className="text-xs uppercase text-gold/60">{symbol}</span> : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {holder.positions.map((pos, idx) => {
                    const labelIsAddress = /^0x[0-9a-fA-F]+$/.test(pos.label);
                    return (
                      <div
                        key={`${holder.account}-pos-${idx}`}
                        className="flex items-center gap-2 rounded-md border border-white/10 bg-white/10 px-3 py-2 text-sm"
                      >
                        <span className="rounded-full bg-white/10 px-2 py-[2px] text-[11px] uppercase tracking-wide text-gold/70">
                          Outcome
                        </span>
                        <span className="text-gold/70">
                          {labelIsAddress ? <MaybeController address={pos.label} /> : pos.label}
                        </span>
                        <span className="text-gold/60">•</span>
                        <span className="text-white font-semibold">{pos.amountFormatted}</span>
                        {symbol ? <span className="text-xs uppercase text-gold/60">{symbol}</span> : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};
