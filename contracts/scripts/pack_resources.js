function packResources(numbers) {
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

// Example usage
const numbers = [1, 2, 3];
const packedResult = packResources(numbers);
console.log(packedResult);
