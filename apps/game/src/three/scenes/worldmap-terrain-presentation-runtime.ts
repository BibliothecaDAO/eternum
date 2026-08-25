export type WorldmapTerrainPresentationKind = "exact" | "provisional";
export type WorldmapTerrainPresentationCoverageKind = "chunk" | "visual_page";
export type WorldmapVisualTerrainPageKey = `${number},${number}`;

interface WorldmapPointLike {
  x: number;
  z: number;
}

interface WorldmapTerrainSize {
  width: number;
  height: number;
}

interface WorldmapTerrainPageOrigin {
  col: number;
  row: number;
}

export interface WorldmapTerrainSourceCellRef {
  hexKey: string;
  biomeKey: string;
  instanceIndex: number;
}

export interface WorldmapTerrainCellRef extends WorldmapTerrainSourceCellRef {
  authoritative: boolean;
}

export interface WorldmapTerrainPresentation<TBiomeEntries = unknown, TBounds = unknown> {
  chunkKey: string;
  coverageKey?: string;
  coverageKind?: WorldmapTerrainPresentationCoverageKind;
  authorityChunkKey?: string | null;
  kind: WorldmapTerrainPresentationKind;
  generation?: number;
  transitionToken: number;
  bounds: TBounds;
  biomeEntries: TBiomeEntries;
  cells: WorldmapTerrainCellRef[];
  retainedUntilMs?: number;
}

export interface WorldmapComposedTerrainCellRef<
  TBiomeEntries = unknown,
  TBounds = unknown,
> extends WorldmapTerrainCellRef {
  coverageKey: string;
  coverageKind: WorldmapTerrainPresentationCoverageKind;
  presentationChunkKey: string;
  presentationKind: WorldmapTerrainPresentationKind;
  sourceInstanceIndex: number;
  sourcePresentation: WorldmapTerrainPresentation<TBiomeEntries, TBounds>;
}

export interface WorldmapTerrainComposite<TBiomeEntries = unknown, TBounds = unknown> {
  capped: boolean;
  cells: Array<WorldmapComposedTerrainCellRef<TBiomeEntries, TBounds>>;
  cellsByBiome: Map<string, Array<WorldmapComposedTerrainCellRef<TBiomeEntries, TBounds>>>;
  droppedCellCount: number;
  presentationChunkKeys: string[];
}

export interface WorldmapTerrainPresentationRuntimeState<TBiomeEntries = unknown, TBounds = unknown> {
  presentations: Array<WorldmapTerrainPresentation<TBiomeEntries, TBounds>>;
}

export interface WorldmapVisualTerrainWindow {
  centerPageKey: WorldmapVisualTerrainPageKey;
  criticalPageKeys: WorldmapVisualTerrainPageKey[];
  generation: number;
  pageKeys: WorldmapVisualTerrainPageKey[];
}

interface ComposeWorldmapTerrainPresentationsInput<TBiomeEntries, TBounds> {
  authoritativeChunkKey: string | null;
  maxCells: number;
  nowMs?: number;
  presentations: Array<WorldmapTerrainPresentation<TBiomeEntries, TBounds>>;
  targetCoverageKeys?: ReadonlySet<string>;
  targetChunkKey?: string | null;
}

interface ApplyWorldmapTerrainPresentationInput<TBiomeEntries, TBounds> extends Omit<
  ComposeWorldmapTerrainPresentationsInput<TBiomeEntries, TBounds>,
  "presentations"
> {
  latestTransitionToken: number;
  maxCompositeChunks: number;
  presentation: WorldmapTerrainPresentation<TBiomeEntries, TBounds>;
  presentations?: Array<WorldmapTerrainPresentation<TBiomeEntries, TBounds>>;
  retainPreviousExactUntilMs?: number;
}

interface ResolveWorldmapVisualTerrainWindowInput {
  focusPoint: WorldmapPointLike;
  generation: number;
  hexSize: number;
  marginPages: number;
  pageOrigin?: WorldmapTerrainPageOrigin;
  pageSize: WorldmapTerrainSize;
  renderSize: WorldmapTerrainSize;
}

