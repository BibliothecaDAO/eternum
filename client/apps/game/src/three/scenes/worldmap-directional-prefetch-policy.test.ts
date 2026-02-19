import { describe, expect, it } from "vitest";

interface DirectionalPrefetchInput {
  forwardChunkKey: string;
  chunkSize: number;
  forwardDepthStrides: number;
  sideRadiusStrides: number;
  movementAxis: "x" | "z";
  movementSign: -1 | 1;
}

interface DirectionalPrefetchPolicyModule {
  deriveDirectionalPrefetchChunkKeys?: (input: DirectionalPrefetchInput) => string[];
}

function parseChunkKey(chunkKey: string): { row: number; col: number } {
  const [row, col] = chunkKey.split(",").map(Number);
  return { row, col };
}

function buildExpectedDirectionalBand(input: DirectionalPrefetchInput): Set<string> {
  const { row: forwardRow, col: forwardCol } = parseChunkKey(input.forwardChunkKey);
  const expected = new Set<string>();

  for (let forwardStride = 0; forwardStride <= input.forwardDepthStrides; forwardStride += 1) {
    for (let sideStride = -input.sideRadiusStrides; sideStride <= input.sideRadiusStrides; sideStride += 1) {
      const row =
        input.movementAxis === "z"
          ? forwardRow + forwardStride * input.movementSign * input.chunkSize
          : forwardRow + sideStride * input.chunkSize;
      const col =
        input.movementAxis === "x"
          ? forwardCol + forwardStride * input.movementSign * input.chunkSize
          : forwardCol + sideStride * input.chunkSize;
      expected.add(`${row},${col}`);
    }
  }

  return expected;
}

async function loadDirectionalPolicyModule(): Promise<DirectionalPrefetchPolicyModule> {
  try {
    return await import("./worldmap-directional-prefetch-policy");
  } catch {
    throw new Error(
      "Expected ./worldmap-directional-prefetch-policy to exist and export deriveDirectionalPrefetchChunkKeys",
    );
  }
}

describe("deriveDirectionalPrefetchChunkKeys", () => {
  const baseConfig = {
    chunkSize: 24,
    forwardDepthStrides: 2,
    sideRadiusStrides: 1,
  } as const;
  const directionalCases: ReadonlyArray<{
    movementAxis: DirectionalPrefetchInput["movementAxis"];
    movementSign: DirectionalPrefetchInput["movementSign"];
    forwardChunkKey: string;
    label: string;
  }> = [
    { movementAxis: "z", movementSign: 1, forwardChunkKey: "24,0", label: "south/positive-z" },
    { movementAxis: "z", movementSign: -1, forwardChunkKey: "-24,0", label: "north/negative-z" },
    { movementAxis: "x", movementSign: 1, forwardChunkKey: "0,24", label: "east/positive-x" },
    { movementAxis: "x", movementSign: -1, forwardChunkKey: "0,-24", label: "west/negative-x" },
  ];
  const invalidChunkKeys = ["", "bad-key", "0", "0,", ",0", "1,2,3", "Infinity,0", "NaN,0"];

  it.each(directionalCases)("derives axis-correct forward band for $label", async ({ movementAxis, movementSign, forwardChunkKey }) => {
    const directionalPolicy = await loadDirectionalPolicyModule();
    expect(typeof directionalPolicy.deriveDirectionalPrefetchChunkKeys).toBe("function");
    const deriveDirectionalPrefetchChunkKeys = directionalPolicy.deriveDirectionalPrefetchChunkKeys as (
      input: DirectionalPrefetchInput,
    ) => string[];

    const input: DirectionalPrefetchInput = {
      ...baseConfig,
      forwardChunkKey,
      movementAxis,
      movementSign,
    };

    const expected = buildExpectedDirectionalBand(input);
    const actual = new Set(deriveDirectionalPrefetchChunkKeys(input));
    expect(actual).toEqual(expected);
  });

  it.each(invalidChunkKeys)("rejects malformed forward chunk keys: %s", async (forwardChunkKey) => {
    const directionalPolicy = await loadDirectionalPolicyModule();
    expect(typeof directionalPolicy.deriveDirectionalPrefetchChunkKeys).toBe("function");
    const deriveDirectionalPrefetchChunkKeys = directionalPolicy.deriveDirectionalPrefetchChunkKeys as (
      input: DirectionalPrefetchInput,
    ) => string[];

    expect(() =>
      deriveDirectionalPrefetchChunkKeys({
        ...baseConfig,
        forwardChunkKey,
        movementAxis: "z",
        movementSign: 1,
      }),
    ).toThrow(/chunk key/i);
  });
});
