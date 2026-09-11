import { BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial } from "three";
import { describe, expect, it, vi } from "vitest";
import { SettlementAtmosphere } from "./settlement-atmosphere";

describe("settlement atmosphere", () => {
  it.each(["spin", "flame"])(
    "keeps %s effects attached to moving, reused instances and releases only its resources",
    (motion) => {
      const geometry = new BoxGeometry(0.1, 0.2, 0.1).translate(0.2, 1, -0.1);
      const material = new MeshStandardMaterial({ emissive: 0x22ddaa, emissiveIntensity: 0.5 });
      const source = new Group();
      const authored = new Mesh(geometry, material);
      authored.userData.settlementMotion = motion;
      source.add(authored);
      const instances = new InstancedMesh(geometry, material, 8);
      instances.count = 2;
      const group = new Group();
      group.add(instances);
      const atmosphere = new SettlementAtmosphere(source, [instances]);
      const effects = group.children.filter((child) => child !== instances) as InstancedMesh[];
      const released = effects.map((effect) => vi.spyOn(effect.geometry, "dispose"));
      const sourceReleased = vi.spyOn(geometry, "dispose");
      const sourceMaterialReleased = vi.spyOn(material, "dispose");
      const glow = instances.material as MeshStandardMaterial;
      expect(effects).toHaveLength(motion === "flame" ? 3 : 2);
      expect(glow).not.toBe(material);

      const moved = new Matrix4().makeTranslation(11, 2, -3);
      instances.setMatrixAt(0, moved);
      instances.count = 1;
      atmosphere.update(0.4, { windX: 0.3, windZ: -0.4 });
      for (const effect of effects) {
        expect(effect.instanceMatrix).toBe(instances.instanceMatrix);
        expect(effect.count).toBe(1);
        const placement = new Matrix4();
        effect.getMatrixAt(0, placement);
        expect(placement.elements).toEqual(moved.elements);
      }
      expect(material.emissiveIntensity).toBe(0.5);
      expect(glow.emissiveIntensity).not.toBe(0.5);

      atmosphere.dispose();
      atmosphere.dispose();
      expect(group.children).toEqual([instances]);
      expect(instances.material).toBe(material);
      for (const dispose of released) expect(dispose).toHaveBeenCalledOnce();
      expect(sourceReleased).not.toHaveBeenCalled();
      expect(sourceMaterialReleased).not.toHaveBeenCalled();
      geometry.dispose();
      material.dispose();
      instances.dispose();
    },
  );
});

it("animates local scene clones through their shared effects and materials", () => {
  const model = new Group();
  const gem = new Mesh(new BoxGeometry(0.1, 0.2, 0.1), new MeshStandardMaterial({ emissiveIntensity: 0.5 }));
  gem.userData.settlementMotion = "spin";
  model.add(gem);
  const original = gem.material;
  const atmosphere = new SettlementAtmosphere(model, [gem]);
  const clone = model.clone();
  clone.position.set(4, 0, 2);
  const effects = clone.children.filter((child) => child.name.startsWith("settlement-")) as Mesh[];
  expect(effects).toHaveLength(2);
  expect(effects.every((effect) => !(effect instanceof InstancedMesh))).toBe(true);
  const sourceEffect = model.getObjectByName("settlement-motes") as Mesh;
  expect(effects[0].material).toBe(sourceEffect.material);
  expect(effects[0].geometry).toBe(sourceEffect.geometry);
  atmosphere.update(0.4, { windX: 0.2, windZ: 0.3 });
  expect((clone.children[0] as Mesh).material).toBe(gem.material);
  expect(gem.material.emissiveIntensity).not.toBe(original.emissiveIntensity);
  const release = vi.spyOn(sourceEffect.geometry, "dispose");
  atmosphere.dispose();
  expect(release).toHaveBeenCalledOnce();
  expect(gem.material).toBe(original);
  gem.geometry.dispose();
  original.dispose();
});
