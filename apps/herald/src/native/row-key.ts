const FELT_LIMIT = (1n << 251n) + 17n * (1n << 192n) + 1n;

/** Model-local wire identity, using the row's ordered key felts without hashing them. */
export function nativeRowKey(felts: readonly (string | number | bigint)[]): string {
  if (felts.length === 0) throw new Error("Row key needs at least one felt");
  return felts
    .map((felt) => {
      if (typeof felt === "number" && !Number.isSafeInteger(felt)) throw new Error(`Unsafe row key: ${felt}`);
      const value = BigInt(felt);
      if (value < 0n || value >= FELT_LIMIT) throw new Error(`Not a felt: ${felt}`);
      return `0x${value.toString(16)}`;
    })
    .join(":");
}
