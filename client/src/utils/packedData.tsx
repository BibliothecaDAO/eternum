export function unpackResources(packedValue: bigint, valueCount: number): number[] {
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

export function packResources(numbers: number[]) {
  const MAX_BITS = 128;
  const MAX_NUMBER_SIZE = 8;

  // Calculate the maximum number of values that can be packed
  const maxValues = Math.floor(MAX_BITS / MAX_NUMBER_SIZE);

  if (numbers.length > maxValues) {
    throw new Error(
      `Exceeded maximum number of values that can be packed: ${maxValues}`
    );
  }

  let packedValue = BigInt(0);

  for (let i = 0; i < numbers.length; i++) {
    const number = BigInt(numbers[i]);

    if (number >= 1 << MAX_NUMBER_SIZE) {
      throw new Error(
        `Number ${number} exceeds maximum size of ${MAX_NUMBER_SIZE} bits`
      );
    }

    packedValue = (packedValue << BigInt(MAX_NUMBER_SIZE)) | number;
  }

  return packedValue.toString();
}
