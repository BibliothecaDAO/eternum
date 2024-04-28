function packResources(numbers) {
  const MAX_BITS = 128;
  const MAX_NUMBER_SIZE = 8;

  // Calculate the maximum number of values that can be packed
  const maxValues = Math.floor(MAX_BITS / MAX_NUMBER_SIZE);

  if (numbers.length > maxValues) {
    throw new Error(`Exceeded maximum number of values that can be packed: ${maxValues}`);
  }

  let packedValue = BigInt(0);

  for (let i = 0; i < numbers.length; i++) {
    const number = BigInt(numbers[i]);

    if (number >= 1 << MAX_NUMBER_SIZE) {
      throw new Error(`Number ${number} exceeds maximum size of ${MAX_NUMBER_SIZE} bits`);
    }

    packedValue = (packedValue << BigInt(MAX_NUMBER_SIZE)) | number;
  }

  return packedValue.toString();
}

function unpackResources(packedValue, valueCount) {
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

module.exports = {
  packResources,
  unpackResources,
};

// Example usage
// const numbers = [5, 15, 16, 21, 22];
// const packedResult = packResources(numbers);
// const unpackedResult = unpackResources(packedResult, numbers.length);
// console.log({ packedResult });
// console.log({ unpackedResult });

function getResourceIdsFromPackedNumber(packedNumber) {
  const resourceIds = [];
  const totalBits = 256; // Assuming u256, hence 256 bits

  for (let position = 0; position < totalBits; position++) {
    // Shift 1 to the left by 'position' places and perform bitwise AND
    if ((packedNumber & (1n << BigInt(position))) !== 0n) {
      resourceIds.push(position + 1);
    }
  }

  return resourceIds;
}

const res =
  getResourceIdsFromPackedNumber(57443731770074831323412168344153766786583156455220123566449660816425658351615n);
console.log({ res });
