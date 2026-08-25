interface Uint256Like {
  low: bigint | number | string;
  high: bigint | number | string;
}

function isUint256Like(value: unknown): value is Uint256Like {
  return (
    value !== null &&
    typeof value === "object" &&
    "low" in value &&
    "high" in value
  );
}

export function toDecimalAmount(value: unknown): string {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number") return BigInt(Math.trunc(value)).toString();
  if (typeof value === "string") return BigInt(value).toString();

  if (isUint256Like(value)) {
    const low = BigInt(value.low);
    const high = BigInt(value.high);
    return (low + (high << 128n)).toString();
  }

  throw new TypeError("Unsupported amount format");
}

