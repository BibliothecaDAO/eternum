import { forwardRef, useMemo, useLayoutEffect } from "react";
import { Vector2 } from "three";
import { useThree } from "@react-three/fiber";
import { BlendFunction } from "postprocessing";
import { Entity } from "@dojoengine/recs";
import { Position, UIPosition, neighborOffsetsEven, neighborOffsetsOdd } from "@bibliothecadao/eternum";
import realmsHexPositions from "../../data/geodata/hex/realmHexPositions.json";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import realmHexPositions from "../../data/geodata/hex/realmHexPositions.json";

export { getEntityIdFromKeys };

export const getForeignKeyEntityId = (entityId: bigint, key: bigint, index: bigint) => {
  let keyHash = getEntityIdFromKeys([entityId, key, BigInt(index)]);
  return getEntityIdFromKeys([BigInt(keyHash)]);
};

export const currencyFormat = (num: any, decimals: number) => {
  return divideByPrecision(num)
    .toFixed(decimals)
    .replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");
};

export function currencyIntlFormat(num: any, decimals: number = 2) {
  return Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: decimals,
  }).format(num || 0);
}

// note: temp change because waiting for torii fix
// export function extractAndCleanKey(keys: (string | null)[]): bigint[] {
//   return keys.filter((value) => value !== null && value !== "").map((key) => BigInt(key as string));
// }
export function extractAndCleanKey(keys: string | null | undefined | string[]): bigint[] {
  if (Array.isArray(keys) && keys.length > 0) {
    return keys.map((key) => BigInt(key as string));
  } else {
    let stringKeys = keys as string | null | undefined;
    return (
      stringKeys
        ?.split("/")
        .slice(0, -1)
        .map((key) => BigInt(key as string)) || []
    );
  }
}

export const numberToHex = (num: number) => {
  return "0x" + num.toString(16);
};

export const hexToAscii = (str1: string) => {
  var hex = str1.toString();
  var str = "";
  for (var n = 0; n < hex.length; n += 2) {
    var asciiCode = parseInt(hex.substr(n, 2), 16);
    if (!isNaN(asciiCode)) {
      // Check if the parsed value is a number
      str += String.fromCharCode(asciiCode);
    }
  }
  return str;
};

export const formatTimeLeft = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  return `${hours}h:${minutes}m`;
};

export function displayAddress(string: string) {
  if (string === undefined) return "unknown";
  return string.substring(0, 6) + "..." + string.substring(string.length - 4);
}

export const formatTimeLeftDaysHoursMinutes = (seconds: number) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  return `${days} days ${hours}h:${minutes}m`;
};

const PRECISION = 1000;

export function multiplyByPrecision(value: number): number {
  return Math.floor(value * PRECISION);
}

export function divideByPrecision(value: number): number {
  return value / PRECISION;
}

export function getPosition(realm_id: bigint): { x: number; y: number } {
  let realmPositions = realmsHexPositions as { [key: number]: { col: number; row: number }[] };
  let position = realmPositions[Number(realm_id)][0];
  return { x: position.col, y: position.row };
}

const HIGHEST_X = 2147484147;
const LOWEST_X = 2147483647;

// get zone for labor auction
export function getZone(x: number): number {
  return 1 + Math.floor(((x - LOWEST_X) * 10) / (HIGHEST_X - LOWEST_X));
}

export function addressToNumber(address: string) {
  // Convert the address to a big integer
  let numericValue = BigInt(address);

  // Sum the digits of the numeric value
  let sum = 0;
  while (numericValue > 0) {
    sum += Number(numericValue % 5n);
    numericValue /= 5n;
  }

  // Map the sum to a number between 1 and 10
  return (sum % 5) + 1;
}

// export const calculateDistance = (start: Position, destination: Position): number => {
//   const x: number =
//     start.x > destination.x ? Math.pow(start.x - destination.x, 2) : Math.pow(destination.x - start.x, 2);

//   const y: number =
//     start.y > destination.y ? Math.pow(start.y - destination.y, 2) : Math.pow(destination.y - start.y, 2);

//   // Using bitwise shift for the square root approximation for BigInt.
//   // we store coords in x * 10000 to get precise distance
//   const distance = (x + y) ** 0.5 / 10000;

//   return distance;
// };

export function calculateDistance(start: Position, destination: Position): number | undefined {
  // d = √((x2-x1)² + (y2-y1)²)

  if (start && destination) {
    // Calculate the difference in x and y coordinates
    const deltaX = Math.abs(start.x - destination.x);
    const deltaY = Math.abs(start.y - destination.y);

    // Calculate the distance using the Pythagorean theorem
    // Each tile is 1 km, so we don't need to divide by 10000 here
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    return distance;
  }
}

export const getUIPositionFromColRow = (col: number, row: number, normalized?: boolean): UIPosition => {
  const hexRadius = 3;
  const hexHeight = hexRadius * 2;
  const hexWidth = Math.sqrt(3) * hexRadius;
  const vertDist = hexHeight * 0.75;
  const horizDist = hexWidth;

  const colNorm = col - (!normalized ? 2147483647 : 0);
  const rowNorm = row - (!normalized ? 2147483647 : 0);
  const x = colNorm * horizDist + ((rowNorm % 2) * horizDist) / 2;
  const y = rowNorm * vertDist;
  const z = pseudoRandom(x, y) * 2;
  return {
    x,
    y,
    z,
  };
};

export const getColRowFromUIPosition = (x: number, y: number, normalized?: boolean): { col: number; row: number } => {
  const hexRadius = 3;
  const hexHeight = hexRadius * 2;
  const hexWidth = Math.sqrt(3) * hexRadius;
  const vertDist = hexHeight * 0.75;
  const horizDist = hexWidth;

  const rowNorm = Math.round(y / vertDist);
  const colNorm = Math.round((x - ((rowNorm % 2) * horizDist) / 2) / horizDist);

  const col = colNorm + (!normalized ? 2147483647 : 0);
  const row = rowNorm + (!normalized ? 2147483647 : 0);

  return {
    col,
    row,
  };
};

export interface HexPositions {
  [key: string]: { col: number; row: number }[];
}

export const getRealmUIPosition = (realm_id: bigint): Position => {
  const realmPositions = realmHexPositions as HexPositions;
  const colrow = realmPositions[Number(realm_id).toString()][0];

  return getUIPositionFromColRow(colrow.col, colrow.row, false);
};

export const findDirection = (startPos: { col: number; row: number }, endPos: { col: number; row: number }) => {
  // give the direction
  const neighborOffsets = startPos.row % 2 === 0 ? neighborOffsetsEven : neighborOffsetsOdd;
  for (let offset of neighborOffsets) {
    if (startPos.col + offset.i === endPos.col && startPos.row + offset.j === endPos.row) {
      return offset.direction;
    }
  }
};

export function removeAccents(str: string) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export const pseudoRandom = (x: number, y: number) => {
  let n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453123;
  return n - Math.floor(n);
};

export function getResourceIdsFromPackedNumber(packedNumber: bigint): number[] {
  const resourceIds: number[] = [];
  const totalBits = 256; // Assuming u256, hence 256 bits

  for (let position = 0; position < totalBits; position++) {
    // Shift 1 to the left by 'position' places and perform bitwise AND
    if ((packedNumber & (1n << BigInt(position))) !== 0n) {
      resourceIds.push(position + 1);
    }
  }

  return resourceIds;
}