interface PartitionPreparedTerrainIntoVisualPagesInput<TBiomeEntries, TBounds> {
  authorityChunkKey: string | null;
  biomeEntries: TBiomeEntries;
  bounds: TBounds;
  cells: WorldmapTerrainCellRef[];
  generation?: number;
  kind: WorldmapTerrainPresentationKind;
  pageOrigin?: WorldmapTerrainPageOrigin;
  pageSize: WorldmapTerrainSize;
  transitionToken: number;
}

interface ApplyWorldmapVisualTerrainPageInput<TBiomeEntries, TBounds> {
  authoritativeChunkKey?: string | null;
  latestGeneration: number;
  latestTransitionToken?: number;
  maxCells: number;
  maxCompositePages: number;
  nowMs?: number;
  presentation: WorldmapTerrainPresentation<TBiomeEntries, TBounds>;
  retainPreviousUntilMs?: number;
  targetCoverageKeys: ReadonlySet<string>;
}

type ApplyWorldmapTerrainPresentationResult<TBiomeEntries, TBounds> =
  | {
      status: "applied";
      composite: WorldmapTerrainComposite<TBiomeEntries, TBounds>;
    }
  | {
      status: "stale_dropped";
      composite: WorldmapTerrainComposite<TBiomeEntries, TBounds>;
    };

export function createWorldmapTerrainPresentationState<
  TBiomeEntries = unknown,
  TBounds = unknown,
>(): WorldmapTerrainPresentationRuntimeState<TBiomeEntries, TBounds> {
  return {
    presentations: [],
  };
}

export function composeWorldmapTerrainPresentations<TBiomeEntries = unknown, TBounds = unknown>(
  input: ComposeWorldmapTerrainPresentationsInput<TBiomeEntries, TBounds>,
): WorldmapTerrainComposite<TBiomeEntries, TBounds> {
  const cells: Array<WorldmapComposedTerrainCellRef<TBiomeEntries, TBounds>> = [];
  const cellsByBiome = new Map<string, Array<WorldmapComposedTerrainCellRef<TBiomeEntries, TBounds>>>();
  const seenHexKeys = new Set<string>();
  const biomeInstanceCounts = new Map<string, number>();
  const maxCells = Math.max(0, Math.floor(input.maxCells));
  let droppedCellCount = 0;

  for (const presentation of getPrioritizedWorldmapTerrainPresentations(input)) {
    for (const cell of presentation.cells) {
      if (seenHexKeys.has(cell.hexKey)) {
        continue;
      }

      if (cells.length >= maxCells) {
        droppedCellCount += 1;
        continue;
      }

      seenHexKeys.add(cell.hexKey);
      const nextInstanceIndex = biomeInstanceCounts.get(cell.biomeKey) ?? 0;
      biomeInstanceCounts.set(cell.biomeKey, nextInstanceIndex + 1);

      const composedCell: WorldmapComposedTerrainCellRef<TBiomeEntries, TBounds> = {
        ...cell,
        coverageKey: getTerrainPresentationCoverageKey(presentation),
        coverageKind: presentation.coverageKind ?? "chunk",
        instanceIndex: nextInstanceIndex,
        presentationChunkKey: presentation.chunkKey,
        presentationKind: presentation.kind,
        sourceInstanceIndex: cell.instanceIndex,
        sourcePresentation: presentation,
      };
      cells.push(composedCell);

      const biomeCells = cellsByBiome.get(cell.biomeKey) ?? [];
      biomeCells.push(composedCell);
      cellsByBiome.set(cell.biomeKey, biomeCells);
    }
  }

  return {
    capped: droppedCellCount > 0,
    cells,
    cellsByBiome,
    droppedCellCount,
    presentationChunkKeys: Array.from(new Set(cells.map((cell) => cell.presentationChunkKey))),
  };
}

