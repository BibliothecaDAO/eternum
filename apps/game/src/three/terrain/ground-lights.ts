import { Color, DataTexture, LinearFilter, RGBAFormat, UnsignedByteType, Vector2 } from "three";
import type Node from "three/src/nodes/core/Node.js";
import { sin, smoothstep, texture, uniform } from "three/tsl";

import { mapAnimationTime } from "../effects/endgame/state";

export interface GroundLight {
  colour: Color;
  reach: number;
}

const COVERS = 48;
const TEXELS = 128;
const BRIGHTEST = 8;
const FOLLOW_STEP = 4;
const FIRE_FLICKER = 0.12;

export class GroundLights {
  private readonly lights = new Map<string, { x: number; z: number; light: GroundLight }>();
  private readonly texels = new Uint8Array(TEXELS * TEXELS * 4);
  private readonly sums = new Float32Array(TEXELS * TEXELS * 3);
  private readonly seeds = new Uint8Array(TEXELS * TEXELS);
  private readonly strongest = new Float32Array(TEXELS * TEXELS);
  private readonly map = new DataTexture(this.texels, TEXELS, TEXELS, RGBAFormat, UnsignedByteType);
  private readonly corner = uniform(new Vector2(0, 0));
  private readonly flicker = uniform(FIRE_FLICKER);
  private readonly strength = uniform(1);
  private dirty = true;

  constructor() {
    this.map.name = "ground-lights";
    this.map.magFilter = LinearFilter;
    this.map.minFilter = LinearFilter;
    this.map.generateMipmaps = false;
    this.map.needsUpdate = true;
  }

  set(key: string, x: number, z: number, light: GroundLight): void {
    const was = this.lights.get(key);
    if (was && was.x === x && was.z === z && was.light === light) return;
    this.lights.set(key, { x, z, light });
    this.dirty = true;
  }

  setStrength(strength: number): void {
    this.strength.value = strength;
  }

  setFlickering(flickering: boolean): void {
    this.flicker.value = flickering ? FIRE_FLICKER : 0;
  }

  remove(key: string): void {
    if (this.lights.delete(key)) this.dirty = true;
  }

  follow(x: number, z: number): void {
    const cornerX = Math.round(x / FOLLOW_STEP) * FOLLOW_STEP - COVERS / 2;
    const cornerZ = Math.round(z / FOLLOW_STEP) * FOLLOW_STEP - COVERS / 2;
    if (cornerX !== this.corner.value.x || cornerZ !== this.corner.value.y) {
      this.corner.value.set(cornerX, cornerZ);
      this.dirty = true;
    }
    if (this.dirty) this.write();
  }

  at(world: Node<"vec3">): Node<"vec3"> {
    const uv = world.xz.sub(this.corner).div(COVERS);
    const edge = uv.min(uv.oneMinus());
    const inside = smoothstep(0, 0.1, edge.x.min(edge.y));
    const held = texture(this.map, uv);
    const seed = held.a.mul(97);
    const wave = sin(mapAnimationTime.mul(2.3).add(seed))
      .mul(0.6)
      .add(sin(mapAnimationTime.mul(3.9).add(seed.mul(1.7))).mul(0.4));
    return held.rgb.mul(BRIGHTEST).mul(inside).mul(wave.mul(this.flicker).add(1)).mul(this.strength);
  }

  read(x: number, z: number): { r: number; g: number; b: number } {
    const col = Math.floor(((x - this.corner.value.x) / COVERS) * TEXELS);
    const row = Math.floor(((z - this.corner.value.y) / COVERS) * TEXELS);
    if (col < 0 || row < 0 || col >= TEXELS || row >= TEXELS) return { r: 0, g: 0, b: 0 };
    const at = (row * TEXELS + col) * 4;
    const [r, g, b] = [0, 1, 2].map((channel) => (this.texels[at + channel] / 255) * BRIGHTEST);
    return { r, g, b };
  }

  dispose(): void {
    this.map.dispose();
  }

  private write(): void {
    this.dirty = false;
    const sums = this.sums.fill(0);
    const seeds = this.seeds.fill(0);
    const strongest = this.strongest.fill(0);
    const texel = COVERS / TEXELS;
    const { x: cornerX, y: cornerZ } = this.corner.value;
    for (const [key, { x, z, light }] of this.lights) {
      const seed = seedOf(key);
      const fromX = Math.max(0, Math.floor((x - light.reach - cornerX) / texel));
      const toX = Math.min(TEXELS - 1, Math.ceil((x + light.reach - cornerX) / texel));
      const fromZ = Math.max(0, Math.floor((z - light.reach - cornerZ) / texel));
      const toZ = Math.min(TEXELS - 1, Math.ceil((z + light.reach - cornerZ) / texel));
      for (let row = fromZ; row <= toZ; row += 1) {
        for (let col = fromX; col <= toX; col += 1) {
          const distance = Math.hypot(cornerX + (col + 0.5) * texel - x, cornerZ + (row + 0.5) * texel - z);
          const falloff = Math.max(0, 1 - distance / light.reach) ** 2;
          if (falloff === 0) continue;
          const at = (row * TEXELS + col) * 3;
          sums[at] += light.colour.r * falloff;
          sums[at + 1] += light.colour.g * falloff;
          sums[at + 2] += light.colour.b * falloff;
          const texelIndex = at / 3;
          if (falloff > strongest[texelIndex]) {
            strongest[texelIndex] = falloff;
            seeds[texelIndex] = seed;
          }
        }
      }
    }
    for (let index = 0; index < TEXELS * TEXELS; index += 1) {
      for (let channel = 0; channel < 3; channel += 1) {
        this.texels[index * 4 + channel] = Math.round(Math.min(1, sums[index * 3 + channel] / BRIGHTEST) * 255);
      }
      this.texels[index * 4 + 3] = seeds[index];
    }
    this.map.needsUpdate = true;
  }
}

function seedOf(key: string): number {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) hash = Math.imul(hash ^ key.charCodeAt(index), 16777619);
  return (hash >>> 0) % 256;
}
