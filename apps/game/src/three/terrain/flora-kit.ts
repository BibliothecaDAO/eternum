import { BufferGeometry, Float32BufferAttribute, Group, Mesh } from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import {
  addFrond,
  addFrustum,
  addLump,
  addSkirt,
  addTriangle,
  createFloraMesh,
  createRandom,
  linearColour,
  type FloraMeshData,
  type LumpSpec,
  type Vec3,
} from "./flora-geometry";
import type { TerrainPropArchetypeId } from "./terrain-prop-catalog";

interface FloraSpeciesDefinition {
  readonly id: TerrainPropArchetypeId;
  readonly height: number;
  readonly variants: number;
  build(seed: number): FloraMeshData;
}

export interface FloraSpeciesMetadata {
  readonly id: TerrainPropArchetypeId;
  readonly height: number;
  readonly radius: number;
  readonly variants: number;
  readonly triangles: readonly number[];
}

const BIRCH_BARK_WHITE = linearColour("#e4e0d2");
const BIRCH_BARK_BAND = linearColour("#3b3631");
const BIRCH_LEAF_LIGHT = linearColour("#a8c45a");
const BIRCH_LEAF_DARK = linearColour("#557a34");

const CORAL_STEM = linearColour("#5a3456");
const CORAL_BRANCH = linearColour("#8a5486");
const CORAL_TIP = linearColour("#d6a6d8");
const CORAL_DEPTH_GLOW = [0.15, 0.45, 1] as const;

const BOULDER_LIGHT = linearColour("#9a948a");
const BOULDER_DARK = linearColour("#5a554e");

const BROADLEAF_BARK = linearColour("#4e3524");
const BROADLEAF_LEAF_LIGHT = linearColour("#86ad48");
const BROADLEAF_LEAF_DARK = linearColour("#3e6b45");

const CACTUS_SKIN = linearColour("#5c8b4c");
const CACTUS_SKIN_DARK = linearColour("#3e6638");

const CONIFER_BARK = linearColour("#3f2c20");
const CONIFER_DARK = linearColour("#142e28");
const CONIFER_LIGHT = linearColour("#386a58");
const CONIFER_UNDER = linearColour("#0c1d19");

const CYCAD_BARK = linearColour("#6b5238");
const CYCAD_LIGHT = linearColour("#5e9a44");
const CYCAD_DARK = linearColour("#28502a");

const DEAD_TREE_BARK = linearColour("#6e665c");
const DEAD_TREE_DARK = linearColour("#4a443d");

const BANNER_POLE = linearColour("#2a2e36");
const BANNER_TOP = linearColour("#d6dbe0");
const BANNER_TAIL = linearColour("#a4adb6");

const LOG_BARK = linearColour("#5a4330");
const LOG_HEART = linearColour("#b08a5a");

const FERN_LIGHT = linearColour("#6fa04e");
const FERN_DARK = linearColour("#2f5a2c");

const FROST_LIGHT = linearColour("#e4ecf4");
const FROST_DARK = linearColour("#a8b6ca");

const GLOWCAP_STEM = linearColour("#d8ccae");
const GLOWCAP_CAP = linearColour("#a87a44");
const GLOWCAP_CROWN = linearColour("#c4965a");
const GLOWCAP_MOSS_LIGHT = linearColour("#4a4428");
const GLOWCAP_MOSS_DARK = linearColour("#2b2716");

const GRASS_LIGHT = linearColour("#9ab65a");
const GRASS_DARK = linearColour("#56783a");

const HOLLOW_FERN_LIGHT = linearColour("#a08a52");
const HOLLOW_FERN_DARK = linearColour("#5c4a2a");
const HOLLOW_FERN_CURL = linearColour("#c9a35c");

const MUSHROOM_STEM = linearColour("#e6dcc4");
const MUSHROOM_CAP = linearColour("#b4442e");

const PALM_BARK_LIGHT = linearColour("#8a6a46");
const PALM_BARK_DARK = linearColour("#5f442c");
const PALM_FROND_LIGHT = linearColour("#73a85c");
const PALM_FROND_DARK = linearColour("#2c5a35");

const RAINFOREST_BARK = linearColour("#5a4632");
const RAINFOREST_LIGHT = linearColour("#3e8a36");
const RAINFOREST_DARK = linearColour("#14391b");

const ROOT_DARK = linearColour("#3e2b1e");
const ROOT_LIGHT = linearColour("#6a4a30");
const ROOT_KNOT = linearColour("#c08a46");

const SHRUB_LIGHT = linearColour("#7c9a4c");
const SHRUB_DARK = linearColour("#3b5a35");

const SLATE_MAIN = linearColour("#262a33");
const SLATE_TOP = linearColour("#3a404c");

const WILDFLOWER_STEM = linearColour("#5f8a3c");
const WILDFLOWER_PETALS: readonly Vec3[] = ["#e8c84a", "#f2f0e4", "#c86ab0"].map(linearColour);

const STANDING_STONE_CLUSTERS: readonly (readonly {
  readonly share: number;
  readonly at: readonly [number, number];
}[])[] = [
  [
    { share: 1, at: [0, 0] },
    { share: 0.45, at: [0.16, 0.08] },
  ],
  [
    { share: 0.85, at: [-0.08, 0] },
    { share: 0.6, at: [0.1, 0.07] },
    { share: 0.35, at: [0.03, -0.12] },
  ],
  [{ share: 1, at: [0, 0] }],
];

const ROOT_SPAN = 0.3;
const ROOT_STEPS = 7;

