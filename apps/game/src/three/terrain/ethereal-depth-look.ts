import { Color, Vector3 } from "three";
import { uniform } from "three/tsl";
import type { TimeOfDayColors } from "../effects/world-atmosphere-presets";

export type EtherealDepth = 1 | 2 | 3;

/** How one Ethereal depth reads: its slabs, gameplay borders, energy threads, mist and light. */
interface EtherealDepthLook {
  /** Multiplies the near-black basalt slabs. */
  slabTint: readonly [number, number, number];
  /** The energy threads that run along the mist's contours. */
  energyEdge: string;
  energyGlow: string;
  /** The gameplay borders lean from their mixed neon toward this colour by `borderMix`. */
  borderTint: string;
  borderMix: number;
  /** The mist over unexplored slabs: its colour, how much light it carries and how fast it drifts. */
  mistColor: string;
  /** The colour of the light the mist's wisps carry. */
  mistTint: string;
  mistLight: number;
  mistDrift: number;
  /** Replaces the Ethereal night's light; depth I keeps it. */
  light?: Partial<TimeOfDayColors>;
}

/** Depth I is the Ethereal as it shipped; each depth below is colder, then hotter and thicker: stranger the deeper. */
export const ETHEREAL_DEPTH_LOOKS: Readonly<Record<EtherealDepth, EtherealDepthLook>> = Object.freeze({
  1: {
    slabTint: [1, 1, 1],
    energyEdge: "#ff4fd8",
    energyGlow: "#ff92ea",
    borderTint: "#ff4fd8",
    borderMix: 0,
    mistColor: "#111318",
    mistTint: "#ffffff",
    mistLight: 0.065,
    mistDrift: 1,
  },
  2: {
    slabTint: [1.25, 2.1, 2.9],
    energyEdge: "#2fd6ff",
    energyGlow: "#a4f6ff",
    borderTint: "#27b9ff",
    borderMix: 0.8,
    mistColor: "#0a1c26",
    mistTint: "#6fe3ff",
    mistLight: 0.5,
    mistDrift: 0.55,
    light: {
      skyColor: 0x0c2a3a,
      groundColor: 0x041018,
      sunColor: 0x7fd2ff,
      ambientColor: 0x3d7c9c,
      fogColor: 0x0b2230,
      sunIntensity: 1.1,
      hemisphereIntensity: 0.9,
      ambientIntensity: 0.55,
    },
  },
  3: {
    slabTint: [3.4, 1.3, 1.9],
    energyEdge: "#ff3a24",
    energyGlow: "#ffb25e",
    borderTint: "#ff2a10",
    borderMix: 0.85,
    mistColor: "#1e0810",
    mistTint: "#ff6a4a",
    mistLight: 0.7,
    mistDrift: 1.9,
    light: {
      skyColor: 0x2a0812,
      groundColor: 0x12040a,
      sunColor: 0xff6a3d,
      ambientColor: 0x7a2a4c,
      fogColor: 0x2a0a14,
      sunIntensity: 0.95,
      hemisphereIntensity: 0.7,
      ambientIntensity: 0.6,
    },
  },
});

/** Shared by every Ethereal material, so a depth change costs uniform writes, not a new shader. */
export const etherealDepthUniforms = {
  slabTint: uniform(new Vector3(1, 1, 1)),
  energyEdge: uniform(new Color()),
  energyGlow: uniform(new Color()),
  borderTint: uniform(new Color()),
  borderMix: uniform(0),
  mistColor: uniform(new Color()),
  mistTint: uniform(new Color()),
  mistLight: uniform(0),
  mistDrift: uniform(1),
};

export function applyEtherealDepthLook(depth: EtherealDepth): void {
  const look = ETHEREAL_DEPTH_LOOKS[depth];
  const target = etherealDepthUniforms;
  target.slabTint.value.set(...look.slabTint);
  target.energyEdge.value.set(look.energyEdge);
  target.energyGlow.value.set(look.energyGlow);
  target.borderTint.value.set(look.borderTint);
  target.borderMix.value = look.borderMix;
  target.mistColor.value.set(look.mistColor);
  target.mistTint.value.set(look.mistTint);
  target.mistLight.value = look.mistLight;
  target.mistDrift.value = look.mistDrift;
}

applyEtherealDepthLook(1);
