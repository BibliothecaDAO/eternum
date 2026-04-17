export type DebugChunkHeat = "cool" | "warm" | "hot";

export type DebugChunkScenarioId = "baseline" | "dense" | "stress";

export interface DebugChunkScenario {
  id: DebugChunkScenarioId;
  label: string;
  chunkRadius: number;
  chunkSize: number;
  hotChunkKeys: Set<string>;
}

export interface DebugChunkBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface DebugChunk {
  key: string;
  col: number;
  row: number;
  heat: DebugChunkHeat;
  center: {
    x: number;
    z: number;
  };
  bounds: DebugChunkBounds;
}

export interface DebugChunkFixture {
  chunks: DebugChunk[];
  chunkSize: number;
  chunkRadius: number;
  worldBounds: DebugChunkBounds;
}

interface DebugChunkMetrics {
  chunkCount: number;
  tileCount: number;
  hotChunkCount: number;
  estimatedDrawCalls: number;
}

interface BuildDebugChunkFixtureInput {
  chunkRadius: number;
  chunkSize: number;
  hotChunkKeys: Set<string>;
}

const CENTER_CHUNK_KEY = "0,0";
const DEBUG_RENDER_PASS_COUNT = 3;

const buildHotChunkKeys = (radius: number): Set<string> => {
  const keys = new Set<string>();

  for (let row = -radius; row <= radius; row += 1) {
    for (let col = -radius; col <= radius; col += 1) {
      keys.add(buildChunkKey(col, row));
    }
  }

  return keys;
};

const DEBUG_CHUNK_SCENARIOS: Record<DebugChunkScenarioId, DebugChunkScenario> = {
  baseline: {
    id: "baseline",
    label: "Baseline Grid",
    chunkRadius: 2,
    chunkSize: 16,
    hotChunkKeys: new Set([CENTER_CHUNK_KEY]),
  },
  dense: {
    id: "dense",
    label: "Dense Grid",
    chunkRadius: 3,
    chunkSize: 16,
    hotChunkKeys: buildHotChunkKeys(1),
  },
  stress: {
    id: "stress",
    label: "Stress Grid",
    chunkRadius: 4,
    chunkSize: 16,
    hotChunkKeys: buildHotChunkKeys(1),
  },
};

export const debugChunkScenarios = Object.values(DEBUG_CHUNK_SCENARIOS);

export const resolveDebugChunkScenario = (id: DebugChunkScenarioId): DebugChunkScenario => DEBUG_CHUNK_SCENARIOS[id];

export const isDebugChunkScenarioId = (value: string): value is DebugChunkScenarioId => value in DEBUG_CHUNK_SCENARIOS;

export const buildDebugChunkFixture = (input: BuildDebugChunkFixtureInput): DebugChunkFixture => {
  const chunks = buildDebugChunks(input);

  return {
    chunks,
    chunkSize: input.chunkSize,
    chunkRadius: input.chunkRadius,
    worldBounds: resolveWorldBounds(chunks),
  };
};

export const resolveDebugChunkMetrics = (scenario: DebugChunkScenario): DebugChunkMetrics => {
  const fixture = buildDebugChunkFixture(scenario);

  return {
    chunkCount: fixture.chunks.length,
    tileCount: fixture.chunks.length * scenario.chunkSize * scenario.chunkSize,
    hotChunkCount: fixture.chunks.filter((chunk) => chunk.heat === "hot").length,
    estimatedDrawCalls: resolveEstimatedDrawCalls(fixture),
  };
};

const buildDebugChunks = (input: BuildDebugChunkFixtureInput): DebugChunk[] => {
  const chunks: DebugChunk[] = [];

  for (let row = -input.chunkRadius; row <= input.chunkRadius; row += 1) {
    for (let col = -input.chunkRadius; col <= input.chunkRadius; col += 1) {
      chunks.push(buildDebugChunk(col, row, input));
    }
  }

  return chunks;
};

const buildDebugChunk = (col: number, row: number, input: BuildDebugChunkFixtureInput): DebugChunk => {
  const key = buildChunkKey(col, row);
  const bounds = buildChunkBounds(col, row, input.chunkSize);

  return {
    key,
    col,
    row,
    heat: resolveChunkHeat(key, input.hotChunkKeys),
    center: {
      x: bounds.minX + input.chunkSize / 2,
      z: bounds.minZ + input.chunkSize / 2,
    },
    bounds,
  };
};

function buildChunkKey(col: number, row: number): string {
  return `${col},${row}`;
}

const buildChunkBounds = (col: number, row: number, chunkSize: number): DebugChunkBounds => ({
  minX: col * chunkSize - chunkSize / 2,
  maxX: col * chunkSize + chunkSize / 2,
  minZ: row * chunkSize - chunkSize / 2,
  maxZ: row * chunkSize + chunkSize / 2,
});

const resolveChunkHeat = (key: string, hotChunkKeys: Set<string>): DebugChunkHeat => {
  if (hotChunkKeys.has(key)) return "hot";
  if (key === CENTER_CHUNK_KEY) return "warm";
  return "cool";
};

const resolveWorldBounds = (chunks: DebugChunk[]): DebugChunkBounds =>
  chunks.reduce<DebugChunkBounds>(
    (bounds, chunk) => ({
      minX: Math.min(bounds.minX, chunk.bounds.minX),
      maxX: Math.max(bounds.maxX, chunk.bounds.maxX),
      minZ: Math.min(bounds.minZ, chunk.bounds.minZ),
      maxZ: Math.max(bounds.maxZ, chunk.bounds.maxZ),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minZ: Number.POSITIVE_INFINITY,
      maxZ: Number.NEGATIVE_INFINITY,
    },
  );

const resolveEstimatedDrawCalls = (_fixture: DebugChunkFixture): number => DEBUG_RENDER_PASS_COUNT;
