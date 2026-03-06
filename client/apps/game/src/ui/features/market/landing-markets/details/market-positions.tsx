import { getContractByName } from "@dojoengine/core";
import type { Token, TokenBalance } from "@dojoengine/torii-wasm";
import { useAccount } from "@starknet-react/core";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { addAddressPadding } from "starknet";

import type { MarketClass } from "@/pm/class";
import { PMErrorState, PMHoldersSkeleton } from "@/pm/components/loading";
import { useDojoSdk } from "@/pm/hooks/dojo/use-dojo-sdk";
import { useTokens } from "@/pm/hooks/dojo/use-tokens";
import { computeRedeemableValue } from "@/pm/hooks/markets/calc-redeemable";
import { getPmSqlApiForUrl } from "@/pm/hooks/queries";
import { getPredictionMarketChain } from "@/pm/prediction-market-config";
import { useMarketActivity } from "@/pm/hooks/social/use-market-activity";
import { formatUnits } from "@/pm/utils";
import { GLOBAL_TORII_BY_CHAIN } from "@/config/global-chain";
import { TokenIcon } from "../token-icon";
import { MaybeController } from "../maybe-controller";

type MarketDataChain = "slot" | "mainnet";

type HolderPosition = {
  account: string;
  positions: Array<{
    index: number;
    label: string;
    amountFormatted: string;
    amountRaw: bigint;
    valueFormatted: string;
    valueRaw: bigint;
  }>;
  totalRaw: bigint;
  totalRedeemable: bigint;
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

export const MarketPositions = ({
  market,
  chain,
  address: providedAddress,
}: {
  market: MarketClass;
  chain?: MarketDataChain;
  address?: string;
}) => {
  const { account, address: connectedAddress } = useAccount();
  const address = providedAddress ?? connectedAddress ?? account?.address;
  const resolvedChain = chain ?? getPredictionMarketChain();
  const {
    config: { manifest },
  } = useDojoSdk();

  const vaultPositionsAddress = getContractByName(manifest, "pm", "VaultPositions").address;
  // const vaultFeesAddress = getContractByName(manifest, "pm", "VaultFees").address;

  const positionTokenIds = useMemo(() => (market.position_ids || []).map((id) => BigInt(id)), [market.position_ids]);
  const { marketBuys, isLoading: isActivityLoading, isError: isActivityError } = useMarketActivity(market.market_id);
  const accountAddressFilters = useMemo(() => {
    if (!address) return undefined;
    const variants = new Set<string>();
    variants.add(address);
    try {
      variants.add(`0x${BigInt(address).toString(16)}`);
    } catch {
      // Ignore invalid variant derivation and keep the original address.
    }
    try {
      variants.add(addAddressPadding(address.toLowerCase()));
    } catch {
      // Ignore invalid padding conversion and keep available variants.
    }
    return Array.from(variants);
  }, [address]);

  const { tokens, balances, isLoading, isError } = useTokens(
    {
      contractAddresses: [vaultPositionsAddress],
      // contractAddresses: [vaultPositionsAddress, vaultFeesAddress],
      tokenIds: undefined,
      // When viewing "My Positions", fetch the connected account explicitly so redeemable values
      // can be computed from actual position balances instead of SQL buy-history fallback.
      accountAddresses: accountAddressFilters,
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
  const hasPayoutNumerators = Boolean(market.conditionResolution?.payout_numerators?.length);
  const marketIdHex = useMemo(() => {
    try {
      return addAddressPadding(`0x${BigInt(market.market_id).toString(16)}`);
    } catch {
      return null;
    }
  }, [market.market_id]);
  const paddedAddress = useMemo(() => {
    if (!address) return null;
    try {
      return addAddressPadding(`0x${BigInt(address).toString(16)}`);
    } catch {
      return null;
    }
  }, [address]);
  const conditionIdHex = useMemo(() => {
    try {
      return addAddressPadding(`0x${BigInt(market.condition_id || 0).toString(16)}`).toLowerCase();
    } catch {
      return null;
    }
  }, [market.condition_id]);
  const oracleHex = useMemo(() => {
    try {
      return addAddressPadding(`0x${BigInt(market.oracle || 0).toString(16)}`).toLowerCase();
    } catch {
      return null;
    }
  }, [market.oracle]);
  const questionIdHex = useMemo(() => {
    try {
      return addAddressPadding(`0x${BigInt(market.question_id || 0).toString(16)}`).toLowerCase();
    } catch {
      return null;
    }
  }, [market.question_id]);

  const { data: conditionResolutionRow } = useQuery({
    queryKey: ["pm", "market", "condition-resolution", resolvedChain, conditionIdHex, oracleHex, questionIdHex],
    enabled: Boolean(market.isResolved() && !hasPayoutNumerators && conditionIdHex && oracleHex && questionIdHex),
    queryFn: async () => {
      if (!conditionIdHex || !oracleHex || !questionIdHex) return null;
      return getPmSqlApiForUrl(GLOBAL_TORII_BY_CHAIN[resolvedChain]).fetchConditionResolutionByKeys(
        conditionIdHex,
        oracleHex,
        questionIdHex,
      );
    },
    staleTime: 30 * 1000,
  });

  const payoutNumerators = useMemo<Array<bigint> | undefined>(() => {
    const marketPayouts = market.conditionResolution?.payout_numerators;
    if (marketPayouts && marketPayouts.length > 0) {
      return marketPayouts.map((value) => BigInt(value));
    }

    if (!conditionResolutionRow?.payout_numerators) return undefined;
    try {
      const parsed = JSON.parse(conditionResolutionRow.payout_numerators);
      if (!Array.isArray(parsed)) return undefined;
      return parsed.map((value) => BigInt(value as string | number));
    } catch {
      return undefined;
    }
  }, [conditionResolutionRow?.payout_numerators, market.conditionResolution?.payout_numerators]);

  const {
    data: userBuyRows = [],
    isLoading: isUserBuysLoading,
    isError: isUserBuysError,
  } = useQuery({
    queryKey: ["pm", "market", "my-positions", resolvedChain, marketIdHex, paddedAddress],
    enabled: Boolean(marketIdHex && paddedAddress),
    queryFn: async () => {
      if (!marketIdHex || !paddedAddress) return [];
      return getPmSqlApiForUrl(GLOBAL_TORII_BY_CHAIN[resolvedChain]).fetchMarketBuyOutcomesByMarketAndAccount(
        marketIdHex,
        paddedAddress,
      );
    },
    staleTime: 30 * 1000,
  });

  const holdersFromBalances = useMemo(() => {
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
        totalRedeemable: 0n,
      };

      const amountFormatted = formatBalance(balance, token, Number(market.collateralToken.decimals));
      holder.totalRaw += BigInt(balance.balance);

      const outcome = outcomes[positionIndex];
      const { valueFormatted, valueRaw } = computeRedeemableValue({
        market,
        positionIndex,
        balance,
        payoutNumerators,
      });
      holder.totalRedeemable += valueRaw;
      holder.positions.push({
        index: positionIndex,
        label: outcome?.name ?? `Outcome #${positionIndex + 1}`,
        amountFormatted,
        amountRaw: BigInt(balance.balance),
        valueFormatted,
        valueRaw,
      });

      map.set(balance.account_address, holder);
    });

    return Array.from(map.values()).toSorted((a, b) => (a.totalRaw < b.totalRaw ? 1 : -1));
  }, [balances, tokens, positionTokenIds, outcomes, market, payoutNumerators]);

  const holdersFromBuys = useMemo(() => {
    const map = new Map<string, HolderPosition>();

    marketBuys.forEach((buy) => {
      const accountAddress = buy.account_address;
      if (!accountAddress) return;

      const outcomeIndex = Number(buy.outcome_index ?? 0);
      if (!Number.isFinite(outcomeIndex) || outcomeIndex < 0) return;

      const amountRaw = BigInt(buy.amount ?? 0);
      if (amountRaw === 0n) return;

      const holder = map.get(accountAddress) ?? {
        account: accountAddress,
        positions: [],
        totalRaw: 0n,
        totalRedeemable: 0n,
      };

      holder.totalRaw += amountRaw;
      const existingPosition = holder.positions.find((position) => position.index === outcomeIndex);
      if (existingPosition) {
        existingPosition.amountRaw += amountRaw;
        existingPosition.amountFormatted = formatUnits(
          existingPosition.amountRaw,
          Number(market.collateralToken.decimals),
          4,
        );
      } else {
        const outcome = outcomes[outcomeIndex];
        holder.positions.push({
          index: outcomeIndex,
          label: outcome?.name ?? `Outcome #${outcomeIndex + 1}`,
          amountRaw,
          amountFormatted: formatUnits(amountRaw, Number(market.collateralToken.decimals), 4),
          valueFormatted: "0",
          valueRaw: 0n,
        });
      }

      map.set(accountAddress, holder);
    });

    return Array.from(map.values())
      .map((holder) => ({
        ...holder,
        positions: holder.positions.toSorted((a, b) => (a.amountRaw < b.amountRaw ? 1 : -1)),
      }))
      .toSorted((a, b) => (a.totalRaw < b.totalRaw ? 1 : -1));
  }, [marketBuys, market, outcomes]);

  const holders = holdersFromBalances.length > 0 ? holdersFromBalances : holdersFromBuys;
  const userHolderFromSql = useMemo<HolderPosition | null>(() => {
    if (!paddedAddress || userBuyRows.length === 0) return null;

    const byOutcome = new Map<number, bigint>();
    let totalRaw = 0n;

    userBuyRows.forEach((row) => {
      const index = Number(row.outcome_index ?? 0);
      if (!Number.isFinite(index) || index < 0) return;

      let amountRaw: bigint;
      try {
        amountRaw = BigInt(row.amount ?? 0);
      } catch {
        amountRaw = 0n;
      }
      if (amountRaw === 0n) return;

      totalRaw += amountRaw;
      const prev = byOutcome.get(index) ?? 0n;
      byOutcome.set(index, prev + amountRaw);
    });

    if (totalRaw === 0n) return null;

    const positions = Array.from(byOutcome.entries())
      .map(([index, amountRaw]) => {
        const outcome = outcomes[index];
        const syntheticBalance = {
          account_address: paddedAddress,
          contract_address: vaultPositionsAddress,
          token_id: positionTokenIds[index]?.toString() ?? "0",
          balance: amountRaw.toString(),
        } as unknown as TokenBalance;
        const { valueRaw, valueFormatted } = computeRedeemableValue({
          market,
          positionIndex: index,
          balance: syntheticBalance,
          payoutNumerators,
        });
        return {
          index,
          label: outcome?.name ?? `Outcome #${index + 1}`,
          amountRaw,
          amountFormatted: formatUnits(amountRaw, Number(market.collateralToken.decimals), 4),
          valueFormatted,
          valueRaw,
        };
      })
      .toSorted((a, b) => (a.amountRaw < b.amountRaw ? 1 : -1));

    const totalRedeemable = positions.reduce((sum, position) => sum + position.valueRaw, 0n);

    return {
      account: paddedAddress,
      positions,
      totalRaw,
      totalRedeemable,
    };
  }, [market, outcomes, paddedAddress, payoutNumerators, positionTokenIds, userBuyRows, vaultPositionsAddress]);

  const userHolder = useMemo(() => {
    if (!address) return null;
    const fallback = userHolderFromSql;
    const fromHolders = holders.find((holder) => {
      try {
        return BigInt(holder.account) === BigInt(address);
      } catch {
        return false;
      }
    });
    if (!fromHolders) return fallback;
    if (!fallback) return fromHolders;
    if (fromHolders.totalRedeemable > 0n) return fromHolders;
    if (fallback.totalRedeemable > 0n) return fallback;
    return fromHolders;
  }, [address, holders, userHolderFromSql]);

  const holdersToRender = address ? (userHolder ? [userHolder] : []) : holders;

  const tokenForIcon = market.collateralToken;

  // Loading state
  if (isLoading && holdersFromBalances.length === 0 && isActivityLoading && (!address || isUserBuysLoading)) {
    return <PMHoldersSkeleton count={3} />;
  }

  // Error state
  if (isError && isActivityError && (!address || isUserBuysError)) {
    return <PMErrorState message="Failed to load positions" />;
  }

  // Empty state
  if (holdersToRender.length === 0) {
    return (
      <div className="w-full rounded-lg border border-dashed border-white/10 bg-black/40 px-4 py-5 text-sm text-gold/80">
        <p className="text-white">{address ? "My positions" : "Market holders"}</p>
        <p className="mt-1 text-xs text-gold/60">
          {address
            ? "No positions found for your wallet in this market yet."
            : "Once players buy outcomes, their positions will appear here."}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gold/80">
          {address
            ? "Your positions"
            : `${holdersToRender.length} ${holdersToRender.length === 1 ? "holder" : "holders"}`}
        </div>
      </div>

      <div className="space-y-3">
        {holdersToRender.map((holder, holderIdx) => {
          const isYou =
            Boolean(address) &&
            (() => {
              try {
                return BigInt(holder.account) === BigInt(address ?? 0);
              } catch {
                return false;
              }
            })();
          const totalFormatted = formatUnits(holder.totalRaw, Number(market.collateralToken.decimals), 4);

          return (
            <div
              key={`${holder.account}-${holderIdx}`}
              className={`flex items-start gap-3 rounded-lg border px-3 py-3 ${
                isYou ? "border-gold/50 bg-gold/5" : "border-white/10 bg-white/5"
              }`}
            >
              <HolderAvatar address={holder.account} highlight={isYou} />

              <div className="flex min-w-0 flex-1 flex-col gap-2 overflow-hidden">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-gold/70">
                  <div className="flex items-center gap-2">
                    <MaybeController address={holder.account} className="text-white" />
                    {isYou ? (
                      <span className="rounded-full bg-gold/20 px-2 py-[2px] text-[10px] font-semibold uppercase text-dark">
                        You
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1 text-gold/60">
                    <span>Holdings:</span>
                    <span className="text-white font-semibold">{totalFormatted}</span>
                    {tokenForIcon ? <TokenIcon token={tokenForIcon} size={16} /> : null}
                  </div>
                  {market.isResolved() ? (
                    <div className="flex items-center gap-1 text-gold/60">
                      <span>Redeemable:</span>
                      <span className="text-white font-semibold">
                        {formatUnits(holder.totalRedeemable, Number(market.collateralToken.decimals), 4)}
                      </span>
                      {tokenForIcon ? <TokenIcon token={tokenForIcon} size={16} /> : null}
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-col gap-2">
                  {holder.positions.map((pos, idx) => {
                    const labelIsAddress = /^0x[0-9a-fA-F]+$/.test(pos.label);
                    return (
                      <div
                        key={`${holder.account}-pos-${idx}`}
                        className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-white/10 bg-white/10 px-3 py-2 text-sm"
                      >
                        <span className="rounded-full bg-white/10 px-2 py-[2px] text-[11px] uppercase tracking-wide text-gold/70">
                          Outcome
                        </span>
                        <span className="text-gold/70">
                          {labelIsAddress ? <MaybeController address={pos.label} /> : pos.label}
                        </span>

                        <div className="flex items-center gap-1">
                          <span className="text-white font-semibold">{pos.amountFormatted}</span>
                          {tokenForIcon ? <TokenIcon token={tokenForIcon} size={14} /> : null}
                        </div>

                        {market.isResolved() ? (
                          <div className="flex items-center gap-1">
                            <span className="text-gold/60">Redeemable:</span>
                            <span className="text-white font-semibold">
                              {pos.valueRaw > 0n ? pos.valueFormatted : "-"}
                            </span>
                            {pos.valueRaw > 0n && tokenForIcon ? <TokenIcon token={tokenForIcon} size={14} /> : null}
                          </div>
                        ) : null}
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
