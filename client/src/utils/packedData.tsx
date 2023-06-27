export function unpackResources(packedValue: bigint, valueCount: number): number[] {
  const MAX_BITS = 128;
  const MAX_NUMBER_SIZE = 8;

  const unpackedNumbers = [];

  let remainingValue = BigInt(packedValue);

  for (let i = 0; i < valueCount; i++) {
    const number = remainingValue & BigInt((1 << MAX_NUMBER_SIZE) - 1);
    unpackedNumbers.unshift(Number(number));
    remainingValue = remainingValue >> BigInt(MAX_NUMBER_SIZE);
  }

  return unpackedNumbers;
}