export const FLORA_SPECIES = {
  broadleaf: {
    id: "broadleaf",
    height: 1.5,
    variants: 3,
    build(seed: number): FloraMeshData {
      const rng = createRandom(seed * 7919 + 17);
      const mesh = createFloraMesh();
      const height = this.height;
      const lean: Vec3 = [(rng() - 0.5) * 0.06 * height, 0, (rng() - 0.5) * 0.06 * height];
      const fork: Vec3 = [lean[0], height * 0.32, lean[2]];
      addFrustum(mesh, {
        from: [0, 0, 0],
        to: [0, height * 0.05, 0],
        fromRadius: height * 0.1,
        toRadius: height * 0.07,
        sides: 5,
        colour: BROADLEAF_BARK,
        rng,
      });
      addFrustum(mesh, {
        from: [0, height * 0.05, 0],
        to: fork,
        fromRadius: height * 0.07,
        toRadius: height * 0.055,
        sides: 5,
        colour: BROADLEAF_BARK,
        rng,
        twist: 0.5,
      });
      const crown: Vec3 = [fork[0], height * 0.62, fork[2]];
      const turn = rng() * Math.PI * 2;
      const lumps: LumpSpec[] = [
        { centre: [crown[0], height * 0.68, crown[2]], radius: height * 0.22, squash: 0.85 },
        ...[0, 1, 2, 3].map((side): LumpSpec => {
          const angle = turn + (side * Math.PI) / 2 + (rng() - 0.5) * 0.9;
          const radius = height * (0.12 + rng() * 0.09);
          const out = height * 0.12 + radius * 0.75;
          return {
            centre: [
              crown[0] + Math.cos(angle) * out,
              height * (0.46 + rng() * 0.12),
              crown[2] + Math.sin(angle) * out,
            ],
            radius,
            squash: 0.78 + rng() * 0.1,
            coarse: true,
          };
        }),
      ];
      for (const lump of lumps.slice(1)) {
        const reachTo: Vec3 = [
          lump.centre[0] * 0.7 + fork[0] * 0.3,
          lump.centre[1] - lump.radius * 0.5,
          lump.centre[2] * 0.7 + fork[2] * 0.3,
        ];
        addFrustum(mesh, {
          from: fork,
          to: reachTo,
          fromRadius: height * 0.042,
          toRadius: height * 0.022,
          sides: 4,
          colour: BROADLEAF_BARK,
          rng,
        });
      }
      lumps.forEach((lump, index) => {
        addLump(mesh, lump, {
          rng,
          roughness: 0.1,
          light: BROADLEAF_LEAF_LIGHT,
          dark: BROADLEAF_LEAF_DARK,
          attach: fork,
          reach: height * 0.6,
          neighbours: lumps.filter((_, other) => other !== index),
        });
      });
      return mesh;
    },
  },
  birch: {
    id: "birch",
    height: 1.6,
    variants: 3,
    build(seed: number): FloraMeshData {
      const rng = createRandom(seed * 122949823 + 19);
      const mesh = createFloraMesh();
      const height = this.height;
      const lean: Vec3 = [(rng() - 0.5) * height * 0.1, 0, (rng() - 0.5) * height * 0.1];
      const trunkAt = (share: number): Vec3 => [lean[0] * share, height * 0.5 * share, lean[2] * share];
      for (let band = 0; band < 4; band++) {
        addFrustum(mesh, {
          from: trunkAt(band / 4),
          to: trunkAt((band + 1) / 4),
          fromRadius: height * (0.042 - band * 0.004),
          toRadius: height * (0.038 - band * 0.004),
          sides: 5,
          colour: band % 2 === 1 ? BIRCH_BARK_BAND : BIRCH_BARK_WHITE,
          rng,
        });
      }
      const top = trunkAt(1);
      for (const side of [-1, 1] as const) {
        const angle = rng() * Math.PI * 2 * side;
        addFrustum(mesh, {
          from: top,
          to: [top[0] + Math.cos(angle) * height * 0.1, height * 0.62, top[2] + Math.sin(angle) * height * 0.1],
          fromRadius: height * 0.022,
          toRadius: height * 0.012,
          sides: 4,
          colour: BIRCH_BARK_WHITE,
          rng,
        });
      }
      const turn = rng() * Math.PI * 2;
      const lumps: LumpSpec[] = [0, 1, 2, 3].map((index): LumpSpec => {
        const angle = turn + index * 2.4;
        const out = index === 0 ? 0 : height * (0.08 + rng() * 0.05);
        return {
          centre: [top[0] + Math.cos(angle) * out, height * (0.58 + index * 0.08), top[2] + Math.sin(angle) * out],
          radius: height * (0.15 - index * 0.015 + rng() * 0.02),
          squash: 1.05,
          coarse: true,
        };
      });
      lumps.forEach((lump, index) => {
        addLump(mesh, lump, {
          rng,
          roughness: 0.14,
          light: BIRCH_LEAF_LIGHT,
          dark: BIRCH_LEAF_DARK,
          attach: trunkAt(0.85),
          reach: height * 0.45,
          neighbours: lumps.filter((_, other) => other !== index),
        });
      });
      return mesh;
    },
  },
  "rainforest-canopy": {
    id: "rainforest-canopy",
    height: 2,
    variants: 3,
    build(seed: number): FloraMeshData {
      const rng = createRandom(seed * 86028121 + 13);
      const mesh = createFloraMesh();
      const height = this.height;
      const crownBase: Vec3 = [0, height * 0.66, 0];
      addFrustum(mesh, {
        from: [0, 0, 0],
        to: crownBase,
        fromRadius: height * 0.05,
        toRadius: height * 0.03,
        sides: 5,
        colour: RAINFOREST_BARK,
        rng,
      });
      const turn = rng() * Math.PI * 2;
      for (let root = 0; root < 3; root++) {
        const angle = turn + (root * Math.PI * 2) / 3;
        addFrustum(mesh, {
          from: [Math.cos(angle) * height * 0.13, 0, Math.sin(angle) * height * 0.13],
          to: [Math.cos(angle) * height * 0.02, height * 0.16, Math.sin(angle) * height * 0.02],
          fromRadius: height * 0.03,
          toRadius: height * 0.012,
          sides: 4,
          colour: RAINFOREST_BARK,
          rng,
        });
      }
      const lumps: LumpSpec[] = [
        { centre: [0, height * 0.84, 0], radius: height * 0.26, squash: 0.42 },
        ...[0, 1, 2, 3].map((side): LumpSpec => {
          const angle = turn + (side * Math.PI) / 2 + (rng() - 0.5) * 0.7;
          const out = height * (0.3 + rng() * 0.05);
          return {
            centre: [Math.cos(angle) * out, height * (0.78 + rng() * 0.04), Math.sin(angle) * out],
            radius: height * (0.17 + rng() * 0.04),
            squash: 0.45,
            coarse: true,
          };
        }),
      ];
      lumps.forEach((lump, index) => {
        addLump(mesh, lump, {
          rng,
          roughness: 0.12,
          light: RAINFOREST_LIGHT,
          dark: RAINFOREST_DARK,
          attach: crownBase,
          reach: height * 0.5,
          neighbours: lumps.filter((_, other) => other !== index),
        });
      });
      return mesh;
    },
  },
  conifer: {
    id: "conifer",
    height: 1.9,
    variants: 3,
    build(seed: number): FloraMeshData {
      const rng = createRandom(seed * 104729 + 31);
      const mesh = createFloraMesh();
      const height = this.height;
      const tiers = 6 + Math.floor(rng() * 3);
      const widest = height / 4.4;
      const lean: Vec3 = [(rng() - 0.5) * height * 0.05, 0, (rng() - 0.5) * height * 0.05];
      const at = (share: number): Vec3 => [lean[0] * share, 0, lean[2] * share];
      const bend = ([x, y, z]: Vec3): number =>
        Math.min(1, Math.hypot(x, z) / widest) * Math.min(1, 0.25 + (y / height) * 0.9);
      addFrustum(mesh, {
        from: [0, 0, 0],
        to: [lean[0] * 0.3, height * 0.3, lean[2] * 0.3],
        fromRadius: height * 0.03,
        toRadius: height * 0.016,
        sides: 5,
        colour: CONIFER_BARK,
        rng,
      });
      const first = height * 0.14;
      const last = height * 0.82;
      for (let tier = 0; tier < tiers; tier++) {
        const share = tier / (tiers - 1);
        const bottom = first + (last - first) * share;
        const top = bottom + height * (0.16 - share * 0.05);
        addSkirt(mesh, {
          centre: at(top / height),
          innerRadius: height * 0.012,
          outerRadius: widest * (1 - share * 0.78) * (0.9 + rng() * 0.2),
          top,
          bottom,
          sides: 14,
          notch: 0.42,
          rng,
          light: CONIFER_LIGHT,
          dark: CONIFER_DARK,
          under: CONIFER_UNDER,
          bend,
        });
      }
      const tip = at(1);
      addFrustum(mesh, {
        from: [tip[0], height * 0.9, tip[2]],
        to: [tip[0], height, tip[2]],
        fromRadius: height * 0.035,
        toRadius: height * 0.003,
        sides: 5,
        colour: CONIFER_LIGHT,
        rng,
        foliage: true,
        bend,
      });
      return mesh;
    },
  },
  palm: {
    id: "palm",
    height: 1.6,
    variants: 3,
    build(seed: number): FloraMeshData {
      const rng = createRandom(seed * 49979687 + 3);
      const mesh = createFloraMesh();
      const height = this.height;
      const sway = rng() * Math.PI * 2;
      const curve = height * (0.1 + rng() * 0.1);
      const trunkAt = (share: number): Vec3 => [
        Math.cos(sway) * curve * share * share,
        height * 0.86 * share,
        Math.sin(sway) * curve * share * share,
      ];
      for (let ring = 0; ring < 4; ring++) {
        addFrustum(mesh, {
          from: trunkAt(ring / 4),
          to: trunkAt((ring + 1) / 4),
          fromRadius: height * (0.055 - ring * 0.005),
          toRadius: height * (0.05 - ring * 0.005),
          sides: 5,
          colour: ring % 2 === 0 ? PALM_BARK_LIGHT : PALM_BARK_DARK,
          rng,
        });
      }
      const crown = trunkAt(1);
      const fronds = 7 + Math.round(rng());
      for (let frond = 0; frond < fronds; frond++) {
        const angle = sway + ((frond + (rng() - 0.5) * 0.4) / fronds) * Math.PI * 2;
        addFrond(mesh, {
          base: crown,
          angle,
          length: height * (0.39 + rng() * 0.08),
          width: height * (0.095 + rng() * 0.025),
          rng,
          light: PALM_FROND_LIGHT,
          dark: PALM_FROND_DARK,
          steps: 4,
          lift: 0.25 + rng() * 0.15,
        });
      }
      return mesh;
    },
  },
  "dead-tree": {
    id: "dead-tree",
    height: 1.3,
    variants: 3,
    build(seed: number): FloraMeshData {
      const rng = createRandom(seed * 86028157 + 43);
      const mesh = createFloraMesh();
      const height = this.height;
      const lean: Vec3 = [(rng() - 0.5) * height * 0.12, 0, (rng() - 0.5) * height * 0.12];
      const top: Vec3 = [lean[0], height * 0.8, lean[2]];
      addFrustum(mesh, {
        from: [0, 0, 0],
        to: top,
        fromRadius: height * 0.05,
        toRadius: height * 0.018,
        sides: 5,
        colour: DEAD_TREE_BARK,
        rng,
      });
      const turn = rng() * Math.PI * 2;
      const branches = [3, 4, 5][seed % 3];
      for (let branch = 0; branch < branches; branch++) {
        const share = 0.35 + branch * 0.15;
        const angle = turn + branch * 2.2;
        const from: Vec3 = [lean[0] * share, height * 0.8 * share, lean[2] * share];
        const reach = height * (0.32 - branch * 0.04);
        const to: Vec3 = [
          from[0] + Math.cos(angle) * reach,
          from[1] + reach * (0.6 + rng() * 0.4),
          from[2] + Math.sin(angle) * reach,
        ];
        addFrustum(mesh, {
          from,
          to,
          fromRadius: height * 0.02,
          toRadius: height * 0.005,
          sides: 4,
          colour: DEAD_TREE_DARK,
          rng,
        });
      }
      return mesh;
    },
  },
  shrub: {
    id: "shrub",
    height: 0.5,
    variants: 3,
    build(seed: number): FloraMeshData {
      const rng = createRandom(seed * 15485863 + 7);
      const mesh = createFloraMesh();
      const height = this.height;
      const turn = rng() * Math.PI * 2;
      const lumps: LumpSpec[] = [
        { centre: [0, height * 0.46, 0], radius: height * 0.48, squash: 0.95, coarse: true },
        ...[0, 1].map((side): LumpSpec => {
          const angle = turn + side * Math.PI * (0.8 + rng() * 0.4);
          const radius = height * (0.3 + rng() * 0.08);
          return {
            centre: [Math.cos(angle) * height * 0.42, radius * 0.8, Math.sin(angle) * height * 0.42],
            radius,
            squash: 0.85,
            coarse: true,
          };
        }),
      ];
      lumps.forEach((lump, index) => {
        addLump(mesh, lump, {
          rng,
          roughness: 0.14,
          light: SHRUB_LIGHT,
          dark: SHRUB_DARK,
          attach: [0, 0, 0],
          reach: height * 1.1,
          rise: height * 0.8,
          neighbours: lumps.filter((_, other) => other !== index),
        });
      });
      return mesh;
    },
  },
  cactus: {
    id: "cactus",
    height: 0.75,
    variants: 3,
    build(seed: number): FloraMeshData {
      const rng = createRandom(seed * 32452867 + 37);
      const mesh = createFloraMesh();
      const height = this.height;
      const radius = height * 0.09;
      addFrustum(mesh, {
        from: [0, 0, 0],
        to: [0, height * 0.55, 0],
        fromRadius: radius,
        toRadius: radius,
        sides: 6,
        colour: CACTUS_SKIN,
        rng,
      });
      addFrustum(mesh, {
        from: [0, height * 0.55, 0],
        to: [0, height, 0],
        fromRadius: radius,
        toRadius: radius * 0.75,
        sides: 6,
        colour: CACTUS_SKIN,
        rng,
      });
      const arms = 1 + Math.round(rng());
      const turn = rng() * Math.PI * 2;
      for (let arm = 0; arm < arms; arm++) {
        const angle = turn + arm * Math.PI;
        const out: Vec3 = [Math.cos(angle), 0, Math.sin(angle)];
        const base = height * (0.32 + rng() * 0.15);
        const elbow: Vec3 = [out[0] * height * 0.2, base + height * 0.04, out[2] * height * 0.2];
        addFrustum(mesh, {
          from: [0, base, 0],
          to: elbow,
          fromRadius: radius * 0.7,
          toRadius: radius * 0.65,
          sides: 4,
          colour: CACTUS_SKIN_DARK,
          rng,
        });
        addFrustum(mesh, {
          from: elbow,
          to: [elbow[0], base + height * (0.3 + rng() * 0.12), elbow[2]],
          fromRadius: radius * 0.65,
          toRadius: radius * 0.5,
          sides: 4,
          colour: CACTUS_SKIN_DARK,
          rng,
        });
      }
      return mesh;
    },
  },
  boulder: {
    id: "boulder",
    height: 0.3,
    variants: 3,
    build(seed: number): FloraMeshData {
      const rng = createRandom(seed * 32452843 + 11);
      const mesh = createFloraMesh();
      const height = this.height;
      const angle = rng() * Math.PI * 2;
      const main: LumpSpec = {
        centre: [0, height * 0.42, 0],
        radius: height * 0.75,
        squash: 0.62 + rng() * 0.12,
        coarse: true,
      };
      const pebble: LumpSpec = {
        centre: [Math.cos(angle) * height * 0.75, height * 0.18, Math.sin(angle) * height * 0.75],
        radius: height * (0.3 + rng() * 0.1),
        squash: 0.7,
        coarse: true,
      };
      for (const [lump, neighbour] of [
        [main, pebble],
        [pebble, main],
      ] as const) {
        addLump(mesh, lump, {
          rng,
          roughness: 0.22,
          light: BOULDER_LIGHT,
          dark: BOULDER_DARK,
          neighbours: [neighbour],
          flat: true,
          foliage: false,
        });
      }
      return mesh;
    },
  },
  mushroom: {
    id: "mushroom",
    height: 0.26,
    variants: 3,
    build(seed: number): FloraMeshData {
      const rng = createRandom(seed * 122949829 + 47);
      const mesh = createFloraMesh();
      const turn = rng() * Math.PI * 2;
      const caps = [2, 3, 1][seed % 3];
      for (let cap = 0; cap < caps; cap++) {
        const capScale = this.height * (cap === 0 ? 1 : 0.65);
        const angle = turn + cap * Math.PI;
        const at: Vec3 =
          cap === 0 ? [0, 0, 0] : [Math.cos(angle) * this.height * 0.4, 0, Math.sin(angle) * this.height * 0.4];
        const capBase: Vec3 = [at[0], capScale * 0.62, at[2]];
        addFrustum(mesh, {
          from: at,
          to: capBase,
          fromRadius: capScale * 0.12,
          toRadius: capScale * 0.1,
          sides: 4,
          colour: MUSHROOM_STEM,
          rng,
        });
        addFrustum(mesh, {
          from: capBase,
          to: [at[0], capScale, at[2]],
          fromRadius: capScale * 0.42,
          toRadius: capScale * 0.04,
          sides: 5,
          colour: MUSHROOM_CAP,
          rng,
        });
      }
      return mesh;
    },
  },
  "fallen-log": {
    id: "fallen-log",
    height: 0.16,
    variants: 3,
    build(seed: number): FloraMeshData {
      const rng = createRandom(seed * 49979693 + 41);
      const mesh = createFloraMesh();
      const radius = this.height * 0.5;
      const logLength = this.height * (4 + rng() * 1.2);
      const tilt = (rng() - 0.5) * 0.4;
      const from: Vec3 = [-logLength / 2, radius, -tilt * logLength];
      const to: Vec3 = [logLength / 2, radius * 0.9, tilt * logLength];
      addFrustum(mesh, { from, to, fromRadius: radius, toRadius: radius * 0.85, sides: 6, colour: LOG_BARK, rng });
      addFrustum(mesh, {
        from: to,
        to: from,
        fromRadius: radius * 0.85,
        toRadius: radius * 0.02,
        sides: 6,
        colour: LOG_HEART,
        rng,
      });
      return mesh;
    },
  },
  "grass-tuft": {
    id: "grass-tuft",
    height: 0.16,
    variants: 3,
    build(seed: number): FloraMeshData {
      const rng = createRandom(seed * 179424691 + 53);
      const mesh = createFloraMesh();
      const turn = rng() * Math.PI * 2;
      for (let blade = 0; blade < 6; blade++) {
        const angle = turn + (blade / 6) * Math.PI * 2 + (rng() - 0.5) * 0.5;
        const lean = this.height * (0.35 + rng() * 0.3);
        const tip: Vec3 = [Math.cos(angle) * lean, this.height * (0.75 + rng() * 0.35), Math.sin(angle) * lean];
        const side: Vec3 = [-Math.sin(angle) * this.height * 0.09, 0, Math.cos(angle) * this.height * 0.09];
        const left: Vec3 = [side[0], 0, side[2]];
        const right: Vec3 = [-side[0], 0, -side[2]];
        const base = blade % 2 === 0 ? GRASS_LIGHT : GRASS_DARK;
        const colour: Vec3 = [
          base[0] * (0.92 + rng() * 0.16),
          base[1] * (0.92 + rng() * 0.16),
          base[2] * (0.92 + rng() * 0.16),
        ];
        addTriangle(mesh, [left, right, tip], colour, [0, 0, 1], { foliage: true });
        addTriangle(mesh, [right, left, tip], colour, [0, 0, 1], { foliage: true });
      }
      return mesh;
    },
  },
  fern: {
    id: "fern",
    height: 0.28,
    variants: 3,
    build(seed: number): FloraMeshData {
      const rng = createRandom(seed * 179424673 + 23);
      const mesh = createFloraMesh();
      const turn = rng() * Math.PI * 2;
      const fronds = [4, 5, 6][seed % 3];
      for (let frond = 0; frond < fronds; frond++) {
        addFrond(mesh, {
          base: [0, this.height * 0.15, 0],
          angle: turn + ((frond + (rng() - 0.5) * 0.4) / fronds) * Math.PI * 2,
          length: this.height * (1.3 + rng() * 0.3),
          width: this.height * 0.32,
          rng,
          light: FERN_LIGHT,
          dark: FERN_DARK,
          steps: 2,
          floor: this.height * 0.02,
          rise: this.height * 0.5,
          lift: 1.4,
          droop: 0.6,
        });
      }
      return mesh;
    },
  },
  cycad: {
    id: "cycad",
    height: 0.42,
    variants: 3,
    build(seed: number): FloraMeshData {
      const rng = createRandom(seed * 15485867 + 29);
      const mesh = createFloraMesh();
      const height = this.height;
      const crown: Vec3 = [0, height * 0.42, 0];
      addFrustum(mesh, {
        from: [0, 0, 0],
        to: crown,
        fromRadius: height * 0.13,
        toRadius: height * 0.1,
        sides: 5,
        colour: CYCAD_BARK,
        rng,
      });
      const turn = rng() * Math.PI * 2;
      const fronds = [6, 7, 8][seed % 3];
      for (let frond = 0; frond < fronds; frond++) {
        addFrond(mesh, {
          base: crown,
          angle: turn + ((frond + (rng() - 0.5) * 0.3) / fronds) * Math.PI * 2,
          length: height * (0.8 + rng() * 0.2),
          width: height * 0.16,
          rng,
          light: CYCAD_LIGHT,
          dark: CYCAD_DARK,
          steps: 2,
          floor: height * 0.03,
          lift: 0.9,
          droop: 0.7,
        });
      }
      return mesh;
    },
  },
  wildflower: {
    id: "wildflower",
    height: 0.18,
    variants: 3,
    build(seed: number): FloraMeshData {
      const rng = createRandom(seed * 15485903 + 59);
      const mesh = createFloraMesh();
      const petals = WILDFLOWER_PETALS[seed % WILDFLOWER_PETALS.length];
      const turn = rng() * Math.PI * 2;
      const stems = [3, 4, 2][seed % 3];
      for (let stem = 0; stem < stems; stem++) {
        const angle = turn + (stem / stems) * Math.PI * 2;
        const foot: Vec3 = [Math.cos(angle) * this.height * 0.15, 0, Math.sin(angle) * this.height * 0.15];
        const head: Vec3 = [foot[0] * 1.6, this.height * (0.75 + rng() * 0.3), foot[2] * 1.6];
        addFrustum(mesh, {
          from: foot,
          to: head,
          fromRadius: this.height * 0.03,
          toRadius: this.height * 0.02,
          sides: 2,
          colour: WILDFLOWER_STEM,
          rng,
          foliage: true,
          bend: ([, y]) => Math.min(1, Math.max(0, y / this.height - 0.05) / 0.95),
        });
        const size = this.height * 0.16;
        const corners = [0, 1, 2].map((corner): Vec3 => {
          const petal = angle + (corner / 3) * Math.PI * 2;
          return [head[0] + Math.cos(petal) * size, head[1] + size * 0.3, head[2] + Math.sin(petal) * size];
        });
        addTriangle(mesh, [corners[0], corners[2], corners[1]], petals, [1, 1, 1], { foliage: true });
      }
      return mesh;
    },
  },
  glowcap: {
    id: "glowcap",
    height: 0.42,
    variants: 3,
    build(seed: number): FloraMeshData {
      const rng = createRandom(seed * 40503 + 911);
      const mesh = createFloraMesh();
      const height = this.height;
      addLump(
        mesh,
        { centre: [0, 0, 0], radius: height * 0.34, squash: 0.32, coarse: true },
        { rng, roughness: 0.18, light: GLOWCAP_MOSS_LIGHT, dark: GLOWCAP_MOSS_DARK, flat: true, foliage: false },
      );
      const count = 3 + (seed % 3);
      const turn = rng() * Math.PI * 2;
      for (let index = 0; index < count; index++) {
        const tallest = index === 0;
        const share = tallest ? 1 : 0.38 + rng() * 0.45;
        const angle = turn + (index / count) * Math.PI * 2 + (rng() - 0.5) * 0.6;
        const out = tallest ? height * 0.04 : height * (0.16 + rng() * 0.2);
        addGlowcapStem(mesh, rng, {
          foot: [Math.cos(angle) * out, height * 0.04, Math.sin(angle) * out],
          lean: [Math.cos(angle) * height * 0.08 * (1 - share), 0, Math.sin(angle) * height * 0.08 * (1 - share)],
          tall: height * share,
        });
      }
      return mesh;
    },
  },
  "root-arch": {
    id: "root-arch",
    height: 0.18,
    variants: 3,
    build(seed: number): FloraMeshData {
      const rng = createRandom(seed * 69061 + 433);
      const mesh = createFloraMesh();
      const strands = 2 + (seed % 2);
      for (let strand = 0; strand < strands; strand++) {
        addRootStrand(mesh, rng, {
          rise: this.height * (0.75 + rng() * 0.25),
          offset: (strand - (strands - 1) / 2) * ROOT_SPAN * 0.09,
          phase: rng() * Math.PI * 2,
          thickness: ROOT_SPAN * (0.07 - strand * 0.012),
          colour: strand === 0 ? ROOT_DARK : ROOT_LIGHT,
        });
      }
      for (const end of [-1, 1] as const) addRootFoot(mesh, rng, end);
      const knots = 1 + (seed % 3);
      for (let knot = 0; knot < knots; knot++) {
        const along = (rng() - 0.5) * ROOT_SPAN * 0.5;
        addLump(
          mesh,
          {
            centre: [along, rootArchHeight(along, this.height) + ROOT_SPAN * 0.02, (rng() - 0.5) * ROOT_SPAN * 0.08],
            radius: ROOT_SPAN * 0.045,
          },
          { rng, roughness: 0.15, light: ROOT_KNOT, dark: ROOT_KNOT, flat: true, foliage: false, glow: 1 },
        );
      }
      return mesh;
    },
  },
  "bloom-coral": {
    id: "bloom-coral",
    height: 0.46,
    variants: 3,
    build(seed: number): FloraMeshData {
      const rng = createRandom(seed * 83492791 + 61);
      const mesh = createFloraMesh();
      const height = this.height;
      const arms = 3 + (seed % 2);
      const turn = rng() * Math.PI * 2;
      for (let arm = 0; arm < arms; arm++) {
        const angle = turn + (arm / arms) * Math.PI * 2 + (rng() - 0.5) * 0.5;
        const lean = 0.35 + rng() * 0.35;
        addCoralBranch(mesh, rng, {
          from: [0, 0, 0],
          angle,
          lean,
          length: height * (0.42 + rng() * 0.12),
          radius: height * 0.06,
          depth: 0,
        });
      }
      return mesh;
    },
  },
  "hollow-fern": {
    id: "hollow-fern",
    height: 0.3,
    variants: 3,
    build(seed: number): FloraMeshData {
      const rng = createRandom(seed * 15485863 + 7);
      const mesh = createFloraMesh();
      const height = this.height;
      const fronds = 4 + (seed % 2);
      const turn = rng() * Math.PI * 2;
      for (let frond = 0; frond < fronds; frond++) {
        addFrond(mesh, {
          base: [0, height * 0.12, 0],
          angle: turn + ((frond + (rng() - 0.5) * 0.4) / fronds) * Math.PI * 2,
          length: height * (1.1 + rng() * 0.3),
          width: height * 0.26,
          rng,
          light: HOLLOW_FERN_LIGHT,
          dark: HOLLOW_FERN_DARK,
          steps: 2,
          floor: height * 0.02,
          rise: height * 0.5,
          lift: 1.9,
          droop: 0.5,
        });
      }
      for (let curl = 0; curl < 1 + (seed % 2); curl++) {
        addFiddlehead(mesh, rng, height, turn + Math.PI * (curl + 0.5));
      }
      return mesh;
    },
  },
  "standing-stone": {
    id: "standing-stone",
    height: 0.9,
    variants: 3,
    build(seed: number): FloraMeshData {
      const rng = createRandom(seed * 7727 + 3);
      const mesh = createFloraMesh();
      for (const { share, at } of STANDING_STONE_CLUSTERS[seed % STANDING_STONE_CLUSTERS.length]) {
        addStandingMonolith(mesh, rng, { foot: [at[0], 0, at[1]], tall: this.height * share });
      }
      return mesh;
    },
  },
  "drift-banner": {
    id: "drift-banner",
    height: 0.7,
    variants: 3,
    build(seed: number): FloraMeshData {
      const rng = createRandom(seed * 31337 + 101);
      const mesh = createFloraMesh();
      const height = this.height;
      const arm = height * 0.3;
      addFrustum(mesh, {
        from: [0, 0, 0],
        to: [(rng() - 0.5) * height * 0.06, height, 0],
        fromRadius: height * 0.025,
        toRadius: height * 0.014,
        sides: 4,
        colour: BANNER_POLE,
        rng,
      });
      addFrustum(mesh, {
        from: [0, height * 0.94, -height * 0.02],
        to: [0, height * 0.92, arm],
        fromRadius: height * 0.012,
        toRadius: height * 0.009,
        sides: 3,
        colour: BANNER_POLE,
        rng,
      });
      const strips = 3 + (seed % 2);
      for (let strip = 0; strip < strips; strip++) {
        const at = arm * ((strip + 0.5) / strips);
        addBannerStrip(mesh, rng, height, at, (arm / strips) * 0.62, 0.35 + rng() * 0.4);
      }
      return mesh;
    },
  },
  "frost-tuft": {
    id: "frost-tuft",
    height: 0.14,
    variants: 3,
    build(seed: number): FloraMeshData {
      const rng = createRandom(seed * 104729 + 19);
      const mesh = createFloraMesh();
      const blades = 5 + (seed % 3);
      const turn = rng() * Math.PI * 2;
      for (let blade = 0; blade < blades; blade++) {
        const angle = turn + (blade / blades) * Math.PI * 2 + (rng() - 0.5) * 0.5;
        const lean = this.height * (0.2 + rng() * 0.25);
        const tip: Vec3 = [Math.cos(angle) * lean, this.height * (0.7 + rng() * 0.4), Math.sin(angle) * lean];
        const side: Vec3 = [-Math.sin(angle) * this.height * 0.12, 0, Math.cos(angle) * this.height * 0.12];
        const left: Vec3 = [side[0], 0, side[2]];
        const right: Vec3 = [-side[0], 0, -side[2]];
        const base = blade % 2 === 0 ? FROST_LIGHT : FROST_DARK;
        const colour: Vec3 = [
          base[0] * (0.94 + rng() * 0.1),
          base[1] * (0.94 + rng() * 0.1),
          base[2] * (0.94 + rng() * 0.1),
        ];
        addTriangle(mesh, [left, right, tip], colour, [0, 0, 1], { foliage: true });
        addTriangle(mesh, [right, left, tip], colour, [0, 0, 1], { foliage: true });
      }
      return mesh;
    },
  },
} as const satisfies Record<TerrainPropArchetypeId, FloraSpeciesDefinition>;

