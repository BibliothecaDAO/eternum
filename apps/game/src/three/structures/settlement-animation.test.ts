import { BufferAttribute, BufferGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from "three";
import { describe, expect, it, vi } from "vitest";
import { SettlementAnimation } from "./settlement-animation";

function harness(motion: "banner" | "flame" | "spin" | "foliage") {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array([0, 1, 0, 1, 1, 0, 0, 0, 0, 1, 0, 0]), 3));
  geometry.setIndex([0, 2, 1, 1, 2, 3]);
  if (motion === "spin") geometry.translate(4, 2, -3);
  const material = new MeshStandardMaterial();
  const source = new Group();
  const authored = new Mesh(geometry, material);
  authored.userData.settlementMotion = motion;
  source.add(authored);
  const instance = new Mesh(geometry, material);
  const animation = new SettlementAnimation(source, [instance]);
  const positions = () => Array.from(instance.geometry.getAttribute("position").array);
  const dispose = () => {
    animation.dispose();
    geometry.dispose();
    material.dispose();
  };
  return { geometry, instance, animation, positions, dispose };
}

describe("settlement animation", () => {
  it("pins the banner to its crossbar, animates its free edge and leaves cached geometry intact", () => {
    const model = harness("banner");
    const rest = Array.from(model.geometry.getAttribute("position").array);
    model.animation.update(0.5, { windX: 0.2, windZ: 0.4 });
    expect(model.positions().slice(0, 6)).toEqual(rest.slice(0, 6));
    expect(model.positions().slice(6)).not.toEqual(rest.slice(6));
    expect(Array.from(model.geometry.getAttribute("position").array)).toEqual(rest);
    const first = model.positions();
    model.animation.update(0.5, { windX: 0.2, windZ: 0.4 });
    expect(model.positions()).not.toEqual(first);
    model.dispose();
  });

  it("flickers above a stationary hearth and leans with the weather wind", () => {
    const left = harness("flame");
    const right = harness("flame");
    left.animation.update(0.3, { windX: -1, windZ: 0 });
    right.animation.update(0.3, { windX: 1, windZ: 0 });
    expect(left.positions().slice(6)).toEqual([0, 0, 0, 1, 0, 0]);
    expect(left.positions()[0]).toBeLessThan(right.positions()[0]);
    expect(left.positions()[1]).not.toBe(1);
    left.dispose();
    right.dispose();
  });

  it("rotates a gem around its own center without moving its height or cached geometry, and loops cleanly", () => {
    const model = harness("spin");
    const rest = model.positions();
    model.animation.update(3, { windX: 1, windZ: 1 });
    const quarter = model.positions();
    for (let i = 0; i < rest.length; i += 3) {
      expect(quarter[i]).toBeCloseTo(4.5);
      expect(quarter[i + 1]).toBe(rest[i + 1]);
      expect(quarter[i + 2]).toBeCloseTo(-3 + 4.5 - rest[i]);
      expect(
        model.instance.geometry.boundingBox!.containsPoint(new Vector3(quarter[i], quarter[i + 1], quarter[i + 2])),
      ).toBe(true);
    }
    expect(Array.from(model.geometry.getAttribute("position").array)).toEqual(rest);
    model.animation.update(9, { windX: -1, windZ: -1 });
    model.positions().forEach((value, index) => expect(value).toBeCloseTo(rest[index]));
    model.dispose();
  });

  it("sways foliage above fixed stems without changing leaf height or escaping its bounds", () => {
    const model = harness("foliage");
    const rest = model.positions();
    for (let frame = 0; frame < 120; frame++) {
      model.animation.update(0.05, { windX: 1, windZ: -1 });
      const positions = model.positions();
      expect(positions.slice(6)).toEqual(rest.slice(6));
      for (let i = 0; i < positions.length; i += 3) {
        expect(positions[i + 1]).toEqual(rest[i + 1]);
        expect(model.instance.geometry.boundingBox!.containsPoint(new Vector3(...positions.slice(i, i + 3)))).toBe(
          true,
        );
      }
    }
    expect(model.positions().slice(0, 6)).not.toEqual(rest.slice(0, 6));
    expect(Array.from(model.geometry.getAttribute("position").array)).toEqual(rest);
    model.dispose();
  });

  it("restores the original geometry and releases its animation clone on disposal", () => {
    const model = harness("banner");
    const release = vi.spyOn(model.instance.geometry, "dispose");
    model.animation.dispose();
    expect(release).toHaveBeenCalledOnce();
    expect(model.instance.geometry).toBe(model.geometry);
    const before = model.positions();
    model.animation.update(1, { windX: 1, windZ: 1 });
    expect(model.positions()).toEqual(before);
    model.dispose();
    expect(release).toHaveBeenCalledOnce();
  });
});
