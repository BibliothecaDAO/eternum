import { DEV_MODE_ENABLED } from "@/utils/dev-mode";

import { CameraView } from "./camera-view";

export type WorldmapTextLabelTier = "full" | "priority" | "none";

/**
 * What each zoom band renders. The band (`CameraView`, resolved from the camera
 * distance) is the single gate: every manager reads this table instead of
 * deciding per surface.
 *
 * - near: everything.
 * - mid: models and FX, plates only for priority entities.
 * - far: the strategic map — atlas icons and markers only; no models, no
 *   procedural characters, no FX, no text. Parked: wheel zoom-out stops at the
 *   top of the mid band until a map-mode key asks for this band.
 *
 * Camera pages and their loading fog remain visible in every band.
 * T1 knights use their production articulated model whenever army models are visible.
 * Other procedural families remain available through `?proceduralCharacters=1` under dev mode.
 */
export interface WorldmapContentLadder {
  readonly band: CameraView;
  readonly structureModels: boolean;
  readonly armyModels: boolean;
  readonly proceduralCharacters: boolean;
  readonly fx: boolean;
  readonly textLabels: WorldmapTextLabelTier;
  readonly entityIcons: boolean;
}

const PROCEDURAL_CHARACTERS_ENABLED = resolveProceduralCharactersOverride();

const NEAR_LADDER: WorldmapContentLadder = Object.freeze({
  band: CameraView.Close,
  structureModels: true,
  armyModels: true,
  proceduralCharacters: PROCEDURAL_CHARACTERS_ENABLED,
  fx: true,
  textLabels: "full",
  entityIcons: false,
});

const MID_LADDER: WorldmapContentLadder = Object.freeze({
  band: CameraView.Medium,
  structureModels: true,
  armyModels: true,
  proceduralCharacters: PROCEDURAL_CHARACTERS_ENABLED,
  fx: true,
  textLabels: "priority",
  entityIcons: false,
});

const FAR_LADDER: WorldmapContentLadder = Object.freeze({
  band: CameraView.Far,
  structureModels: false,
  armyModels: false,
  proceduralCharacters: false,
  fx: false,
  textLabels: "none",
  entityIcons: true,
});

function resolveProceduralCharactersOverride(): boolean {
  if (!DEV_MODE_ENABLED || typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("proceduralCharacters") === "1";
}

export function resolveWorldmapContentLadder(view: CameraView): WorldmapContentLadder {
  switch (view) {
    case CameraView.Close:
      return NEAR_LADDER;
    case CameraView.Far:
      return FAR_LADDER;
    case CameraView.Medium:
    default:
      return MID_LADDER;
  }
}

/** Facts the mid band needs to decide whether an entity keeps its text label. */
export interface WorldmapLabelPriorityContext {
  readonly isSpectator: boolean;
  /** Normalised (lower-case hex) addresses of the top-10 players. */
  readonly topOwnerAddresses: ReadonlySet<string>;
  readonly selectedEntityId: number | null;
  readonly hoveredEntityId: number | null;
}

export interface WorldmapLabelPriorityEntity {
  readonly entityId: number;
  readonly isMine: boolean;
  readonly isAlly: boolean;
  readonly ownerAddress: bigint | undefined;
  readonly underAttack: boolean;
}

export const EMPTY_LABEL_PRIORITY_CONTEXT: WorldmapLabelPriorityContext = Object.freeze({
  isSpectator: false,
  topOwnerAddresses: new Set<string>(),
  selectedEntityId: null,
  hoveredEntityId: null,
});

/**
 * near: every label; far: none; mid: selected, hovered and under-attack always, and what nobody owns (a hyperstructure,
 * camp or rift the world holds: what a player weighs an army against, for spectators too); then own, allied and top-10
 * owners. Spectators see only the first four.
 */
export function shouldShowTextLabel(
  tier: WorldmapTextLabelTier,
  entity: WorldmapLabelPriorityEntity,
  context: WorldmapLabelPriorityContext,
): boolean {
  if (tier === "full") return true;
  if (tier === "none") return false;
  if (isAlwaysLabelled(entity, context) || entity.ownerAddress === 0n) return true;
  if (context.isSpectator) return false;
  return entity.isMine || entity.isAlly || isTopOwner(entity.ownerAddress, context);
}

export function normalizeOwnerAddress(address: bigint | string | undefined): string | null {
  if (address === undefined) return null;
  const hex = typeof address === "bigint" ? address.toString(16) : address.replace(/^0x/i, "").toLowerCase();
  return hex.replace(/^0+/, "") || null;
}

function isAlwaysLabelled(entity: WorldmapLabelPriorityEntity, context: WorldmapLabelPriorityContext): boolean {
  return (
    entity.underAttack || entity.entityId === context.selectedEntityId || entity.entityId === context.hoveredEntityId
  );
}

/**
 * The top `count` players by points, over every player who owns a structure: a player with no points row has scored
 * nothing (PlayerPoints' declared absence), so ranks at 0, never out of the ranking. `ranked` is the leaderboard's
 * players by points; while it cannot rank (its scores not known yet) it is empty and every owner ranks at 0.
 */
export function topOwnerAddresses(
  ranked: readonly (readonly [bigint, number])[],
  owners: Iterable<bigint>,
  count: number,
): ReadonlySet<string> {
  const points = new Map<string, number>();
  for (const [address, score] of ranked) {
    const key = normalizeOwnerAddress(address);
    if (key) points.set(key, score);
  }
  for (const owner of owners) {
    const key = normalizeOwnerAddress(owner);
    if (key && !points.has(key)) points.set(key, 0);
  }
  return new Set(
    [...points]
      .toSorted((a, b) => b[1] - a[1])
      .slice(0, count)
      .map(([key]) => key),
  );
}

function isTopOwner(address: bigint | undefined, context: WorldmapLabelPriorityContext): boolean {
  const key = normalizeOwnerAddress(address);
  return key !== null && context.topOwnerAddresses.has(key);
}
