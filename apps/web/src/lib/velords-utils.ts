import { formatUnits, parseEther } from "viem";

interface Uint256Like {
  low: bigint | number | string;
  high: bigint | number | string;
}

export function toBigInt(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "string") {
    if (value.trim() === "") return 0n;
    return BigInt(value);
  }
  if (typeof value === "number") return BigInt(value);
  if (value && typeof value === "object" && "low" in value && "high" in value) {
    const uint256 = value as Uint256Like;
    return BigInt(uint256.low) + (BigInt(uint256.high) << 128n);
  }
  return 0n;
}

function formatDecimalString(value: string, maximumFractionDigits: number): string {
  const [integerPartRaw, fractionPartRaw = ""] = value.split(".");
  const integerPart = integerPartRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  if (maximumFractionDigits <= 0) return integerPart;

  const fractionPart = fractionPartRaw.slice(0, maximumFractionDigits);
  const trimmedFraction = fractionPart.replace(/0+$/, "");
  if (!trimmedFraction) return integerPart;

  return `${integerPart}.${trimmedFraction}`;
}

export function formatTokenAmountDisplay(
  amount: unknown,
  { decimals = 18, maximumFractionDigits = 0 }: { decimals?: number; maximumFractionDigits?: number } = {},
): string {
  return formatDecimalString(formatUnits(toBigInt(amount), decimals), maximumFractionDigits);
}

export function calculateSharePercent(userBalance: unknown, totalSupply: unknown, fractionDigits = 2): string {
  const user = toBigInt(userBalance);
  const total = toBigInt(totalSupply);

  if (user <= 0n || total <= 0n) {
    return (0).toFixed(fractionDigits);
  }

  const scale = 10n ** BigInt(fractionDigits);
  const scaledPercent = (user * 100n * scale) / total;
  const integerPart = scaledPercent / scale;
  const fractionPart = (scaledPercent % scale).toString().padStart(fractionDigits, "0");

  return `${integerPart}.${fractionPart}`;
}

export function computeTvlUsd(lordsInVelords: unknown, lordsPriceRate: unknown): number | undefined {
  if (lordsInVelords === undefined || lordsInVelords === null) {
    return undefined;
  }
  if (lordsPriceRate === undefined || lordsPriceRate === null) {
    return undefined;
  }

  const parsedRate = typeof lordsPriceRate === "string" ? Number(lordsPriceRate) : lordsPriceRate;

  if (typeof parsedRate !== "number" || Number.isNaN(parsedRate)) {
    return undefined;
  }

  const lordsAmount = Number(formatUnits(toBigInt(lordsInVelords), 18));
  if (!Number.isFinite(lordsAmount)) {
    return undefined;
  }

  return lordsAmount * parsedRate;
}

export function parseOptionalStakeAmount(stakeAmount: string): bigint | undefined {
  const trimmedStakeAmount = stakeAmount.trim();
  if (!trimmedStakeAmount) return undefined;

  let parsedAmount: bigint;
  try {
    parsedAmount = parseEther(trimmedStakeAmount);
  } catch {
    return undefined;
  }
  if (parsedAmount <= 0n) return undefined;
  return parsedAmount;
}
