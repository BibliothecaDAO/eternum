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

const TAKE_BESIDE: HighlightLayerPalette = {
  routeColor: 0xffcb4c,
  endpointColor: 0xffe49a,
};

export const REALM_PLOT_PALETTE = {
  fill: 0x29b355,
  fillOpacity: 0.34,
  rim: 0x24994a,
  rimOpacity: 0.78,
  selectionRoute: 0x2ecc58,
  selectionEndpoint: 0x6ef292,
} as const;

export const REALM_PLOT_HOVER_PALETTE: HoverVisualPalette = {
  baseColor: REALM_PLOT_PALETTE.selectionRoute,
  rimColor: REALM_PLOT_PALETTE.selectionEndpoint,
  intensity: 0.55,
  visualMode: "fill",
};

export const HIGHLIGHT_LAYER_PALETTES: Record<string, HighlightLayerPalette> = {
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
    routeColor: REALM_PLOT_PALETTE.selectionRoute,
    endpointColor: REALM_PLOT_PALETTE.selectionEndpoint,
  },
  use_site: TAKE_BESIDE,
  create_army: {
    routeColor: 0x66d6ff,
    endpointColor: 0xb6ecff,
  },
  teach: {
    routeColor: 0xfff5d6,
    endpointColor: 0xfffdf5,
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
