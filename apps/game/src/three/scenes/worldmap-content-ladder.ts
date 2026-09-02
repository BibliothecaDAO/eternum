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
 *   procedural characters, no FX, no text.
 */
export interface WorldmapContentLadder {
  readonly band: CameraView;
  readonly structureModels: boolean;
  readonly armyModels: boolean;
  readonly proceduralCharacters: boolean;
  readonly fx: boolean;
  readonly textLabels: WorldmapTextLabelTier;
  readonly armyTierGlyphs: boolean;
}

const NEAR_LADDER: WorldmapContentLadder = Object.freeze({
  band: CameraView.Close,
  structureModels: true,
  armyModels: true,
  proceduralCharacters: true,
  fx: true,
  textLabels: "full",
  armyTierGlyphs: false,
});

const MID_LADDER: WorldmapContentLadder = Object.freeze({
  band: CameraView.Medium,
  structureModels: true,
  armyModels: true,
  proceduralCharacters: true,
  fx: true,
  textLabels: "priority",
  armyTierGlyphs: true,
});

const FAR_LADDER: WorldmapContentLadder = Object.freeze({
  band: CameraView.Far,
  structureModels: false,
  armyModels: false,
  proceduralCharacters: false,
  fx: false,
  textLabels: "none",
  armyTierGlyphs: false,
});

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
