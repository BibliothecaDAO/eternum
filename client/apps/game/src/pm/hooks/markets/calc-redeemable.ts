import type { TokenBalance } from "@dojoengine/torii-wasm";

import type { MarketClass } from "@/pm/class";
import { formatUnits } from "@/pm/utils";

export const computeRedeemableValue = ({
  market,
  positionIndex,
  balance,
}: {
  market: MarketClass;
  positionIndex: number;
  balance: TokenBalance;
}): { valueRaw: bigint; valueFormatted: string } => {
  if (!market.isResolved()) return { valueRaw: 0n, valueFormatted: "0" };
  const payouts = market.conditionResolution?.payout_numerators;
  if (!payouts || payouts.length === 0) return { valueRaw: 0n, valueFormatted: "0" };

  const payout = payouts[positionIndex] ?? 0;
  const totalPayout = payouts.reduce((sum, val) => Number(sum) + Number(val), 0);
  if (totalPayout === 0 || payout === 0) return { valueRaw: 0n, valueFormatted: "0" };

  const denominatorRaw = market.vaultDenominator?.value;
  const numeratorRaw = market.vaultNumerators?.find((entry) => entry.index === positionIndex)?.value;
  if (denominatorRaw == null || numeratorRaw == null) return { valueRaw: 0n, valueFormatted: "0" };

  const denominator = BigInt(denominatorRaw);
  const numerator = BigInt(numeratorRaw);
  if (numerator === 0n) return { valueRaw: 0n, valueFormatted: "0" };

  const totalShare = BigInt((Number(payout) * 10_000) / Number(totalPayout));
  if (totalShare === 0n) return { valueRaw: 0n, valueFormatted: "0" };

  const share = (totalShare * denominator) / numerator;
  const valueRaw = (share * BigInt(balance.balance)) / 10_000n;
  const valueFormatted = formatUnits(valueRaw, Number(market.collateralToken.decimals), 4);
  return { valueRaw, valueFormatted };
};