const metadataCache = new Map<TerrainPropArchetypeId, FloraSpeciesMetadata>();

export function buildFloraSpeciesMesh(id: TerrainPropArchetypeId, seed = 0): FloraMeshData {
  return FLORA_SPECIES[id].build(seed);
}

export function buildFloraSpeciesGeometry(id: TerrainPropArchetypeId, seed = 0): BufferGeometry {
  const data = buildFloraSpeciesMesh(id, seed);
  const raw = new BufferGeometry();
  raw.name = id;
  raw.setAttribute("position", new Float32BufferAttribute(data.positions, 3));
  raw.setAttribute("normal", new Float32BufferAttribute(data.normals, 3));
  raw.setAttribute("color", new Float32BufferAttribute(data.colours, 3));
  raw.setAttribute("_wind_weight", new Float32BufferAttribute(data.foliage, 1));
  raw.setAttribute("_wind_bend", new Float32BufferAttribute(data.bend, 1));
  raw.setAttribute("_glow", new Float32BufferAttribute(data.glow, 1));
  const indexed = mergeVertices(raw, 1e-4);
  indexed.name = id;
  raw.dispose();
  indexed.computeBoundingBox();
  indexed.computeBoundingSphere();
  return indexed;
}

export function getFloraSpeciesMetadata(id: TerrainPropArchetypeId): FloraSpeciesMetadata {
  const cached = metadataCache.get(id);
  if (cached) return cached;
  const species = FLORA_SPECIES[id];
  const variants = Array.from({ length: species.variants }, (_, seed) => species.build(seed));
  let widest = 0;
  for (const { positions } of variants) {
    for (let offset = 0; offset < positions.length; offset += 3) {
      widest = Math.max(widest, Math.hypot(positions[offset], positions[offset + 2]));
    }
  }
  const metadata: FloraSpeciesMetadata = {
    id,
    height: species.height,
    radius: Math.round(widest * 1000) / 1000,
    variants: species.variants,
    triangles: variants.map((variant) => variant.positions.length / 9),
  };
  metadataCache.set(id, metadata);
  return metadata;
}

