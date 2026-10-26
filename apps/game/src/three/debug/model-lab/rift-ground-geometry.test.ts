import { describe, expect, it } from "vitest";
import { PlaneGeometry, Uint8BufferAttribute } from "three";
import { createRiftGroundGeometry, sampleRiftGround } from "./rift-ground-geometry";

describe("rift soil", () => {
  it("covers the entire hex and reaches into neighboring snow, leaving gaps between tendrils", () => {
    for (let angle = 0; angle < Math.PI * 2; angle += 0.1)
      expect(sampleRiftGround(Math.cos(angle), Math.sin(angle)).coverage).toBeGreaterThan(0.98);
    expect(sampleRiftGround(-0.995, -0.912).coverage).toBeGreaterThan(0.95);
    expect(sampleRiftGround(1.114, -0.762).coverage).toBeGreaterThan(0.95);
    expect(sampleRiftGround(1.35, 0).coverage).toBe(0);
    expect(sampleRiftGround(-1.35, 0).coverage).toBe(0);
    expect(sampleRiftGround(2, 2)).toEqual({ coverage: 0, depth: 0, floor: 0 });
  });

  it("carves a floor below the soil, with walls between the floor and the unbroken surface", () => {
    expect(sampleRiftGround(0.04, 0.65)).toEqual({ coverage: 1, depth: 0.34, floor: 1 });
    expect(sampleRiftGround(0.1, 0.65).depth).toBeGreaterThan(0);
    expect(sampleRiftGround(0.1, 0.65).depth).toBeLessThan(0.34);
    expect(sampleRiftGround(0.65, 0).depth).toBe(0);
  });

  it("changes the rendered vertex heights and wall normals without changing the original terrain", () => {
    const source = new PlaneGeometry(8, 8, 32, 32).rotateX(-Math.PI / 2);
    source.setAttribute(
      "biome",
      new Uint8BufferAttribute(new Uint8Array(source.attributes.position.count).fill(255), 1, true),
    );
    const original = source.attributes.position.array.slice();
    const geometry = createRiftGroundGeometry(source);
    const position = geometry.attributes.position;
    const normal = geometry.attributes.normal;
    const field = geometry.attributes.riftGround;
    let walls = 0;
    let floor = 0;
    for (let i = 0; i < position.count; i++) {
      const sample = sampleRiftGround(position.getX(i), position.getZ(i));
      expect(position.getY(i)).toBeCloseTo(-sample.depth, 6);
      expect(field.getX(i)).toBeCloseTo(sample.coverage, 2);
      expect(geometry.attributes.biome.getX(i)).toBe(1);
      expect(Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i))).toBeCloseTo(1, 6);
      if (sample.depth > 0.03 && sample.depth < 0.3 && normal.getY(i) < 0.8) walls++;
      if (position.getY(i) < -0.33) floor++;
    }
    expect(walls).toBeGreaterThan(100);
    expect(floor).toBeGreaterThan(100);
    expect(source.attributes.position.array).toEqual(original);
    expect(geometry.index!.count).toBeGreaterThan(source.index!.count);
    expect(geometry.userData.riftDepth).toBeCloseTo(0.34);
    const repeated = createRiftGroundGeometry(source);
    expect(repeated.attributes.position.array).toEqual(position.array);
    expect(repeated.index!.array).toEqual(geometry.index!.array);
    repeated.dispose();
    geometry.dispose();
    source.dispose();
  });

  it("keeps the carved terrain within WebGPU's eight vertex-buffer bindings", () => {
    const source = new PlaneGeometry(4, 4, 8, 8).rotateX(-Math.PI / 2);
    for (const name of ["weights", "biomeIds", "settlement", "ecology", "detail"])
      source.setAttribute(
        name,
        new Uint8BufferAttribute(new Uint8Array(source.attributes.position.count * 4), 4, true),
      );
    const geometry = createRiftGroundGeometry(source);
    const bindings = new Set(Object.values(geometry.attributes).map((attribute) => attribute.array));
    expect(bindings.size).toBeLessThanOrEqual(8);
    geometry.dispose();
    source.dispose();
  });
});
