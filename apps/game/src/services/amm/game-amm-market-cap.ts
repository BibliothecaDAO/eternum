const MARKET_CAP_PRICE_SCALE_DIGITS = 12;
const MARKET_CAP_PRICE_SCALE = 10n ** BigInt(MARKET_CAP_PRICE_SCALE_DIGITS);

export function computeMarketCapLords(resourceSupply: bigint | null, spotPrice: number | undefined): bigint | null {
  if (resourceSupply === null) {
    return null;
  }

  if (resourceSupply === 0n) {
    return 0n;
  }

  if (spotPrice === undefined || !Number.isFinite(spotPrice) || spotPrice < 0) {
    return null;
  }

  if (spotPrice === 0) {
    return 0n;
  }

  return roundScaledAmount(resourceSupply, resolveScaledSpotPrice(spotPrice), MARKET_CAP_PRICE_SCALE);
}

function resolveScaledSpotPrice(spotPrice: number): bigint {
  const [whole, fraction = ""] = spotPrice.toFixed(MARKET_CAP_PRICE_SCALE_DIGITS).split(".");
  return BigInt(`${whole}${fraction}`);
}

function roundScaledAmount(amount: bigint, scaledMultiplier: bigint, scale: bigint): bigint {
  return (amount * scaledMultiplier + scale / 2n) / scale;
}
