import type { ActiveTransferData } from "@bibliothecadao/torii";

export interface TransferRouteOverlayHex {
  col: number;
  row: number;
}

export interface TransferRouteOverlayRoute {
  id: string;
  kind: "live" | "planned";
  sourceEntityId: number;
  destinationEntityId: number;
  sourceHex: TransferRouteOverlayHex;
  destinationHex: TransferRouteOverlayHex;
  resourceIds: number[];
  startedAtMs?: number;
  endsAtMs?: number;
  progress?: number;
}

interface TransferRouteStoryEvent {
  event_id?: string | null;
  id?: string | null;
  tx_hash?: string | null;
  story?: string | null;
  timestamp?: string | number | bigint | null;
  timestampMs?: number;
  resource_transfer_from_entity_id?: string | number | bigint | null;
  resource_transfer_to_entity_id?: string | number | bigint | null;
  resource_transfer_resources?: unknown;
  resource_transfer_travel_time?: string | number | bigint | null;
  resource_transfer_is_mint?: boolean | string | number | null;
}

interface TransferAutomationRouteEntry {
  id: string;
  active: boolean;
  sourceEntityId: string | number | bigint;
  destinationEntityId: string | number | bigint;
  resourceIds: number[];
  resourceConfigs?: Array<{ resourceId: number; amount: number }>;
  intervalMinutes: number;
}

interface BuildTransferRouteOverlayRoutesInput {
  currentTimeMs: number;
  liveEvents: TransferRouteStoryEvent[];
  automationEntries: TransferAutomationRouteEntry[];
  resolveEntityHex: (entityId: number) => TransferRouteOverlayHex | null;
  maxRoutes?: number;
}

interface BuildTransferRouteOverlayRoutesFromActiveTransfersInput {
  currentTimeMs: number;
  liveTransfers: ActiveTransferData[];
  automationEntries: TransferAutomationRouteEntry[];
  resolveEntityHex: (entityId: number) => TransferRouteOverlayHex | null;
  maxRoutes?: number;
}

const DEFAULT_MAX_TRANSFER_ROUTE_OVERLAY_ROUTES = 96;

export function parseTransferRouteResourceIds(raw: unknown): number[] {
  const parsed = parseMaybeJson(raw);
  const resourceCandidates = resolveTransferResourceCandidates(parsed);
  const resourceIds = resourceCandidates
    .map(resolveResourceId)
    .filter((resourceId): resourceId is number => resourceId !== null);

  return Array.from(new Set(resourceIds));
}

export function buildTransferRouteOverlayRoutes(
  input: BuildTransferRouteOverlayRoutesInput,
): TransferRouteOverlayRoute[] {
  const liveRoutes = input.liveEvents
    .map((event) => buildLiveTransferRoute(event, input))
    .filter((route): route is TransferRouteOverlayRoute => route !== null);
  const plannedRoutes = input.automationEntries
    .map((entry) => buildPlannedTransferRoute(entry, input.resolveEntityHex))
    .filter((route): route is TransferRouteOverlayRoute => route !== null);

  return [...liveRoutes, ...plannedRoutes]
    .toSorted(compareTransferRoutes)
    .slice(0, input.maxRoutes ?? DEFAULT_MAX_TRANSFER_ROUTE_OVERLAY_ROUTES);
}

export function buildTransferRouteOverlayRoutesFromActiveTransfers(
  input: BuildTransferRouteOverlayRoutesFromActiveTransfersInput,
): TransferRouteOverlayRoute[] {
  const liveRoutes = input.liveTransfers
    .map((transfer) => buildLiveTransferRouteFromActiveTransfer(transfer, input))
    .filter((route): route is TransferRouteOverlayRoute => route !== null);
  const plannedRoutes = input.automationEntries
    .map((entry) => buildPlannedTransferRoute(entry, input.resolveEntityHex))
    .filter((route): route is TransferRouteOverlayRoute => route !== null);

  return [...liveRoutes, ...plannedRoutes]
    .toSorted(compareTransferRoutes)
    .slice(0, input.maxRoutes ?? DEFAULT_MAX_TRANSFER_ROUTE_OVERLAY_ROUTES);
}

function buildLiveTransferRoute(
  event: TransferRouteStoryEvent,
  input: BuildTransferRouteOverlayRoutesInput,
): TransferRouteOverlayRoute | null {
  if (event.story !== undefined && event.story !== "ResourceTransferStory") {
    return null;
  }

  if (isMintTransfer(event.resource_transfer_is_mint)) {
    return null;
  }

  const sourceEntityId = parsePositiveInteger(event.resource_transfer_from_entity_id);
  const destinationEntityId = parsePositiveInteger(event.resource_transfer_to_entity_id);
  const startedAtMs = parseEventTimestampMs(event);
  const travelTimeMs = parseDurationMs(event.resource_transfer_travel_time);
  const resourceIds = parseTransferRouteResourceIds(event.resource_transfer_resources);

  if (
    sourceEntityId === null ||
    destinationEntityId === null ||
    startedAtMs === null ||
    travelTimeMs === null ||
    resourceIds.length === 0
  ) {
    return null;
  }

  const endsAtMs = startedAtMs + travelTimeMs;
  if (input.currentTimeMs >= endsAtMs) {
    return null;
  }

  const sourceHex = input.resolveEntityHex(sourceEntityId);
  const destinationHex = input.resolveEntityHex(destinationEntityId);
  if (!sourceHex || !destinationHex) {
    return null;
  }

  return {
    id: `live:${resolveLiveRouteId(event, sourceEntityId, destinationEntityId, startedAtMs)}`,
    kind: "live",
    sourceEntityId,
    destinationEntityId,
    sourceHex,
    destinationHex,
    resourceIds,
    startedAtMs,
    endsAtMs,
    progress: clampProgress((input.currentTimeMs - startedAtMs) / travelTimeMs),
  };
}