export function resolveWorldmapVisualTerrainWindow(
  input: ResolveWorldmapVisualTerrainWindowInput,
): WorldmapVisualTerrainWindow {
  const focusHex = worldPointToHex(input.focusPoint, input.hexSize);
  const centerPage = resolveWorldmapVisualTerrainPageKeyForHex(focusHex, input.pageSize, input.pageOrigin);
  const pageColumns = Math.ceil(Math.max(1, input.renderSize.width) / Math.max(1, input.pageSize.width));
  const pageRows = Math.ceil(Math.max(1, input.renderSize.height) / Math.max(1, input.pageSize.height));
  const totalColumns = pageColumns + Math.max(0, input.marginPages) * 2;
  const totalRows = pageRows + Math.max(0, input.marginPages) * 2;
  const startColumnOffset = -Math.floor(totalColumns / 2) + (totalColumns % 2 === 0 ? 1 : 0);
  const startRowOffset = -Math.floor(totalRows / 2) + (totalRows % 2 === 0 ? 1 : 0);
  const pageKeys: WorldmapVisualTerrainPageKey[] = [];

  for (let rowOffset = startRowOffset; rowOffset < startRowOffset + totalRows; rowOffset += 1) {
    for (let columnOffset = startColumnOffset; columnOffset < startColumnOffset + totalColumns; columnOffset += 1) {
      pageKeys.push(
        `${centerPage.startRow + rowOffset * input.pageSize.height},${
          centerPage.startCol + columnOffset * input.pageSize.width
        }` as WorldmapVisualTerrainPageKey,
      );
    }
  }

  return {
    centerPageKey: centerPage.pageKey,
    criticalPageKeys: [centerPage.pageKey],
    generation: input.generation,
    pageKeys,
  };
}

export function partitionPreparedTerrainIntoVisualPages<TBiomeEntries = unknown, TBounds = unknown>(
  input: PartitionPreparedTerrainIntoVisualPagesInput<TBiomeEntries, TBounds>,
): Array<WorldmapTerrainPresentation<TBiomeEntries, TBounds>> {
  const cellsByPage = new Map<string, WorldmapTerrainCellRef[]>();
  const biomeCountsByPage = new Map<string, Map<string, number>>();

  input.cells.forEach((cell) => {
    const hex = parseHexKey(cell.hexKey);
    if (!hex) {
      return;
    }

    const page = resolveWorldmapVisualTerrainPageKeyForHex(hex, input.pageSize, input.pageOrigin);
    const pageCells = cellsByPage.get(page.pageKey) ?? [];
    const biomeCounts = biomeCountsByPage.get(page.pageKey) ?? new Map<string, number>();
    const nextInstanceIndex = biomeCounts.get(cell.biomeKey) ?? 0;
    biomeCounts.set(cell.biomeKey, nextInstanceIndex + 1);
    pageCells.push({
      ...cell,
      instanceIndex: nextInstanceIndex,
    });
    cellsByPage.set(page.pageKey, pageCells);
    biomeCountsByPage.set(page.pageKey, biomeCounts);
  });

  return Array.from(cellsByPage.entries())
    .sort(([leftKey], [rightKey]) => compareTerrainPageKeys(leftKey, rightKey))
    .map(([coverageKey, cells]) => ({
      authorityChunkKey: input.authorityChunkKey,
      biomeEntries: input.biomeEntries,
      bounds: input.bounds,
      cells,
      chunkKey: input.authorityChunkKey ?? coverageKey,
      coverageKey,
      coverageKind: "visual_page",
      generation: input.generation,
      kind: input.kind,
      transitionToken: input.transitionToken,
    }));
}

export function composeWorldmapVisualTerrainPresentations<TBiomeEntries = unknown, TBounds = unknown>(
  input: ComposeWorldmapTerrainPresentationsInput<TBiomeEntries, TBounds>,
): WorldmapTerrainComposite<TBiomeEntries, TBounds> {
  return composeWorldmapTerrainPresentations(input);
}

