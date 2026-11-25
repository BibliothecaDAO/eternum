import type { ActionType } from "@bibliothecadao/eternum";
import type { BiomeType } from "@bibliothecadao/types";
import { Color, SRGBColorSpace } from "three";
import { requireBiomeColor } from "./biome-colors";

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

type Rgba = readonly [number, number, number, number];

export interface PlotLook {
  fill: Rgba;
  rim: Rgba;
  lit: HighlightLayerPalette;
  hover: HoverVisualPalette;
}

const shade = (ground: Color, toward: number, amount: number): Color => {
  const { r, g, b } = ground.getRGB({ r: 0, g: 0, b: 0 }, SRGBColorSpace);
  const mix = (channel: number) => channel + (toward - channel) * amount;
  return new Color().setRGB(mix(r), mix(g), mix(b), SRGBColorSpace);
};

export function plotLookOn(biome: BiomeType): PlotLook {
  const ground = requireBiomeColor(biome);
  const { r, g, b } = ground.getRGB({ r: 0, g: 0, b: 0 }, SRGBColorSpace);
  const light = 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6;
  const toward = light ? 0 : 1;
  const fill = shade(ground, toward, 0.3);
  const rim = shade(ground, toward, light ? 0.45 : 0.65);
  const lit = shade(ground, toward, light ? 0.6 : 0.85);
  return {
    fill: [fill.r, fill.g, fill.b, 0.3],
    rim: [rim.r, rim.g, rim.b, 1],
    lit: { routeColor: rim.getHex(), endpointColor: lit.getHex() },
    hover: { baseColor: rim.getHex(), rimColor: lit.getHex(), intensity: 0.55, visualMode: "fill" },
  };
}

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
