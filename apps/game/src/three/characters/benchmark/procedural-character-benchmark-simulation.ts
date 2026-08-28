import type { ProceduralCharacterBenchmarkConfig } from "./procedural-character-benchmark-config";

const BENCHMARK_HEX_COLUMNS = 10;
const BENCHMARK_HEX_ROWS = 10;
export const BENCHMARK_HEX_COUNT = BENCHMARK_HEX_COLUMNS * BENCHMARK_HEX_ROWS;
export const BENCHMARK_FIXED_STEP_SECONDS = 1 / 30;

interface BenchmarkHexCell {
  column: number;
  index: number;
  neighbors: readonly number[];
  row: number;
  x: number;
  z: number;
}

export type BenchmarkAgentPhase = "ragdoll" | "running";

export interface BenchmarkAgentSimulationState {
  currentCellIndex: number;
  id: number;
  movementProgress: number;
  phase: BenchmarkAgentPhase;
  phaseElapsedSeconds: number;
  speedFactor: number;
  targetCellIndex: number;
}

export interface ProceduralCharacterBenchmarkSimulationState {
  agents: BenchmarkAgentSimulationState[];
  deathAccumulator: number;
  elapsedSeconds: number;
  randomState: number;
  totalDeaths: number;
  totalRespawns: number;
}

export interface ProceduralCharacterBenchmarkSimulationSnapshot {
  actorCount: number;
  elapsedSeconds: number;
  ragdollCount: number;
  runningCount: number;
  totalDeaths: number;
  totalRespawns: number;
}

export type ProceduralCharacterBenchmarkEvent =
  | { type: "death"; agentId: number }
  | { type: "respawn"; agentId: number };

export interface MutableBenchmarkPosition {
  x: number;
  z: number;
}

export const BENCHMARK_HEX_CELLS = createBenchmarkHexGrid();

export function createProceduralCharacterBenchmarkSimulation(
  config: ProceduralCharacterBenchmarkConfig,
): ProceduralCharacterBenchmarkSimulationState {
  const state: ProceduralCharacterBenchmarkSimulationState = {
    agents: [],
    deathAccumulator: 0,
    elapsedSeconds: 0,
    randomState: normalizeRandomSeed(config.seed),
    totalDeaths: 0,
    totalRespawns: 0,
  };

  for (let id = 0; id < config.actorCount; id += 1) {
    state.agents.push(createAgent(state, id));
  }
  return state;
}

export function advanceProceduralCharacterBenchmarkSimulation(
  state: ProceduralCharacterBenchmarkSimulationState,
  config: ProceduralCharacterBenchmarkConfig,
  deltaSeconds: number,
): ProceduralCharacterBenchmarkEvent[] {
  const elapsed = resolveElapsedSeconds(deltaSeconds) * config.simulationSpeed;
  if (elapsed <= 0) return [];

  state.elapsedSeconds += elapsed;
  const events: ProceduralCharacterBenchmarkEvent[] = [];
  state.agents.forEach((agent) => advanceAgent(state, agent, config, elapsed, events));
  scheduleDeaths(state, config, elapsed, events);
  return events;
}

export function killProceduralCharacterBenchmarkAgents(
  state: ProceduralCharacterBenchmarkSimulationState,
  config: ProceduralCharacterBenchmarkConfig,
  requestedCount: number,
): ProceduralCharacterBenchmarkEvent[] {
  const events: ProceduralCharacterBenchmarkEvent[] = [];
  const availableSlots = Math.max(0, config.maxActiveRagdolls - countRagdolls(state));
  const count = Math.min(Math.max(0, Math.floor(requestedCount)), availableSlots);
  for (let index = 0; index < count; index += 1) {
    const agent = selectRunningAgent(state);
    if (!agent) break;
    startAgentDeath(state, agent, events);
  }
  return events;
}

export function resolveProceduralCharacterBenchmarkSimulationSnapshot(
  state: ProceduralCharacterBenchmarkSimulationState,
): ProceduralCharacterBenchmarkSimulationSnapshot {
  const ragdollCount = countRagdolls(state);
  return {
    actorCount: state.agents.length,
    elapsedSeconds: state.elapsedSeconds,
    ragdollCount,
    runningCount: state.agents.length - ragdollCount,
    totalDeaths: state.totalDeaths,
    totalRespawns: state.totalRespawns,
  };
}

export function writeBenchmarkAgentPosition(
  agent: BenchmarkAgentSimulationState,
  target: MutableBenchmarkPosition,
): void {
  const sourceCell = BENCHMARK_HEX_CELLS[agent.currentCellIndex];
  const targetCell = BENCHMARK_HEX_CELLS[agent.targetCellIndex];
  target.x = sourceCell.x + (targetCell.x - sourceCell.x) * agent.movementProgress;
  target.z = sourceCell.z + (targetCell.z - sourceCell.z) * agent.movementProgress;
}

function createBenchmarkHexGrid(): readonly BenchmarkHexCell[] {
  const radius = 1;
  const horizontalSpacing = radius * 1.5;
  const verticalSpacing = Math.sqrt(3) * radius;
  const rawCells = Array.from({ length: BENCHMARK_HEX_COUNT }, (_, index) => {
    const column = index % BENCHMARK_HEX_COLUMNS;
    const row = Math.floor(index / BENCHMARK_HEX_COLUMNS);
    return {
      column,
      index,
      row,
      x: column * horizontalSpacing,
      z: (row + (column % 2) * 0.5) * verticalSpacing,
    };
  });
  const centerX = (Math.min(...rawCells.map(({ x }) => x)) + Math.max(...rawCells.map(({ x }) => x))) / 2;
  const centerZ = (Math.min(...rawCells.map(({ z }) => z)) + Math.max(...rawCells.map(({ z }) => z))) / 2;

  return rawCells.map((cell) => ({
    ...cell,
    neighbors: resolveCellNeighbors(cell.column, cell.row),
    x: cell.x - centerX,
    z: cell.z - centerZ,
  }));
}

