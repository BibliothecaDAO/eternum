function trimFixedNumber(value: number, fractionDigits: number): string {
  return value
    .toFixed(fractionDigits)
    .replace(/\.?0+$/, "")
    .replace(/(\.\d*?)0+$/, "$1");
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
    return formatCompactBigInt(value);
  }

  if (!Number.isFinite(value)) {
    return "--";
  }

  return formatCompactNumber(Math.max(value, 0));
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