export function applyWorldmapVisualTerrainPage<TBiomeEntries = unknown, TBounds = unknown>(
  state: WorldmapTerrainPresentationRuntimeState<TBiomeEntries, TBounds>,
  input: ApplyWorldmapVisualTerrainPageInput<TBiomeEntries, TBounds>,
): ApplyWorldmapTerrainPresentationResult<TBiomeEntries, TBounds> {
  const coverageKey = getTerrainPresentationCoverageKey(input.presentation);
  if (input.presentation.generation !== undefined && input.presentation.generation !== input.latestGeneration) {
    return buildVisualTerrainStaleDropResult(state, input);
  }

  if (input.latestTransitionToken !== undefined && input.presentation.transitionToken !== input.latestTransitionToken) {
    return buildVisualTerrainStaleDropResult(state, input);
  }

  if (!input.targetCoverageKeys.has(coverageKey) && input.retainPreviousUntilMs === undefined) {
    return buildVisualTerrainStaleDropResult(state, input);
  }

  if (input.presentation.kind === "provisional" && hasExactPresentationForCoverage(state.presentations, coverageKey)) {
    return buildVisualTerrainStaleDropResult(state, input);
  }

  const nextPresentations = [
    ...state.presentations
      .filter((presentation) => getTerrainPresentationCoverageKey(presentation) !== coverageKey)
      .map((presentation) =>
        input.retainPreviousUntilMs === undefined
          ? presentation
          : {
              ...presentation,
              retainedUntilMs: input.retainPreviousUntilMs,
            },
      ),
    input.presentation,
  ];

  state.presentations = capTerrainPresentationsKeepingApplied(
    getPrioritizedWorldmapTerrainPresentations({
      authoritativeChunkKey: input.authoritativeChunkKey ?? null,
      nowMs: input.nowMs,
      presentations: nextPresentations,
      targetCoverageKeys: input.targetCoverageKeys,
    }),
    input.presentation,
    input.maxCompositePages,
  );

  return {
    status: "applied",
    composite: composeWorldmapVisualTerrainPresentations({
      authoritativeChunkKey: input.authoritativeChunkKey ?? null,
      maxCells: input.maxCells,
      nowMs: input.nowMs,
      presentations: state.presentations,
      targetCoverageKeys: input.targetCoverageKeys,
    }),
  };
}

function capTerrainPresentationsKeepingApplied<TBiomeEntries, TBounds>(
  prioritizedPresentations: Array<WorldmapTerrainPresentation<TBiomeEntries, TBounds>>,
  appliedPresentation: WorldmapTerrainPresentation<TBiomeEntries, TBounds>,
  maxPresentations: number,
): Array<WorldmapTerrainPresentation<TBiomeEntries, TBounds>> {
  const limit = Math.max(0, Math.floor(maxPresentations));
  if (prioritizedPresentations.length <= limit) {
    return prioritizedPresentations;
  }

  if (limit === 0) {
    return [];
  }

  const cappedPresentations = prioritizedPresentations.slice(0, limit);
  if (cappedPresentations.includes(appliedPresentation) || !prioritizedPresentations.includes(appliedPresentation)) {
    return cappedPresentations;
  }

  return [...cappedPresentations.slice(0, limit - 1), appliedPresentation];
}

export function applyWorldmapTerrainPresentation<TBiomeEntries = unknown, TBounds = unknown>(
  state: WorldmapTerrainPresentationRuntimeState<TBiomeEntries, TBounds>,
  input: ApplyWorldmapTerrainPresentationInput<TBiomeEntries, TBounds>,
): ApplyWorldmapTerrainPresentationResult<TBiomeEntries, TBounds> {
  if (input.presentation.transitionToken !== input.latestTransitionToken) {
    return {
      status: "stale_dropped",
      composite: composeWorldmapTerrainPresentations({
        ...input,
        presentations: state.presentations,
      }),
    };
  }

  state.presentations = resolveNextTerrainPresentations(state.presentations, input);
  state.presentations = getPrioritizedWorldmapTerrainPresentations({
    ...input,
    presentations: state.presentations,
  }).slice(0, input.maxCompositeChunks);

  return {
    status: "applied",
    composite: composeWorldmapTerrainPresentations({
      ...input,
      presentations: state.presentations,
    }),
  };
}

