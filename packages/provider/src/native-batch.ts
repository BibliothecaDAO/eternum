export async function completeNativeBatches<T extends { remaining: bigint }>(submit: () => Promise<T>): Promise<T> {
  let previous: bigint | undefined;
  while (true) {
    const result = await submit();
    if (result.remaining === 0n) return result;
    if (result.remaining < 0n || (previous !== undefined && result.remaining >= previous))
      throw new Error("Native batch made no progress; complete its prerequisites before resuming");
    previous = result.remaining;
  }
}
