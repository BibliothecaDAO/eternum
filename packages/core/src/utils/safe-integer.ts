/**
 * The one way a native id becomes a JavaScript number: exact or loud. A string (Herald or story JSON) is read through
 * BigInt, so a malformed one throws instead of turning into NaN, a rounded value or, when empty, a silent zero.
 */
export function safeInteger(value: number | bigint | string): number {
  if (typeof value === "string" && value.trim() === "") throw new Error("Native integer is empty");
  const result = Number(typeof value === "string" ? BigInt(value) : value);
  if (!Number.isSafeInteger(result))
    throw new Error(`Native integer cannot be represented as a JavaScript number: ${String(value)}`);
  return result;
}