export function getPrioritizedWorldmapTerrainPresentations<TBiomeEntries = unknown, TBounds = unknown>(
  input: Omit<ComposeWorldmapTerrainPresentationsInput<TBiomeEntries, TBounds>, "maxCells">,
): Array<WorldmapTerrainPresentation<TBiomeEntries, TBounds>> {
  return input.presentations
    .filter((presentation) => !isTerrainPresentationExpired(presentation, input.nowMs))
    .map((presentation, index) => ({
      index,
      presentation,
      priority: getTerrainPresentationPriority(
        presentation,
        input.authoritativeChunkKey,
        input.targetChunkKey,
        input.targetCoverageKeys,
      ),
    }))
    .sort((left, right) => left.priority - right.priority || left.index - right.index)
    .map((entry) => entry.presentation);
}

function resolveNextTerrainPresentations<TBiomeEntries, TBounds>(
  presentations: Array<WorldmapTerrainPresentation<TBiomeEntries, TBounds>>,
  input: ApplyWorldmapTerrainPresentationInput<TBiomeEntries, TBounds>,
): Array<WorldmapTerrainPresentation<TBiomeEntries, TBounds>> {
  const presentationIsAuthoritative = input.presentation.cells.some((cell) => cell.authoritative);
  if (!presentationIsAuthoritative) {
    return [
      ...presentations.filter(
        (presentation) =>
          presentation.chunkKey !== input.presentation.chunkKey || presentation.kind !== input.presentation.kind,
      ),
      input.presentation,
    ];
  }

  const retainedUntilMs = input.retainPreviousExactUntilMs;
  const retainedPresentations = presentations
    .filter((presentation) => presentation.chunkKey !== input.presentation.chunkKey)
    .map((presentation) => demoteAuthoritativeTerrainPresentation(presentation, retainedUntilMs));

  return [...retainedPresentations, input.presentation];
}

function demoteAuthoritativeTerrainPresentation<TBiomeEntries, TBounds>(
  presentation: WorldmapTerrainPresentation<TBiomeEntries, TBounds>,
  retainedUntilMs: number | undefined,
): WorldmapTerrainPresentation<TBiomeEntries, TBounds> {
  return {
    ...presentation,
    retainedUntilMs,
    cells: presentation.cells.map((cell) => ({
      ...cell,
      authoritative: false,
    })),
  };
}

function isTerrainPresentationExpired(
  presentation: WorldmapTerrainPresentation<unknown, unknown>,
  nowMs: number | undefined,
): boolean {
  return nowMs !== undefined && presentation.retainedUntilMs !== undefined && presentation.retainedUntilMs <= nowMs;
}

function getTerrainPresentationPriority(
  presentation: WorldmapTerrainPresentation<unknown, unknown>,
  authoritativeChunkKey: string | null,
  targetChunkKey: string | null | undefined,
  targetCoverageKeys?: ReadonlySet<string>,
): number {
  const coverageKey = getTerrainPresentationCoverageKey(presentation);
  const authorityChunkKey = presentation.authorityChunkKey ?? presentation.chunkKey;
  const targetsCoverage = targetCoverageKeys?.has(coverageKey) ?? false;

  if (authorityChunkKey === authoritativeChunkKey && presentation.cells.some((cell) => cell.authoritative)) {
    return 0;
  }

  if ((targetChunkKey && authorityChunkKey === targetChunkKey) || (targetsCoverage && presentation.kind === "exact")) {
    return 1;
  }

  if (targetsCoverage && presentation.kind === "provisional") {
    return 2;
  }

  if (presentation.kind === "exact") {
    return 3;
  }

  return 4;
}

function buildVisualTerrainStaleDropResult<TBiomeEntries, TBounds>(
  state: WorldmapTerrainPresentationRuntimeState<TBiomeEntries, TBounds>,
  input: ApplyWorldmapVisualTerrainPageInput<TBiomeEntries, TBounds>,
): ApplyWorldmapTerrainPresentationResult<TBiomeEntries, TBounds> {
  return {
    status: "stale_dropped",
    composite: composeWorldmapVisualTerrainPresentations({
      authoritativeChunkKey: input.authoritativeChunkKey ?? null,
      maxCells: input.maxCells,
      nowMs: input.nowMs,
      presentations: state.presentations,
      targetCoverageKeys: input.targetCoverageKeys,
    }),
  };
}

