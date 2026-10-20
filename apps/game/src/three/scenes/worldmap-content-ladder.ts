import { DEV_MODE_ENABLED } from "@/utils/dev-mode";

import { CameraView } from "./camera-view";

/**
 * What each zoom band renders. The band (`CameraView`, resolved from the camera
 * distance) is the single gate: every manager reads this table instead of
 * deciding per surface.
 *
 * - near: everything.
 * - mid: models and FX, and every thing's label: its token, its plate when hovered or selected (map labels, the
 *   owner's plan D of 2026-10-19: "icons everywhere, full plate on hover").
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
  /** Every thing's label (its token, and its plate on hover or selection), and the map's other text labels. */
  readonly labels: boolean;
  readonly entityIcons: boolean;
}

const PROCEDURAL_CHARACTERS_ENABLED = resolveProceduralCharactersOverride();

const NEAR_LADDER: WorldmapContentLadder = Object.freeze({
  band: CameraView.Close,
  structureModels: true,
  armyModels: true,
  proceduralCharacters: PROCEDURAL_CHARACTERS_ENABLED,
  fx: true,
  labels: true,
  entityIcons: false,
});

const MID_LADDER: WorldmapContentLadder = Object.freeze({
  band: CameraView.Medium,
  structureModels: true,
  armyModels: true,
  proceduralCharacters: PROCEDURAL_CHARACTERS_ENABLED,
  fx: true,
  labels: true,
  entityIcons: false,
});

const FAR_LADDER: WorldmapContentLadder = Object.freeze({
  band: CameraView.Far,
  structureModels: false,
  armyModels: false,
  proceduralCharacters: false,
  fx: false,
  labels: false,
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
