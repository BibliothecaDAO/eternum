import { BufferAttribute, BufferGeometry, Group, Mesh, MeshStandardMaterial } from "three";
import { describe, expect, it, vi } from "vitest";
import { SettlementAnimation } from "./settlement-animation";

function harness(motion: "banner" | "flame") {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array([0, 1, 0, 1, 1, 0, 0, 0, 0, 1, 0, 0]), 3));
  geometry.setIndex([0, 2, 1, 1, 2, 3]);
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