function hasExactPresentationForCoverage(
  presentations: Array<WorldmapTerrainPresentation<unknown, unknown>>,
  coverageKey: string,
): boolean {
  return presentations.some(
    (presentation) => getTerrainPresentationCoverageKey(presentation) === coverageKey && presentation.kind === "exact",
  );
}

function getTerrainPresentationCoverageKey(presentation: WorldmapTerrainPresentation<unknown, unknown>): string {
  return presentation.coverageKey ?? presentation.chunkKey;
}

export function resolveWorldmapVisualTerrainPageKeyForHex(
  hex: { col: number; row: number },
  pageSize: WorldmapTerrainSize,
  pageOrigin: WorldmapTerrainPageOrigin = { col: 0, row: 0 },
): { pageKey: WorldmapVisualTerrainPageKey; startCol: number; startRow: number } {
  const pageWidth = Math.max(1, Math.floor(pageSize.width));
  const pageHeight = Math.max(1, Math.floor(pageSize.height));
  const startCol = Math.floor((hex.col - pageOrigin.col) / pageWidth) * pageWidth + pageOrigin.col;
  const startRow = Math.floor((hex.row - pageOrigin.row) / pageHeight) * pageHeight + pageOrigin.row;
  return {
    pageKey: `${startRow},${startCol}` as WorldmapVisualTerrainPageKey,
    startCol,
    startRow,
  };
}

function worldPointToHex(point: WorldmapPointLike, hexSize: number): { col: number; row: number } {
  const horizontalDistance = Math.sqrt(3) * hexSize;
  const verticalDistance = 1.5 * hexSize;
  const epsilon = 1e-12;
  const estimatedRow = Math.round(point.z / verticalDistance);
  const estimatedOffset = getRowOffset(estimatedRow, horizontalDistance);
  const estimatedCol = Math.round((point.x + estimatedOffset) / horizontalDistance);
  const originX = estimatedCol * horizontalDistance - estimatedOffset;
  const originZ = estimatedRow * verticalDistance;
  const localPointX = point.x - originX;
  const localPointZ = point.z - originZ;

  let bestRow = estimatedRow;
  let bestCol = estimatedCol;
  let bestDistanceSquared = Number.POSITIVE_INFINITY;

  for (let row = estimatedRow - 1; row <= estimatedRow + 1; row += 1) {
    const rowOffset = getRowOffset(row, horizontalDistance);
    const nearestColForRow = Math.round((point.x + rowOffset) / horizontalDistance);
    const localCenterZ = (row - estimatedRow) * verticalDistance;

    for (let col = nearestColForRow - 1; col <= nearestColForRow + 1; col += 1) {
      const localCenterX = (col - estimatedCol) * horizontalDistance - (rowOffset - estimatedOffset);
      const dx = localPointX - localCenterX;
      const dz = localPointZ - localCenterZ;
      const distanceSquared = dx * dx + dz * dz;

      if (
        distanceSquared < bestDistanceSquared - epsilon ||
        (Math.abs(distanceSquared - bestDistanceSquared) <= epsilon &&
          (row < bestRow || (row === bestRow && col < bestCol)))
      ) {
        bestDistanceSquared = distanceSquared;
        bestRow = row;
        bestCol = col;
      }
    }
  }

  return { col: bestCol, row: bestRow };
}

function getRowOffset(row: number, horizontalDistance: number): number {
  return ((row % 2) * Math.sign(row) * horizontalDistance) / 2;
}

function parseHexKey(hexKey: string): { col: number; row: number } | null {
  const [col, row] = hexKey.split(",").map(Number);
  if (!Number.isFinite(col) || !Number.isFinite(row)) {
    return null;
  }
  return { col, row };
}

function compareTerrainPageKeys(leftKey: string, rightKey: string): number {
  const left = parsePageKey(leftKey);
  const right = parsePageKey(rightKey);
  return left.startRow - right.startRow || left.startCol - right.startCol;
}

function parsePageKey(pageKey: string): { startRow: number; startCol: number } {
  const [startRow, startCol] = pageKey.split(",").map(Number);
  return {
    startRow: Number.isFinite(startRow) ? startRow : 0,
    startCol: Number.isFinite(startCol) ? startCol : 0,
  };
}
