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

export function packResources(numbers: number[]) {
  const MAX_BITS = 128;
  const MAX_BITS_PER_VALUE = 8;

  // Calculate the maximum number of values that can be packed
  const maxValues = Math.floor(MAX_BITS / MAX_BITS_PER_VALUE);

  if (numbers.length > maxValues) {
    throw new Error(`Exceeded maximum number of values that can be packed: ${maxValues}`);
  }

  let packedValue = BigInt(0);

  for (let i = 0; i < numbers.length; i++) {
    const number = BigInt(numbers[i]);

    if (number >= 1 << MAX_BITS_PER_VALUE) {
      throw new Error(`Number ${number} exceeds maximum size of ${MAX_BITS_PER_VALUE} bits`);
    }

    packedValue = (packedValue << BigInt(MAX_BITS_PER_VALUE)) | number;
  }

  return packedValue.toString();
}