export function buildProceduralTerrainPropCatalog(archetypes: readonly TerrainPropArchetypeId[]): { scene: Group } {
  const scene = new Group();
  scene.name = "terrain-flora-catalog";
  for (const id of archetypes) {
    const mesh = new Mesh(buildFloraSpeciesGeometry(id, 0));
    mesh.name = id;
    scene.add(mesh);
  }
  return { scene };
}

function addGlowcapStem(
  mesh: FloraMeshData,
  rng: () => number,
  { foot, lean, tall }: { foot: Vec3; lean: Vec3; tall: number },
): void {
  const radius = tall * (0.36 + rng() * 0.08);
  const capY = tall * 0.7;
  const capBase: Vec3 = [foot[0] + lean[0], foot[1] + capY, foot[2] + lean[2]];
  addFrustum(mesh, {
    from: foot,
    to: capBase,
    fromRadius: tall * 0.075,
    toRadius: tall * 0.055,
    sides: 4,
    colour: GLOWCAP_STEM,
    rng,
    glow: 0.12,
  });
  const shoulder: Vec3 = [capBase[0], capBase[1] + radius * 0.32, capBase[2]];
  addFrustum(mesh, {
    from: capBase,
    to: shoulder,
    fromRadius: radius,
    toRadius: radius * 0.74,
    sides: 6,
    colour: GLOWCAP_CAP,
    rng,
    glow: 0.85,
  });
  addFrustum(mesh, {
    from: shoulder,
    to: [shoulder[0], shoulder[1] + radius * 0.26, shoulder[2]],
    fromRadius: radius * 0.74,
    toRadius: radius * 0.18,
    sides: 6,
    colour: GLOWCAP_CROWN,
    rng,
    twist: 0.5,
    glow: 1,
  });
}

