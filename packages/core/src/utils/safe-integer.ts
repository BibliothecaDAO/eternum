/** Numeric UI APIs must refuse an integer they cannot represent, never round a native fact. */
export function safeInteger(value: number | bigint): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new Error("Native integer cannot be represented as a JavaScript number");
  return result;
}