function buildPlannedTransferRoute(
  entry: TransferAutomationRouteEntry,
  resolveEntityHex: BuildTransferRouteOverlayRoutesInput["resolveEntityHex"],
): TransferRouteOverlayRoute | null {
  if (!entry.active) {
    return null;
  }

  const sourceEntityId = parsePositiveInteger(entry.sourceEntityId);
  const destinationEntityId = parsePositiveInteger(entry.destinationEntityId);
  const resourceIds = resolveAutomationResourceIds(entry);
  if (!sourceEntityId || !destinationEntityId || resourceIds.length === 0) {
    return null;
  }

  const sourceHex = resolveEntityHex(sourceEntityId);
  const destinationHex = resolveEntityHex(destinationEntityId);
  if (!sourceHex || !destinationHex) {
    return null;
  }

  return {
    id: `planned:${entry.id}`,
    kind: "planned",
    sourceEntityId,
    destinationEntityId,
    sourceHex,
    destinationHex,
    resourceIds,
  };
}

function buildLiveTransferRouteFromActiveTransfer(
  transfer: ActiveTransferData,
  input: BuildTransferRouteOverlayRoutesFromActiveTransfersInput,
): TransferRouteOverlayRoute | null {
  const sourceHex = input.resolveEntityHex(transfer.sourceEntityId);
  const destinationHex = input.resolveEntityHex(transfer.destinationEntityId);
  if (!sourceHex || !destinationHex) {
    return null;
  }

  if (input.currentTimeMs >= transfer.endsAtMs) {
    return null;
  }

  const durationMs = transfer.endsAtMs - transfer.startedAtMs;
  const progress = durationMs > 0 ? clampProgress((input.currentTimeMs - transfer.startedAtMs) / durationMs) : 1;

  return {
    id: transfer.id,
    kind: "live",
    sourceEntityId: transfer.sourceEntityId,
    destinationEntityId: transfer.destinationEntityId,
    sourceHex,
    destinationHex,
    resourceIds: transfer.resourceIds,
    startedAtMs: transfer.startedAtMs,
    endsAtMs: transfer.endsAtMs,
    progress,
  };
}

function resolveAutomationResourceIds(entry: TransferAutomationRouteEntry): number[] {
  const configuredIds = entry.resourceConfigs?.map((resource) => resource.resourceId) ?? entry.resourceIds;
  return Array.from(new Set(configuredIds.filter((resourceId) => Number.isFinite(resourceId) && resourceId > 0)));
}

function parseMaybeJson(raw: unknown): unknown {
  if (typeof raw !== "string") {
    return raw;
  }

  const trimmed = raw.trim();
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) {
    return raw;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return raw;
  }
}

function resolveTransferResourceCandidates(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (parsed && typeof parsed === "object") {
    const candidate = parsed as { resource?: unknown; resourceId?: unknown };
    return candidate.resourceId !== undefined || candidate.resource !== undefined
      ? [parsed]
      : Object.values(parsed as Record<string, unknown>);
  }

  return [];
}

function resolveResourceId(entry: unknown): number | null {
  if (Array.isArray(entry)) {
    return parsePositiveInteger(entry[0]);
  }

  if (!entry || typeof entry !== "object") {
    return null;
  }

  const candidate = entry as { resource?: unknown; resourceId?: unknown };
  return parsePositiveInteger(candidate.resourceId ?? candidate.resource);
}

function isMintTransfer(value: TransferRouteStoryEvent["resource_transfer_is_mint"]): boolean {
  if (value === true || value === 1) {
    return true;
  }

  if (typeof value === "string") {
    return value.toLowerCase() === "true" || value === "1";
  }

  return false;
}

function parsePositiveInteger(value: unknown): number | null {
  const parsed = parseFiniteNumber(value);
  if (parsed === null) {
    return null;
  }

  const integer = Math.floor(parsed);
  return integer > 0 ? integer : null;
}

function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.startsWith("0x")) {
    return Number(BigInt(trimmed));
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseEventTimestampMs(event: TransferRouteStoryEvent): number | null {
  if (typeof event.timestampMs === "number" && Number.isFinite(event.timestampMs)) {
    return event.timestampMs;
  }

  const timestampSeconds = parseFiniteNumber(event.timestamp);
  return timestampSeconds === null ? null : timestampSeconds * 1000;
}

function parseDurationMs(value: unknown): number | null {
  const seconds = parseFiniteNumber(value);
  if (seconds === null || seconds <= 0) {
    return null;
  }

  return seconds * 1000;
}

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) {
    return 0;
  }

  return Math.max(0, Math.min(progress, 1));
}

function resolveLiveRouteId(
  event: TransferRouteStoryEvent,
  sourceEntityId: number,
  destinationEntityId: number,
  startedAtMs: number,
): string {
  return event.event_id ?? event.id ?? event.tx_hash ?? `${sourceEntityId}-${destinationEntityId}-${startedAtMs}`;
}

function compareTransferRoutes(left: TransferRouteOverlayRoute, right: TransferRouteOverlayRoute): number {
  if (left.kind !== right.kind) {
    return left.kind === "live" ? -1 : 1;
  }

  if (left.kind === "live" && right.kind === "live") {
    return (right.progress ?? 0) - (left.progress ?? 0);
  }

  return left.id.localeCompare(right.id);
}