function rootArchHeight(along: number, rise: number): number {
  const share = (along / (ROOT_SPAN / 2)) ** 2;
  return rise * (1 - share);
}

function addRootStrand(
  mesh: FloraMeshData,
  rng: () => number,
  {
    rise,
    offset,
    phase,
    thickness,
    colour,
  }: { rise: number; offset: number; phase: number; thickness: number; colour: Vec3 },
): void {
  const points: Vec3[] = Array.from({ length: ROOT_STEPS + 1 }, (_, step) => {
    const along = -ROOT_SPAN / 2 + (step / ROOT_STEPS) * ROOT_SPAN;
    const twist = Math.sin(phase + step * 0.9) * ROOT_SPAN * 0.03;
    return [along, Math.max(0, rootArchHeight(along, rise)), offset + twist];
  });
  for (let step = 0; step < ROOT_STEPS; step++) {
    const taper = 1 - Math.abs(step + 0.5 - ROOT_STEPS / 2) / ROOT_STEPS;
    addFrustum(mesh, {
      from: points[step],
      to: points[step + 1],
      fromRadius: thickness * (0.75 + taper * 0.5),
      toRadius: thickness * (0.75 + taper * 0.5),
      sides: 4,
      colour,
      rng,
      twist: 0.5,
    });
  }
}

