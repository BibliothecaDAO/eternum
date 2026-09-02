import { DEV_MODE_ENABLED } from "@/utils/dev-mode";

import { CameraView } from "./camera-view";

export type WorldmapTextLabelTier = "full" | "priority" | "none";

/**
 * What each zoom band renders. The band (`CameraView`, resolved from the camera
 * distance) is the single gate: every manager reads this table instead of
 * deciding per surface.
 *
 * - near: everything.
 * - mid: models and FX, text only for priority entities, armies as tier glyphs.
 * - far: the strategic map — atlas icons and markers only; no models, no
 *   procedural characters, no FX, no text. Parked: wheel zoom-out stops at the
 *   top of the mid band until a map-mode key asks for this band.
 *
 * The whole-world biome surface is an underlay on every row, so no band shows
 * void beyond the composite window; page terrain sits above it where it exists.
 * Procedural army characters are off on every row while they are iterated on —
 * the legacy army models are the one representation; `?proceduralCharacters=1`
 * under dev mode re-enables them.
 */
export interface WorldmapContentLadder {
  readonly band: CameraView;
  readonly biomeUnderlay: boolean;
  readonly structureModels: boolean;
  readonly armyModels: boolean;
  readonly proceduralCharacters: boolean;
  readonly fx: boolean;
  readonly textLabels: WorldmapTextLabelTier;
  readonly armyTierGlyphs: boolean;
}

const PROCEDURAL_CHARACTERS_ENABLED = resolveProceduralCharactersOverride();

const NEAR_LADDER: WorldmapContentLadder = Object.freeze({
  band: CameraView.Close,
  biomeUnderlay: true,
  structureModels: true,
  armyModels: true,
  proceduralCharacters: PROCEDURAL_CHARACTERS_ENABLED,
  fx: true,
  textLabels: "full",
  armyTierGlyphs: false,
});

const MID_LADDER: WorldmapContentLadder = Object.freeze({
  band: CameraView.Medium,
  biomeUnderlay: true,
  structureModels: true,
  armyModels: true,
  proceduralCharacters: PROCEDURAL_CHARACTERS_ENABLED,
  fx: true,
  textLabels: "priority",
  armyTierGlyphs: true,
});

const FAR_LADDER: WorldmapContentLadder = Object.freeze({
  band: CameraView.Far,
  biomeUnderlay: true,
  structureModels: false,
  armyModels: false,
  proceduralCharacters: false,
  fx: false,
  textLabels: "none",
  armyTierGlyphs: false,
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
 * near: every label; far: none; mid: selected, hovered and under-attack always,
 * then own, allied and top-10 owners — spectators see only the first three.
 */
export function shouldShowTextLabel(
  tier: WorldmapTextLabelTier,
  entity: WorldmapLabelPriorityEntity,
  context: WorldmapLabelPriorityContext,
): boolean {
  if (tier === "full") return true;
  if (tier === "none") return false;
  if (isAlwaysLabelled(entity, context)) return true;
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

function isTopOwner(address: bigint | undefined, context: WorldmapLabelPriorityContext): boolean {
  const key = normalizeOwnerAddress(address);
  return key !== null && context.topOwnerAddresses.has(key);
}