function resolveCellNeighbors(column: number, row: number): number[] {
  const offsets =
    column % 2 === 0
      ? [
          [-1, -1],
          [-1, 0],
          [0, -1],
          [0, 1],
          [1, -1],
          [1, 0],
        ]
      : [
          [-1, 0],
          [-1, 1],
          [0, -1],
          [0, 1],
          [1, 0],
          [1, 1],
        ];
  return offsets.flatMap(([columnOffset, rowOffset]) => {
    const neighborColumn = column + columnOffset;
    const neighborRow = row + rowOffset;
    if (
      neighborColumn < 0 ||
      neighborColumn >= BENCHMARK_HEX_COLUMNS ||
      neighborRow < 0 ||
      neighborRow >= BENCHMARK_HEX_ROWS
    ) {
      return [];
    }
    return [neighborRow * BENCHMARK_HEX_COLUMNS + neighborColumn];
  });
}

function createAgent(state: ProceduralCharacterBenchmarkSimulationState, id: number): BenchmarkAgentSimulationState {
  const currentCellIndex = id % BENCHMARK_HEX_COUNT;
  return {
    currentCellIndex,
    id,
    movementProgress: nextRandom(state),
    phase: "running",
    phaseElapsedSeconds: 0,
    speedFactor: 0.82 + nextRandom(state) * 0.36,
    targetCellIndex: selectNeighborCell(state, currentCellIndex),
  };
}

function advanceAgent(
  state: ProceduralCharacterBenchmarkSimulationState,
  agent: BenchmarkAgentSimulationState,
  config: ProceduralCharacterBenchmarkConfig,
  elapsedSeconds: number,
  events: ProceduralCharacterBenchmarkEvent[],
): void {
  if (agent.phase === "ragdoll") {
    agent.phaseElapsedSeconds += elapsedSeconds;
    if (agent.phaseElapsedSeconds >= config.corpseSeconds) respawnAgent(state, agent, events);
    return;
  }

  agent.movementProgress += elapsedSeconds * config.movementSpeed * agent.speedFactor;
  while (agent.movementProgress >= 1) {
    agent.movementProgress -= 1;
    agent.currentCellIndex = agent.targetCellIndex;
    agent.targetCellIndex = selectNeighborCell(state, agent.currentCellIndex);
  }
}

function scheduleDeaths(
  state: ProceduralCharacterBenchmarkSimulationState,
  config: ProceduralCharacterBenchmarkConfig,
  elapsedSeconds: number,
  events: ProceduralCharacterBenchmarkEvent[],
): void {
  if (config.deathsPerSecond <= 0) {
    state.deathAccumulator = 0;
    return;
  }
  state.deathAccumulator += elapsedSeconds * config.deathsPerSecond;
  while (state.deathAccumulator >= 1 && countRagdolls(state) < config.maxActiveRagdolls) {
    const agent = selectRunningAgent(state);
    if (!agent) break;
    state.deathAccumulator -= 1;
    startAgentDeath(state, agent, events);
  }
  state.deathAccumulator = Math.min(state.deathAccumulator, 1);
}

function startAgentDeath(
  state: ProceduralCharacterBenchmarkSimulationState,
  agent: BenchmarkAgentSimulationState,
  events: ProceduralCharacterBenchmarkEvent[],
): void {
  agent.phase = "ragdoll";
  agent.phaseElapsedSeconds = 0;
  state.totalDeaths += 1;
  events.push({ type: "death", agentId: agent.id });
}

function respawnAgent(
  state: ProceduralCharacterBenchmarkSimulationState,
  agent: BenchmarkAgentSimulationState,
  events: ProceduralCharacterBenchmarkEvent[],
): void {
  agent.phase = "running";
  agent.phaseElapsedSeconds = 0;
  agent.currentCellIndex = Math.floor(nextRandom(state) * BENCHMARK_HEX_COUNT);
  agent.targetCellIndex = selectNeighborCell(state, agent.currentCellIndex);
  agent.movementProgress = 0;
  state.totalRespawns += 1;
  events.push({ type: "respawn", agentId: agent.id });
}

function selectRunningAgent(
  state: ProceduralCharacterBenchmarkSimulationState,
): BenchmarkAgentSimulationState | undefined {
  if (state.agents.length === 0) return undefined;
  const startIndex = Math.floor(nextRandom(state) * state.agents.length);
  for (let offset = 0; offset < state.agents.length; offset += 1) {
    const agent = state.agents[(startIndex + offset) % state.agents.length];
    if (agent.phase === "running") return agent;
  }
  return undefined;
}

function selectNeighborCell(state: ProceduralCharacterBenchmarkSimulationState, cellIndex: number): number {
  const neighbors = BENCHMARK_HEX_CELLS[cellIndex].neighbors;
  return neighbors[Math.floor(nextRandom(state) * neighbors.length)] ?? cellIndex;
}

function countRagdolls(state: ProceduralCharacterBenchmarkSimulationState): number {
  return state.agents.reduce((count, agent) => count + Number(agent.phase === "ragdoll"), 0);
}

function resolveElapsedSeconds(value: number): number {
  return Number.isFinite(value) ? Math.min(Math.max(0, value), 0.1) : 0;
}

function normalizeRandomSeed(seed: number): number {
  return seed >>> 0 || 0x9e3779b9;
}

function nextRandom(state: ProceduralCharacterBenchmarkSimulationState): number {
  let value = state.randomState;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  state.randomState = value >>> 0 || 0x9e3779b9;
  return state.randomState / 0x1_0000_0000;
}