function addRootFoot(mesh: FloraMeshData, rng: () => number, end: -1 | 1): void {
  const base: Vec3 = [end * ROOT_SPAN * 0.5, 0, 0];
  for (let toe = 0; toe < 2; toe++) {
    const angle = (toe - 0.5) * 1.2 + (rng() - 0.5) * 0.4;
    addFrustum(mesh, {
      from: [base[0], ROOT_SPAN * 0.04, base[2]],
      to: [base[0] + end * Math.cos(angle) * ROOT_SPAN * 0.14, 0, base[2] + Math.sin(angle) * ROOT_SPAN * 0.14],
      fromRadius: ROOT_SPAN * 0.04,
      toRadius: ROOT_SPAN * 0.012,
      sides: 3,
      colour: ROOT_DARK,
      rng,
    });
  }
}

function addCoralBranch(
  mesh: FloraMeshData,
  rng: () => number,
  {
    from,
    angle,
    lean,
    length,
    radius,
    depth,
  }: { from: Vec3; angle: number; lean: number; length: number; radius: number; depth: number },
): void {
  const to: Vec3 = [
    from[0] + Math.cos(angle) * Math.sin(lean) * length,
    from[1] + Math.cos(lean) * length,
    from[2] + Math.sin(angle) * Math.sin(lean) * length,
  ];
  const last = depth === CORAL_DEPTH_GLOW.length - 1;
  const colours: readonly Vec3[] = [CORAL_STEM, CORAL_BRANCH, CORAL_TIP];
  addFrustum(mesh, {
    from,
    to,
    fromRadius: radius,
    toRadius: radius * (last ? 0.9 : 0.7),
    sides: 4,
    colour: colours[depth],
    rng,
    glow: CORAL_DEPTH_GLOW[depth],
  });
  if (last) return;
  for (const fork of [-1, 1] as const) {
    addCoralBranch(mesh, rng, {
      from: to,
      angle: angle + fork * (0.5 + rng() * 0.4),
      lean: Math.min(1.2, lean + 0.15 + rng() * 0.2),
      length: length * (0.6 + rng() * 0.15),
      radius: radius * 0.7,
      depth: depth + 1,
    });
  }
}

