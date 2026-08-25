export const DEFAULT_TOKEN_PRECISION = 18;

function normalizeTokenAmountInput(value: string, label: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`${label} is required`);
  }

  return trimmed.startsWith(".") ? `0${trimmed}` : trimmed;
}

export function parseTokenAmountToIntegerString(value: string, precision: number, label: string): string {
  const normalizedValue = normalizeTokenAmountInput(value, label);

  if (!/^\d+(\.\d+)?$/.test(normalizedValue)) {
    throw new Error(`${label} must be a number`);
  }

  const [whole, fraction = ""] = normalizedValue.split(".");

  if (fraction.length > precision) {
    throw new Error(`${label} has more than ${precision} decimals`);
  }

  const paddedFraction = fraction.padEnd(precision, "0");
  const combined = `${whole}${precision > 0 ? paddedFraction : ""}`.replace(/^0+(?=\d)/, "");

  return combined || "0";
}

export function formatIntegerStringTokenAmount(
  value: string | number | bigint | null | undefined,
  precision: number,
): string {
  if (value === null || value === undefined) {
    return "";
  }

  const digits = String(value).trim();

  if (!/^\d+$/.test(digits)) {
    return digits;
  }

  if (precision === 0) {
    return digits;
  }

  const paddedDigits = digits.padStart(precision + 1, "0");
  const whole = paddedDigits.slice(0, -precision);
  const fraction = paddedDigits.slice(-precision).replace(/0+$/, "");

  return fraction ? `${whole}.${fraction}` : whole;
}
