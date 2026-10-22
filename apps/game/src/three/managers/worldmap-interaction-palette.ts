import type { ActionType } from "@bibliothecadao/eternum";

export type WorldmapHoverVisualMode = "fill" | "outline";

export interface HighlightLayerPalette {
  routeColor: number;
  endpointColor: number;
}

export interface HoverVisualPalette {
  baseColor: number;
  rimColor: number;
  intensity: number;
  visualMode: WorldmapHoverVisualMode;
}

/** Through a spire: the Blitz portal's travel, and a Frontier army's way into its realm's depths. */
const SPIRE: HighlightLayerPalette = {
  routeColor: 0x2dd4bf,
  endpointColor: 0x99f6e4,
};

const HIGHLIGHT_LAYER_PALETTES: Record<string, HighlightLayerPalette> = {
  move: {
    routeColor: 0x4fcf6b,
    endpointColor: 0xaef7b6,
  },
  explore: {
    routeColor: 0x4de3ff,
    endpointColor: 0x84f1ff,
  },
  attack: {
    routeColor: 0xff6b3d,
    endpointColor: 0xffab8a,
  },
  spire_travel: SPIRE,
  enter_depth: SPIRE,
  help: {
    routeColor: 0xe36cff,
    endpointColor: 0xf7bbff,
  },
  build: {
    routeColor: 0xd3a746,
    endpointColor: 0xf0d08a,
  },
  chest: {
    routeColor: 0xffcb4c,
    endpointColor: 0xffe49a,
  },
  create_army: {
    routeColor: 0x66d6ff,
    endpointColor: 0xb6ecff,
  },
};

const HOVER_SELECTOR_BASE_COLOR = 0xff4fd8;
const HOVER_SELECTOR_RIM_COLOR = 0xffb3f5;

const GENERIC_HOVER_PALETTE: HoverVisualPalette = {
  baseColor: HOVER_SELECTOR_BASE_COLOR,
  rimColor: HOVER_SELECTOR_RIM_COLOR,
  intensity: 0.32,
  visualMode: "fill",
};

/** A player's holdings wear the plain hover ring at rest, the ring players already read as "this hex". */
export const OWNERSHIP_RING_LOOK = {
  color: GENERIC_HOVER_PALETTE.rimColor,
  intensity: GENERIC_HOVER_PALETTE.intensity,
} as const;

export function resolveHighlightLayerPalette(
  actionType: ActionType | string | null | undefined,
): HighlightLayerPalette {
  return HIGHLIGHT_LAYER_PALETTES[actionType ?? "create_army"] ?? HIGHLIGHT_LAYER_PALETTES.create_army;
}

export function resolveHoverVisualPalette(params: {
  hasSelection: boolean;
  actionType?: ActionType | string | null;
}): HoverVisualPalette {
  if (params.hasSelection && params.actionType) {
    return {
      baseColor: HOVER_SELECTOR_BASE_COLOR,
      rimColor: HOVER_SELECTOR_RIM_COLOR,
      intensity: 0.48,
      visualMode: "fill",
    };
  }

  return GENERIC_HOVER_PALETTE;
}