function addFiddlehead(mesh: FloraMeshData, rng: () => number, height: number, angle: number): void {
  const out: readonly [number, number] = [Math.cos(angle), Math.sin(angle)];
  let point: Vec3 = [out[0] * height * 0.05, 0, out[1] * height * 0.05];
  let heading = 0.15;
  for (let step = 0; step < 4; step++) {
    const segLength = height * (step === 0 ? 0.5 : 0.14);
    const next: Vec3 = [
      point[0] + out[0] * Math.sin(heading) * segLength,
      point[1] + Math.cos(heading) * segLength,
      point[2] + out[1] * Math.sin(heading) * segLength,
    ];
    addFrustum(mesh, {
      from: point,
      to: next,
      fromRadius: height * (0.035 - step * 0.004),
      toRadius: height * (0.03 - step * 0.004),
      sides: 4,
      colour: HOLLOW_FERN_CURL,
      rng,
      glow: step === 0 ? 0.2 : 0.8,
    });
    point = next;
    heading += step === 0 ? 1.2 : 1.1 + rng() * 0.2;
  }
}

function addStandingMonolith(
  mesh: FloraMeshData,
  rng: () => number,
  { foot, tall }: { foot: Vec3; tall: number },
): void {
  const width = 0.08 + tall * 0.06;
  const lean: Vec3 = [(rng() - 0.5) * tall * 0.3, 0, (rng() - 0.5) * tall * 0.3];
  const shoulder: Vec3 = [foot[0] + lean[0] * 0.8, tall * 0.82, foot[2] + lean[2] * 0.8];
  addFrustum(mesh, {
    from: [foot[0], -0.02, foot[2]],
    to: shoulder,
    fromRadius: width,
    toRadius: width * 0.72,
    sides: 5,
    colour: SLATE_MAIN,
    rng,
    twist: rng() * 0.4,
    jag: 0.18,
  });
  const broken = rng() < 0.6;
  addFrustum(mesh, {
    from: shoulder,
    to: [foot[0] + lean[0] * (broken ? 1.6 : 1), tall * (broken ? 0.94 : 1), foot[2] + lean[2] * (broken ? 1.6 : 1)],
    fromRadius: width * 0.72,
    toRadius: width * (broken ? 0.6 : 0.25),
    sides: 5,
    colour: SLATE_TOP,
    rng,
    jag: broken ? 0.45 : 0,
  });
}

