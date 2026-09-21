import {
  BufferGeometry,
  Color,
  Group,
  Matrix4,
  MeshStandardMaterial,
  Sphere,
  TubeGeometry,
  Vector3,
  LineCurve3,
} from "three";
import { describe, expect, it, vi } from "vitest";
import { createInstancedMesh } from "../utils/create-instanced-mesh";
import { MaterialPool } from "../utils/material-pool";
import { LocalEmissiveGlow } from "./local-emissive-glow";

function fixture() {
  const authored = new MeshStandardMaterial({
    color: new Color(0.008, 0.24, 1),
    emissive: new Color(0.008, 0.24, 1),
    emissiveIntensity: 10,
  });
  const material = MaterialPool.getInstance().getStandardMaterial(authored.clone());
  const geometry = new TubeGeometry(new LineCurve3(new Vector3(), new Vector3(0, 1, 0)), 1, 0.004, 5);
  const source = createInstancedMesh(geometry, material, 3);
  const group = new Group();
  group.add(source);
  const veins = new LocalEmissiveGlow([source], group, { name: "Test light" });
  const halo = group.children[1].children[0] as typeof source;
  return { authored, source, group, veins, halo };
}

describe("local emissive glow", () => {
  it("retains authored color and geometry while showing saturated veins without scene bloom", () => {
    const { authored, source, veins, halo } = fixture();
    const display = source.material as MeshStandardMaterial;
    expect(display.color.toArray()).toEqual(authored.color.toArray());
    expect(display.emissive.toArray()).toEqual(authored.emissive.toArray());
    expect(display.toneMapped).toBe(false);
    expect(authored.toneMapped).toBe(true);
    expect(authored.emissiveIntensity).toBe(10);
    expect(halo.geometry).not.toBe(source.geometry);
    expect(source.geometry.attributes.uv).toBeDefined();
    expect(halo.geometry.attributes.normal).toBeDefined();
    veins.dispose();
    MaterialPool.getInstance().releaseMaterial(display);
    source.dispose();
    source.geometry.dispose();
  });

  it("adopts the backend matrix buffer and follows slot updates, counts and culling bounds without copies", () => {
    const { source, veins, halo } = fixture();
    // A halo can be prepared first; the helper must still adopt native WebGPU's final storage buffer.
    const renderer = { backend: { isWebGPUBackend: true } };
    halo.onBeforeRender.call(
      halo,
      renderer as never,
      new Group() as never,
      {} as never,
      halo.geometry,
      halo.material,
      null as never,
    );
    expect(halo.instanceMatrix).toBe(source.instanceMatrix);
    source.setMatrixAt(1, new Matrix4().makeTranslation(4, 2, 8));
    const sampled = new Matrix4();
    halo.getMatrixAt(1, sampled);
    expect(sampled.elements[12]).toBe(4);
    source.count = 2;
    source.boundingSphere = new Sphere(new Vector3(4, 2, 8), 1);
    veins.updateBoundsAndCount();
    expect(halo.count).toBe(2);
    expect(halo.boundingSphere!.radius).toBeGreaterThan(1);
    source.setMatrixAt(1, new Matrix4().makeScale(0, 0, 0));
    halo.getMatrixAt(1, sampled);
    expect(sampled.determinant()).toBe(0);
    source.count = 0;
    veins.updateBoundsAndCount();
    expect(halo.count).toBe(0);
    veins.dispose();
    MaterialPool.getInstance().releaseMaterial(source.material);
    source.dispose();
    source.geometry.dispose();
  });

  it("disposes only owned shells and never touches the shared matrix storage", () => {
    const { source, group, veins, halo } = fixture();
    const ownedGeometryDisposal = vi.spyOn(halo.geometry as BufferGeometry, "dispose");
    const sourceGeometryDisposal = vi.spyOn(source.geometry, "dispose");
    const sharedMatrices = source.instanceMatrix;
    const haloDisposal = vi.fn();
    halo.addEventListener("dispose", haloDisposal);
    veins.dispose();
    veins.dispose();
    expect(haloDisposal).not.toHaveBeenCalled();
    expect(halo.instanceMatrix).toBe(sharedMatrices);
    expect(source.instanceMatrix).toBe(sharedMatrices);
    expect(group.children).toEqual([source]);
    expect(ownedGeometryDisposal).toHaveBeenCalledOnce();
    expect(sourceGeometryDisposal).not.toHaveBeenCalled();
    MaterialPool.getInstance().releaseMaterial(source.material);
    source.dispose();
    source.geometry.dispose();
  });
});
