import { LAYER_PLACES } from "@bibliothecadao/types";
import type Node from "three/src/nodes/core/Node.js";
import { Color, type Texture } from "three";
import { color, float, int, mix, normalWorld, positionWorld, smoothstep, uniformArray, vec2 } from "three/tsl";
import { MeshStandardNodeMaterial } from "three/webgpu";
import { applyEndgameFrost } from "../effects/endgame/field";
import { EVERY_LAYER_BIOME, LAYER_BIOME_LOOKS, LAYER_DEPTHS, type PersonalLayer } from "./layer-biomes";
import { cellHash } from "./terrain-cell-hash";
import { layerFloorAir } from "./terrain-mist-node";
import { LAYER_BIOME_OFFSET } from "./terrain-biome-map";
import { biomeTexelAt, hexReach } from "./terrain-ground-node";
import { nearestHexLocalPosition } from "./terrain-hex-node";

const LAYER_INKS = { 1: "#2c3340", 2: "#2b2033" } as const satisfies Record<PersonalLayer, string>;

type Zone = { ground: Node<"vec3">; shade: Node<"vec3">; glow: Node<"vec3"> };

const LAYER_PATTERNS = {
  1: veilGround,
  2: hollowGround,
} as const satisfies Record<
  PersonalLayer,
  (at: Node<"vec2">, zone: Zone) => { colour: Node<"vec3">; glow: Node<"float"> }
>;

export function createLayerFloorMaterial(layer: PersonalLayer, layerBiomes: Texture): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({ roughness: 0.95, metalness: 0 });
  material.name = `terrain-layer-floor-${layer}`;
  const at = positionWorld.xz;
  const zone = zoneAt(layerBiomes, at, LAYER_INKS[layer]);
  const ground = LAYER_PATTERNS[layer](at, zone);
  const air = layerFloorAir(at, LAYER_DEPTHS[LAYER_PLACES[layer]!]);
  const aired = mix(ground.colour, air.colour, air.sheets.add(air.haze.mul(0.85)).min(0.9)).add(air.flash);
  const lined = mix(aired, color(LAYER_INKS[layer]), gridLine(at).mul(0.42));
  const top = smoothstep(0.5, 0.9, normalWorld.y);
  material.colorNode = applyEndgameFrost(mix(zone.shade.mul(0.75), lined, top));
  material.emissiveNode = zone.glow.mul(ground.glow).mul(top);
  return material;
}

export function spireStone(
  at: Node<"vec2">,
  weight: Node<"float">,
): { coverage: Node<"float">; colour: Node<"vec3">; glow: Node<"vec3"> } {
  const look = LAYER_BIOME_LOOKS.stillstone;
  const zone: Zone = {
    ground: color(look.ground) as unknown as Node<"vec3">,
    shade: color(look.shade) as unknown as Node<"vec3">,
    glow: color(look.glow) as unknown as Node<"vec3">,
  };
  const threshold = softNoise(at.mul(1.7)).mul(0.5).add(0.25);
  return {
    coverage: smoothstep(threshold.sub(0.12), threshold.add(0.12), weight),
    colour: mix(veilStone(at, zone), color(LAYER_INKS[1]), gridLine(at).mul(0.42)),
    glow: zone.glow.mul(motes(at, 3.1, 0.93)).mul(float(0.9)),
  };
}

function zoneAt(layerBiomes: Texture, at: Node<"vec2">, ink: string): Zone {
  const samples = [vec2(0, 0), vec2(0.9, 0.5), vec2(-0.6, -0.8)].map((offset) => {
    const raw = biomeTexelAt(layerBiomes, at.add(drift(at.add(offset.mul(3)))).add(offset.mul(0.35)))
      .r.mul(255)
      .round();
    return int(raw.greaterThan(LAYER_BIOME_OFFSET).select(raw.sub(LAYER_BIOME_OFFSET), 0));
  });
  const blended = (part: keyof Zone) => {
    const looks = uniformArray(
      [new Color(ink), ...EVERY_LAYER_BIOME.map((biome) => new Color(LAYER_BIOME_LOOKS[biome][part]))],
      "color",
    );
    const [a, b, c] = samples.map((biome) => looks.element(biome) as unknown as Node<"vec3">);
    return a!.add(b!).add(c!).div(3);
  };
  return { ground: blended("ground"), shade: blended("shade"), glow: blended("glow") };
}

function veilGround(at: Node<"vec2">, zone: Zone) {
  return { colour: veilStone(at, zone), glow: float(0) };
}

function veilStone(at: Node<"vec2">, zone: Zone): Node<"vec3"> {
  return mix(zone.shade, zone.ground, softNoise(at.mul(0.35)).mul(0.7).add(0.3));
}

function hollowGround(at: Node<"vec2">, zone: Zone) {
  const earth = mix(zone.shade, zone.ground, softNoise(at.mul(0.6)).mul(0.7).add(0.3));
  const vein = (scale: number, bend: number) =>
    smoothstep(
      0.9,
      0.985,
      float(1).sub(
        at.x
          .mul(scale)
          .add(
            at.y
              .mul(scale * 0.6)
              .sin()
              .mul(bend),
          )
          .sin()
          .abs(),
      ),
    );
  const roots = vein(0.9, 2.4).max(vein(1.4, 1.6).mul(0.7));
  const litter = motes(at.add(vec2(0.37, 0.71)), 5.3, 0.82);
  const rooted = mix(mix(earth, zone.shade.mul(0.55), roots.mul(0.75)), zone.ground.mul(1.25), litter.mul(0.35));
  return { colour: rooted, glow: motes(at, 2.3, 0.94).mul(1.4) };
}

function gridLine(at: Node<"vec2">): Node<"float"> {
  return smoothstep(0.82, 0.86, hexReach(nearestHexLocalPosition(at)));
}

function drift(at: Node<"vec2">): Node<"vec2"> {
  const broad = vec2(at.y.mul(0.37).add(at.x.mul(0.11)).sin(), at.x.mul(0.31).sub(at.y.mul(0.17)).sin()).mul(0.6);
  const fine = vec2(at.y.mul(1.3).add(at.x.mul(0.4)).sin(), at.x.mul(1.1).sub(at.y.mul(0.5)).sin()).mul(0.18);
  return broad.add(fine);
}

function softNoise(at: Node<"vec2">): Node<"float"> {
  const a = at.x.add(at.y.mul(0.6).sin().mul(1.4)).sin();
  const b = at.y.mul(1.3).add(at.x.mul(0.8).cos().mul(1.1)).sin();
  return a.mul(b).mul(0.5).add(0.5);
}

function motes(at: Node<"vec2">, fine: number, rarity: number): Node<"float"> {
  const cell = at.mul(fine).floor();
  const lot = cellHash(cell, 5);
  const spot = at.mul(fine).fract().sub(0.5).length();
  return smoothstep(0.1, 0.03, spot).mul(smoothstep(rarity, rarity + 0.02, lot));
}