function addBannerStrip(
  mesh: FloraMeshData,
  rng: () => number,
  height: number,
  at: number,
  width: number,
  drop: number,
): void {
  const segments = 3;
  const rows = Array.from({ length: segments + 1 }, (_, step) => {
    const t = step / segments;
    const sway = Math.sin(t * Math.PI + rng() * 0.8) * height * 0.05 * t;
    const fray = t === 1 ? width * 0.4 * rng() : width * (1 - t * 0.35);
    const y = height * (0.92 - t * drop);
    const near: Vec3 = [sway, y, at - fray / 2];
    const far: Vec3 = [sway, y - rng() * t * height * 0.04, at + fray / 2];
    return { t, near, far };
  });
  for (let step = 0; step < segments; step++) {
    const upper = rows[step];
    const lower = rows[step + 1];
    const colour: Vec3 = [
      BANNER_TOP[0] + (BANNER_TAIL[0] - BANNER_TOP[0]) * upper.t,
      BANNER_TOP[1] + (BANNER_TAIL[1] - BANNER_TOP[1]) * upper.t,
      BANNER_TOP[2] + (BANNER_TAIL[2] - BANNER_TOP[2]) * upper.t,
    ];
    const faces: readonly (readonly [Vec3, Vec3, Vec3])[] = [
      [upper.near, upper.far, lower.far],
      [upper.near, lower.far, lower.near],
    ];
    for (const face of faces) {
      const w = (corner: Vec3): number => (corner === upper.near || corner === upper.far ? upper.t : lower.t);
      const weights: readonly [number, number, number] = [w(face[0]), w(face[1]), w(face[2])];
      addTriangle(mesh, face, colour, weights, { foliage: true });
      addTriangle(mesh, [face[2], face[1], face[0]], colour, [weights[2], weights[1], weights[0]], { foliage: true });
    }
  }
}
