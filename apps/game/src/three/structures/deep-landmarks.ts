import type { deepSites } from "@bibliothecadao/types";
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  OctahedronGeometry,
  TorusGeometry,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { DEEP_PALETTE } from "../terrain/deep-floor-material";

type DeepSiteKey = (typeof deepSites)[number]["key"];
type Surface = "stone" | "trim" | "base" | "glow";
type Parts = Partial<Record<Surface, BufferGeometry[]>>;

const LANDMARK_SCALE = 1.8;
const PRECINCT_RADIUS = 0.98;
const GLOW_INTENSITY = 2.2;
const DORMANT_SATURATION = 0.15;

const LANDMARK_LOOKS = {
  foundation: { stone: DEEP_PALETTE.ivory, trim: DEEP_PALETTE.gold, base: "#2a3352", glow: DEEP_PALETTE.gold },
  core: { stone: DEEP_PALETTE.ivory, trim: DEEP_PALETTE.gold, base: "#2a3352", glow: "#9fd2f5" },
  mine: { stone: "#4a3a8c", trim: "#7b5ad6", base: "#2a3352", glow: "#b89bff" },
  altar: { stone: "#231a2c", trim: "#3a2533", base: "#160f1c", glow: "#ff4f7b" },
} as const satisfies Record<DeepSiteKey, Record<Surface, string>>;

const LANDMARK_PARTS = {
  foundation: archive,
  core: essenceCore,
  mine: etherealMine,
  altar: baneAltar,
} as const satisfies Record<DeepSiteKey, () => Parts>;

export function deepLandmark(key: DeepSiteKey, activation: number): { scene: Group; animations: [] } {
  const look = activated(LANDMARK_LOOKS[key], activation);
  const parts = LANDMARK_PARTS[key]();
  const scene = new Group();
  scene.name = activation < 1 ? `deep-landmark-${key}-dormant` : `deep-landmark-${key}`;
  scene.add(...precinct(look.glow, activation));
  for (const surface of ["stone", "trim", "base", "glow"] as const) {
    const geometries = parts[surface];
    if (!geometries?.length) continue;
    const merged = mergeGeometries(
      geometries.map((part) => part.toNonIndexed().scale(LANDMARK_SCALE, LANDMARK_SCALE, LANDMARK_SCALE)),
    );
    if (!merged) throw new Error(`The ${key} landmark's ${surface} did not merge`);
    scene.add(
      new Mesh(merged, surface === "glow" ? glowMaterial(look.glow, activation) : stoneMaterial(look[surface])),
    );
  }
  return { scene, animations: [] };
}

function activated(look: Record<Surface, string>, activation: number): Record<Surface, Color> {
  const sealed = (colour: string) => {
    const hsl = new Color(colour).getHSL({ h: 0, s: 0, l: 0 });
    return new Color().setHSL(hsl.h, hsl.s * (DORMANT_SATURATION + (1 - DORMANT_SATURATION) * activation), hsl.l);
  };
  return { stone: sealed(look.stone), trim: sealed(look.trim), base: sealed(look.base), glow: sealed(look.glow) };
}

function precinct(glow: Color, activation: number): Mesh[] {
  return [
    new Mesh(
      new CylinderGeometry(PRECINCT_RADIUS, PRECINCT_RADIUS + 0.02, 0.05, 6).translate(0, 0.025, 0),
      stoneMaterial(DEEP_PALETTE.cobalt),
    ),
    new Mesh(
      new TorusGeometry(PRECINCT_RADIUS - 0.08, 0.04, 4, 6)
        .rotateX(Math.PI / 2)
        .rotateY(Math.PI / 6)
        .translate(0, 0.055, 0),
      glowMaterial(glow, activation),
    ),
  ];
}

function archive(): Parts {
  const steps = [0.44, 0.37, 0.3, 0.24, 0.18];
  const stepHeight = 0.12;
  const top = 0.06 + steps.length * stepHeight;
  return {
    base: [hexPrism(0.48, 0.06, 0)],
    stone: [
      ...steps.map((radius, step) => hexPrism(radius, stepHeight, 0.06 + step * stepHeight)),
      new BoxGeometry(0.2, 0.2, 0.2).translate(0, top + 0.1, 0),
    ],
    trim: [
      ...steps.map((radius, step) => hexPrism(radius + 0.015, 0.02, 0.06 + (step + 1) * stepHeight - 0.02)),
      new ConeGeometry(0.16, 0.2, 4).rotateY(Math.PI / 4).translate(0, top + 0.3, 0),
    ],
    glow: [
      ring(0.36, 0.03, top + 0.62, 0),
      ring(0.25, 0.026, top + 0.82, 0.5),
      ...Array.from({ length: 8 }, (_, glyph) =>
        new BoxGeometry(0.07, 0.07, 0.07).translate(0.36, top + 0.62, 0).rotateY((glyph * Math.PI) / 4),
      ),
    ],
  };
}

