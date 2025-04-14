import { BuildingType } from "@bibliothecadao/types";

export function unpackValue(packedValue: bigint): number[] {
  const MAX_BITS_PER_VALUE = 8;

  const unpackedNumbers: number[] = [];

  // Return empty array if packedValue is 0
  if (packedValue === 0n) {
    return unpackedNumbers;
  }

  let remainingValue = BigInt(packedValue);

  while (remainingValue > 0n) {
    const number = remainingValue & BigInt((1 << MAX_BITS_PER_VALUE) - 1);
    unpackedNumbers.unshift(Number(number));
    remainingValue = remainingValue >> BigInt(MAX_BITS_PER_VALUE);
  }
  return unpackedNumbers;
}

export function packValues(numbers: number[]) {
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

/**
 * Gets the count of buildings for a specific category from a packed value
 * @param category The building category (1-based index)
 * @param packed The packed value containing counts for all categories
 * @returns The count of buildings for the specified category
 */
export function getBuildingCount(category: BuildingType, packedValues: bigint[]): number {
  const unpackedValues = unpackBuildingCounts(packedValues);
  return unpackedValues[category - 1];
}

/**
 * Sets the count of buildings for a specific category in a packed value
 * @param category The building category (1-based index)
 * @param packed The original packed value
 * @param count The new count to set (must fit in 8 bits, 0-255)
 * @returns A new packed value with the updated count
 */
export function setBuildingCount(category: BuildingType, packedValues: bigint[], count: number): bigint[] {
  const unpackedValues = unpackBuildingCounts(packedValues);
  unpackedValues[category - 1] = count;
  return packBuildingCounts(unpackedValues);
}

export function unpackBuildingCounts(packedValues: bigint[]): number[] {
  const unpackedValues: number[] = [];

  // Each packed value stores up to 16 categories (128 bits / 8 bits per category)
  // We have 3 packed values that can store up to 48 categories
  for (let packedIndex = 0; packedIndex < packedValues.length; packedIndex++) {
    const packedValue = packedValues[packedIndex];

    // Process each category in the current packed value
    // Each category takes 8 bits
    for (let categoryOffset = 0; categoryOffset < 16; categoryOffset++) {
      const shiftAmount = BigInt(categoryOffset * 8);
      const mask = BigInt(0xff); // 8 bits set to 1

      // Extract the count for this category
      const count = (BigInt(packedValue) >> shiftAmount) & BigInt(mask);

      // Add to our results array
      unpackedValues.push(Number(count));
    }
  }

  return unpackedValues;
}

export function packBuildingCounts(buildingCounts: number[]): bigint[] {
  const packedValues = [];
  const CATEGORIES_PER_PACKED = 16; // Each packed value can store 16 categories (128 bits / 8 bits per category)

  // Calculate how many packed values we need
  const packedCount = Math.ceil(buildingCounts.length / CATEGORIES_PER_PACKED);

  // Process each packed value
  for (let packedIndex = 0; packedIndex < packedCount; packedIndex++) {
    let packedValue = BigInt(0);

    // Process each category for this packed value
    for (let categoryOffset = 0; categoryOffset < CATEGORIES_PER_PACKED; categoryOffset++) {
      const buildingIndex = packedIndex * CATEGORIES_PER_PACKED + categoryOffset;

      // If we've run out of building counts, use 0
      const count = buildingIndex < buildingCounts.length ? buildingCounts[buildingIndex] : 0;

      // Validate the count is within range
      if (count < 0 || count > 255) {
        throw new Error(`Building count at index ${buildingIndex} is out of range (0-255): ${count}`);
      }

      // Shift the count to its position and OR it into the packed value
      const shiftAmount = BigInt(categoryOffset * 8);
      packedValue = packedValue | (BigInt(count) << shiftAmount);
    }

    packedValues.push(packedValue);
  }

  return packedValues;
}
