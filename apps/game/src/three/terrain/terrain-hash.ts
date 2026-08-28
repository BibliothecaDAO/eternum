const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const UINT32_RANGE = 0x1_0000_0000;

export interface TerrainHashInput {
  col: number;
  row: number;
  elevationSeed: number;
  moistureSeed: number;
  salt: string;
}

export function hashTerrainCoordinates(input: TerrainHashInput): number {
  requireTerrainHashInput(input);
  let hash = hashString(input.salt, FNV_OFFSET_BASIS);
  hash = hashInt32(input.col, hash);
  hash = hashInt32(input.row, hash);
  hash = hashInt32(input.elevationSeed, hash);
  return hashInt32(input.moistureSeed, hash);
}

export function terrainHashToUnitFloat(hash: number): number {
  return (hash >>> 0) / UINT32_RANGE;
}

function requireTerrainHashInput(input: TerrainHashInput): void {
  for (const [name, value] of Object.entries(input)) {
    if (name === "salt") continue;
    if (!Number.isSafeInteger(value)) {
      throw new Error(`Terrain hash ${name} must be a safe integer, received ${String(value)}`);
    }
  }
  if (input.salt.length === 0) throw new Error("Terrain hash salt must not be empty");
}

function hashString(value: string, initialHash: number): number {
  let hash = initialHash;
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    hash = hashByte(codeUnit & 0xff, hash);
    hash = hashByte(codeUnit >>> 8, hash);
  }
  return hash;
}

function hashInt32(value: number, initialHash: number): number {
  let hash = initialHash;
  const word = value >>> 0;
  hash = hashByte(word & 0xff, hash);
  hash = hashByte((word >>> 8) & 0xff, hash);
  hash = hashByte((word >>> 16) & 0xff, hash);
  return hashByte(word >>> 24, hash);
}

function hashByte(value: number, hash: number): number {
  return Math.imul(hash ^ value, FNV_PRIME) >>> 0;
}
