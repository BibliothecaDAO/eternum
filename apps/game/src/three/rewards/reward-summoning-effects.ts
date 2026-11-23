import { Color, DoubleSide, type MeshStandardMaterial } from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { color, mix, positionLocal, smoothstep, uniform, uv, vec3 } from "three/tsl";
import { FrostedStandardNodeMaterial } from "../effects/game-map-material-library";

export function createRuneFlameMaterials() {
  const clock = uniform(0);
  const density = uniform(0);
  const rise = uniform(0);
  const dissolve = uniform(0);
  const glyphStrength = uniform(0);
  // A Frontier chest's tell: how far the runes have turned to its rarity's colour (0 is the authored violet).
  const rarityTint = uniform(new Color(1, 1, 1));
  const rarityAmount = uniform(0);
  const phase = positionLocal.x.mul(11).add(positionLocal.z.mul(9));
  const flicker = clock
    .mul(2.13)
    .add(phase.mul(1.7))
    .sin()
    .mul(0.45)
    .add(clock.mul(5.71).sub(phase).sin().mul(0.25))
    .add(clock.mul(11.37).add(phase.mul(0.6)).sin().mul(0.12))
    .add(0.5)
    .clamp(0, 1);
  const flow = phase
    .sub(clock.mul(3.1))
    .add(clock.mul(0.73).sin().mul(2.4))
    .sin()
    .mul(0.5)
    .add(0.5)
    .mul(flicker.mul(0.7).add(0.3));
  const glyph = new MeshBasicNodeMaterial();
  const violetGlyph = mix(color("#350448"), color("#ab37ef"), flow.mul(glyphStrength))
    .mul(1.5)
    .add(color("#682a94").rgb);
  glyph.colorNode = mix(violetGlyph, rarityTint.mul(flow.mul(0.8).add(1.4)), rarityAmount);
  glyph.toneMapped = false;

  const flame = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: DoubleSide });
  const height = uv().y;
  const turbulence = height.mul(19).sub(clock.mul(9)).add(positionLocal.x.mul(13)).sin();
  const edge = uv().x.sub(0.5).mul(2).abs();
  const feather = smoothstep(0.25, 1, edge.add(turbulence.mul(0.16))).oneMinus();
  const tip = smoothstep(0.48, 1, height.add(turbulence.mul(0.08))).oneMinus();
  const evaporation = smoothstep(dissolve.sub(0.15), dissolve.add(0.12), height);
  const violetFlame = mix(color("#180327"), color("#6710a0"), turbulence.mul(0.25).add(flow.mul(0.4)).add(0.2));
  flame.colorNode = mix(violetFlame, rarityTint.mul(turbulence.mul(0.2).add(0.8)), rarityAmount);
  flame.opacityNode = feather.mul(tip).mul(density).mul(evaporation);
  // Each foot stays inside its glyph; only the rising part curls and drifts.
  flame.positionNode = positionLocal.add(
    vec3(
      turbulence.mul(height).mul(0.1),
      height.mul(rise),
      height.mul(12).sub(clock.mul(7)).sin().mul(height).mul(0.08),
    ),
  );
  flame.toneMapped = false;
  return { glyph, flame, clock, density, rise, dissolve, glyphStrength, rarityTint, rarityAmount };
}

export function createArcaneStoneMaterial(
  source: MeshStandardMaterial,
  energy: ReturnType<typeof createRuneFlameMaterials>,
) {
  const material = new FrostedStandardNodeMaterial({
    map: source.map,
    color: source.color,
    roughness: 0.88,
    metalness: 0.02,
  });
  // Energy travels through the carved glyphs, leaving the masonry free of moving bands.
  material.emissiveNode = mix(color("#39234c"), energy.rarityTint.mul(0.9), energy.rarityAmount).mul(
    energy.glyphStrength.div(0.8),
  );
  return material;
}
