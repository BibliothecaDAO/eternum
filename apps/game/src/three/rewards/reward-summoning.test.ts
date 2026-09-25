import { describe, expect, it } from "vitest";
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, PointLight } from "three";
import { RewardSummoning } from "./reward-summoning";

function createTile() {
  const world = new Group();
  const tile = new Group();
  world.add(tile);
  tile.position.set(3, 0.4, -2);
  const body = new Group();
  body.name = "ChestBody";
  body.position.y = 0.2;
  const lid = new Group();
  lid.name = "ChestLid";
  // GLTFLoader wraps multi-material meshes in similarly named groups.
  const bodySurface = new Group();
  bodySurface.name = "ChestBody_Surface";
  body.add(bodySurface);
  const lidSurface = new Group();
  lidSurface.name = "ChestLid_Surface";
  lid.add(lidSurface);
  body.add(lid);
  tile.add(body);
  const rings = [0, 1].map((index) => {
    const ring = new Group();
    ring.name = `ArcaneSealRing${index}`;
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute([0.7, 0.05, 0, 0.71, 0.05, 0, 0.7, 0.05, 0.01], 3));
    const material = new MeshStandardMaterial();
    material.name = "Ritual violet";
    ring.add(new Mesh(geometry, material));
    tile.add(ring);
    return ring;
  });
  const crystal = new MeshStandardMaterial({ emissive: 0x0f3652 });
  crystal.name = "Cyan crystal";
  const gems = new Group();
  gems.name = "OrbitGems";
  gems.add(new Mesh(new BufferGeometry(), crystal));
  tile.add(gems);
  const summoning = new RewardSummoning(tile, world);
  return { world, tile, body, lid, rings, gems, crystal, summoning };
}

describe("arcane reward tile lifecycle", () => {
  it("tints a held chest's seam, runes and own crystals, and gives back the authored colours when the glow clears", () => {
    const { world, lid, gems, crystal, summoning } = createTile();
    const own = (gems.children[0] as Mesh).material as MeshStandardMaterial;
    expect(own).not.toBe(crystal);
    summoning.seek(1);
    const light = world.children.find((child): child is PointLight => child instanceof PointLight)!;
    const authored = light.color.getHex();
    summoning.setGlow({ seam: 0.9, tint: "#f2c14e", runes: 1 });
    expect(light.color.getHexString()).toBe("f2c14e");
    expect(own.emissive.getHexString()).toBe("f2c14e");
    // The model's shared crystal, which every other chest on the map draws with, is never touched.
    expect(crystal.emissive.getHex()).toBe(0x0f3652);
    expect(light.intensity).toBeGreaterThan(0);
    expect(lid.rotation.x).toBeLessThan(-0.1);
    summoning.clearGlow();
    expect(light.color.getHex()).toBe(authored);
    expect(own.emissive.getHex()).toBe(0x0f3652);
    expect(light.intensity).toBe(0);
    expect(lid.rotation.x).toBeCloseTo(0);
  });

  it("raises the entire tile before revealing the chest inside flames attached to its turning rings", () => {
    const { tile, body, rings, summoning } = createTile();
    expect(tile.position.y).toBeLessThan(0.4);
    expect(body.visible).toBe(false);
    summoning.update(0.4);
    expect(tile.position.y).toBeCloseTo(0.4);
    expect(body.visible).toBe(false);
    summoning.update(0.15);
    expect(body.visible).toBe(true);
    expect(rings[0].rotation.y).toBeGreaterThan(0);
    expect(rings[1].rotation.y).toBeLessThan(0);
    for (const ring of rings) {
      const flame = ring.children.at(-1) as Mesh;
      expect(flame.visible).toBe(true);
      const root = flame.geometry.getAttribute("position");
      expect(root.getY(0)).toBeCloseTo(0.05);
      expect(root.getX(0)).toBeCloseTo(0.7);
    }
    summoning.update(0.45);
    for (const ring of rings) expect(ring.children.at(-1)?.visible).toBe(false);
    summoning.dispose();
  });

  it("lights the opened chest, closes and settles it before swallowing every part of the tile", () => {
    const { world, tile, body, lid, summoning } = createTile();
    summoning.update(3);
    summoning.open();
    summoning.update(0.5);
    expect(lid.rotation.x).toBeLessThan(-1.5);
    const lights: PointLight[] = [];
    world.traverse((part) => {
      if (part instanceof PointLight) lights.push(part);
    });
    expect(lights[0].intensity).toBeGreaterThan(0);
    summoning.update(1.2);
    expect(lid.rotation.x).toBeCloseTo(0);
    expect(lights[0].intensity).toBe(0);
    expect(tile.position.y).toBeCloseTo(0.4);
    summoning.update(0.3);
    expect(body.position.y).toBeCloseTo(0.073);
    expect(tile.position.y).toBeLessThan(0.4);
    summoning.update(0.8);
    expect(tile.visible).toBe(false);
    expect(lights[0].parent).toBe(world);
    expect(lights[0].visible).toBe(true);
    expect(lights[0].intensity).toBe(0);
    summoning.restart();
    expect(tile.visible).toBe(true);
    expect(body.visible).toBe(false);
    summoning.update(3);
    expect(tile.position.toArray()).toEqual([3, 0.4, -2]);
    summoning.dispose();
  });

  it("queues an early open until the reveal has finished", () => {
    const { lid, summoning } = createTile();
    summoning.open();
    summoning.update(0.75);
    expect(lid.rotation.x).toBeCloseTo(0);
    summoning.update(0.7);
    expect(lid.rotation.x).toBeLessThan(-1.5);
    summoning.dispose();
  });
});
