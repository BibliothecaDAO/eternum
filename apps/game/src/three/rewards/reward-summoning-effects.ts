import {
  AdditiveBlending,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Vector3,
  type MeshStandardMaterial,
} from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { color, mix, positionLocal, smoothstep, uniform, uv, vec3 } from "three/tsl";
import { FrostedStandardNodeMaterial } from "../effects/game-map-material-library";

export function createRuneFlameMaterials() {
  const clock = uniform(0);
  const density = uniform(0);
  const rise = uniform(0);
  const dissolve = uniform(0);
  const glyphStrength = uniform(0);
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
  glyph.colorNode = mix(color("#350448"), color("#ab37ef"), flow.mul(glyphStrength)).mul(1.5).add(color("#682a94").rgb);
  glyph.toneMapped = false;

  const flame = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: DoubleSide });
  const height = uv().y;
  const turbulence = height.mul(19).sub(clock.mul(9)).add(positionLocal.x.mul(13)).sin();
  const edge = uv().x.sub(0.5).mul(2).abs();
  const feather = smoothstep(0.25, 1, edge.add(turbulence.mul(0.16))).oneMinus();
  const tip = smoothstep(0.48, 1, height.add(turbulence.mul(0.08))).oneMinus();
  const evaporation = smoothstep(dissolve.sub(0.15), dissolve.add(0.12), height);
  flame.colorNode = mix(color("#180327"), color("#6710a0"), turbulence.mul(0.25).add(flow.mul(0.4)).add(0.2));
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
  return { glyph, flame, clock, density, rise, dissolve, glyphStrength };
}

/** Sources are exported rune vertices, so flames follow the actual moving inscriptions. */
export function buildRuneFlames(sources: Vector3[]): BufferGeometry {
  const vertices: number[] = [];
  const coordinates: number[] = [];
  const indices: number[] = [];
  for (const [index, source] of sources.entries()) {
    const angle = Math.atan2(source.z, source.x);
    const height = 1.6 + 0.15 * Math.sin(index * 2.4);
    const start = vertices.length / 3;
    for (let step = 0; step <= 24; step++) {
      const t = step / 24;
      const curl = angle + t * 1.8;
      const radius = Math.hypot(source.x, source.z) * (1 - t * 0.3) + Math.sin(Math.PI * t) * 0.08;
      const width = 0.006 + Math.sin(Math.PI * t) * 0.24;
      for (const side of [-1, 1]) {
        vertices.push(
          Math.cos(curl) * radius + side * width * Math.sin(curl),
          source.y + t * height,
          Math.sin(curl) * radius - side * width * Math.cos(curl),
        );
        coordinates.push((side + 1) / 2, t);
      }
      if (step < 24) {
        const a = start + step * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(coordinates, 2));
  geometry.setIndex(indices);
  return geometry;
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
  material.emissiveNode = color("#39234c").mul(energy.glyphStrength.div(0.8));
  return material;
}

export function createChestRadiance() {
  const strength = uniform(0);
  const material = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    forceSinglePass: true,
    blending: AdditiveBlending,
  });
  const edge = smoothstep(0.05, 0.5, uv().x.sub(0.5).abs()).oneMinus();
  material.colorNode = mix(color("#edcfff"), color("#913aff"), uv().y);
  material.opacityNode = edge.mul(uv().y.oneMinus().pow(2)).mul(strength).mul(0.7);
  material.toneMapped = false;
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute([-0.36, 0.51, 0, 0.36, 0.51, 0, -0.62, 1.45, 0, 0.62, 1.45, 0], 3),
  );
  geometry.setAttribute("uv", new Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
  geometry.setIndex([0, 1, 2, 1, 3, 2]);
  return { material, geometry, strength };
}
