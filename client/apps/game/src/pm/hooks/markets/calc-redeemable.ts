import type { TokenBalance } from "@dojoengine/torii-wasm";

import type { MarketClass } from "@/pm/class";
import { formatUnits } from "@/pm/utils";

export const computeRedeemableValue = ({
  market,
  positionIndex,
  balance,
  payoutNumerators,
}: {
  market: MarketClass;
  positionIndex: number;
  balance: TokenBalance;
  payoutNumerators?: Array<bigint | number | string>;
}): { valueRaw: bigint; valueFormatted: string } => {
  if (!market.isResolved()) return { valueRaw: 0n, valueFormatted: "0" };
  const payoutValues = payoutNumerators ?? market.conditionResolution?.payout_numerators;
  if (!payoutValues || payoutValues.length === 0) return { valueRaw: 0n, valueFormatted: "0" };

  const payouts = payoutValues.map((value) => {
    try {
      return BigInt(value);
    } catch {
      return 0n;
    }
  });

  const payout = payouts[positionIndex] ?? 0n;
  const totalPayout = payouts.reduce((sum, val) => sum + val, 0n);
  if (totalPayout === 0n || payout === 0n) return { valueRaw: 0n, valueFormatted: "0" };

  const denominatorRaw = market.vaultDenominator?.value;
  const numeratorRaw = market.vaultNumerators?.find((entry) => entry.index === positionIndex)?.value;
  if (denominatorRaw == null || numeratorRaw == null) return { valueRaw: 0n, valueFormatted: "0" };

  const denominator = BigInt(denominatorRaw);
  const numerator = BigInt(numeratorRaw);
  if (numerator === 0n) return { valueRaw: 0n, valueFormatted: "0" };

  const totalShare = (payout * 10_000n) / totalPayout;
  if (totalShare === 0n) return { valueRaw: 0n, valueFormatted: "0" };

  const share = (totalShare * denominator) / numerator;
  const valueRaw = (share * BigInt(balance.balance)) / 10_000n;
  const valueFormatted = formatUnits(valueRaw, Number(market.collateralToken.decimals), 4);
  return { valueRaw, valueFormatted };
};
