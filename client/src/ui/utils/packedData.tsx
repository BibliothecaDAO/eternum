export function unpackResources(packedValue: bigint): number[] {
  const MAX_BITS_PER_VALUE = 8;

  const unpackedNumbers = [];

  let remainingValue = BigInt(packedValue);

  while (remainingValue > 0n) {
    const number = remainingValue & BigInt((1 << MAX_BITS_PER_VALUE) - 1);
    unpackedNumbers.unshift(Number(number));
    remainingValue = remainingValue >> BigInt(MAX_BITS_PER_VALUE);
  }
  return unpackedNumbers;
}