function essenceCore(): Parts {
  const prong = (turn: number) => [
    new BoxGeometry(0.08, 0.55, 0.08).translate(0, 0.27, 0).rotateZ(-0.35).translate(0.24, 0.2, 0).rotateY(turn),
    new BoxGeometry(0.07, 0.5, 0.07).translate(0, 0.25, 0).rotateZ(0.3).translate(0.43, 0.68, 0).rotateY(turn),
  ];
  const tip = (turn: number) => new ConeGeometry(0.05, 0.14, 4).translate(0.32, 1.2, 0).rotateY(turn);
  const turns = [0, 1, 2].map((index) => (index * 2 * Math.PI) / 3);
  return {
    base: [hexPrism(0.44, 0.1, 0)],
    stone: [hexPrism(0.34, 0.12, 0.1), ...turns.flatMap(prong)],
    trim: [hexPrism(0.36, 0.02, 0.22), ...turns.map(tip)],
    glow: [
      new IcosahedronGeometry(0.3, 1).translate(0, 1.05, 0),
      ring(0.44, 0.02, 1.05, 0),
      ring(0.38, 0.018, 1.05, 1.2),
    ],
  };
}

function etherealMine(): Parts {
  const crystal = (x: number, z: number, width: number, height: number, tilt: number) =>
    new OctahedronGeometry(width, 0)
      .scale(1, height / width / 2, 1)
      .translate(0, height / 2, 0)
      .rotateZ(tilt)
      .rotateX(tilt * 0.5)
      .translate(x, 0.18, z);
  return {
    base: [hexPrism(0.45, 0.18, 0)],
    stone: [
      crystal(0.32, 0.14, 0.12, 0.8, 0.45),
      crystal(-0.3, -0.12, 0.11, 0.7, -0.4),
      crystal(0.05, 0.34, 0.09, 0.55, -0.2),
    ],
    glow: [
      crystal(0, 0, 0.17, 1.35, 0),
      crystal(0.2, -0.24, 0.12, 0.95, 0.3),
      crystal(-0.24, 0.2, 0.12, 1.0, -0.3),
      crystal(-0.1, -0.32, 0.08, 0.6, -0.15),
      ...[0, 1, 2].map((crack) =>
        new BoxGeometry(0.42, 0.012, 0.025).translate(0.2, 0.185, 0).rotateY((crack * 2 * Math.PI) / 3 + 0.4),
      ),
    ],
  };
}

function baneAltar(): Parts {
  const half = (side: number) =>
    new CylinderGeometry(0.12, 0.2, 1.3, 4, 1)
      .rotateY(Math.PI / 4)
      .translate(0, 0.65, 0)
      .rotateZ(side * -0.1)
      .translate(side * 0.17, 0.16, 0);
  const thorn = (turn: number, reach: number) => [
    new ConeGeometry(0.05, 0.36, 4).translate(0, 0.18, 0).rotateZ(0.5).translate(reach, 0.14, 0).rotateY(turn),
    new ConeGeometry(0.03, 0.28, 4)
      .translate(0, 0.14, 0)
      .rotateZ(1.1)
      .translate(reach + 0.16, 0.42, 0)
      .rotateY(turn),
  ];
  const turns = Array.from({ length: 7 }, (_, index) => (index * 2 * Math.PI) / 7 + 0.2);
  return {
    base: [hexPrism(0.45, 0.16, 0)],
    stone: [half(-1), half(1)],
    trim: turns.flatMap((turn) => thorn(turn, 0.32)),
    glow: [new BoxGeometry(0.06, 1.1, 0.14).translate(0, 0.78, 0), ring(0.44, 0.025, 0.17, 0)],
  };
}

function hexPrism(radius: number, height: number, bottom: number): BufferGeometry {
  return new CylinderGeometry(radius * 0.97, radius, height, 6).translate(0, bottom + height / 2, 0);
}

function ring(radius: number, tube: number, height: number, tilt: number): BufferGeometry {
  return new TorusGeometry(radius, tube, 6, 32).rotateX(Math.PI / 2 + tilt).translate(0, height, 0);
}

function stoneMaterial(colour: Color | string): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: new Color(colour), roughness: 0.65, metalness: 0 });
}

function glowMaterial(colour: Color, activation: number): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: colour,
    emissive: colour,
    emissiveIntensity: GLOW_INTENSITY * activation,
    roughness: 0.4,
    metalness: 0,
  });
}
