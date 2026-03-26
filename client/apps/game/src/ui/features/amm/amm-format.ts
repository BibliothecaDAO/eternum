const AMM_AMOUNT_DECIMALS = 18;
const AMM_AMOUNT_DIVISOR = 10n ** BigInt(AMM_AMOUNT_DECIMALS);

function trimFixedNumber(value: number, fractionDigits: number): string {
  const fixedValue = value.toFixed(fractionDigits);

  if (!fixedValue.includes(".")) {
    return fixedValue;
  }

  return fixedValue.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
}

function formatCompactBigInt(value: bigint): string {
  const thresholds = [
    { divisor: 1_000_000_000n, suffix: "B" },
    { divisor: 1_000_000n, suffix: "M" },
    { divisor: 1_000n, suffix: "K" },
  ];

  for (const { divisor, suffix } of thresholds) {
    if (value >= divisor) {
      const whole = value / divisor;
      const remainder = value % divisor;
      const decimal = Number((remainder * 10n) / divisor);
      return decimal > 0 ? `${whole.toString()}.${decimal}${suffix}` : `${whole.toString()}${suffix}`;
    }
  }

  return value.toString();
}

function formatCompactNumber(value: number): string {
  if (value >= 1_000_000_000) {
    return `${trimFixedNumber(value / 1_000_000_000, 1)}B`;
  }

  if (value >= 1_000_000) {
    return `${trimFixedNumber(value / 1_000_000, 1)}M`;
  }

  if (value >= 1_000) {
    return `${trimFixedNumber(value / 1_000, 1)}K`;
  }

  return trimFixedNumber(value, 0);
}

export function formatAmmCompactAmount(value: bigint | number): string {
  if (typeof value === "bigint") {
    return formatCompactBigIntAmount(value);
  }

  if (!Number.isFinite(value)) {
    return "--";
  }

  return formatCompactNumber(Math.max(value, 0));
}

function formatCompactBigIntAmount(value: bigint): string {
  const normalizedValue = normalizeAmmAmount(value);

  if (!Number.isFinite(normalizedValue)) {
    return formatCompactBigInt(value / AMM_AMOUNT_DIVISOR);
  }

  return formatCompactNumber(Math.max(normalizedValue, 0));
}

function normalizeAmmAmount(value: bigint): number {
  const whole = value / AMM_AMOUNT_DIVISOR;
  const remainder = value % AMM_AMOUNT_DIVISOR;
  return Number(whole) + Number(remainder) / Number(AMM_AMOUNT_DIVISOR);
}

export function formatAmmSpotPrice(value: number): string {
  if (!Number.isFinite(value)) {
    return "--";
  }

  if (value > 0 && value < 0.0001) {
    return "<0.0001";
  }

  const fractionDigits = value >= 100 ? 2 : 4;
  return trimFixedNumber(value, fractionDigits);
}

export function formatAmmPercent(value: number): string {
  if (!Number.isFinite(value)) {
    return "--";
  }

  return `${value.toFixed(2)}%`;
}

export function formatAmmFeeTo(address: string): string {
  const normalizedAddress = address.trim().toLowerCase();

  if (!normalizedAddress || normalizedAddress === "0x0") {
    return "Off";
  }

  if (normalizedAddress.length <= 12) {
    return normalizedAddress;
  }

  return `${normalizedAddress.slice(0, 6)}...${normalizedAddress.slice(-4)}`;
}
