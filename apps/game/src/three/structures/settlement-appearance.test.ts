import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MaterialPool } from "../utils/material-pool";
import { SettlementAppearance, SETTLEMENT_RELATIONSHIPS, type SettlementRelationship } from "./settlement-appearance";

afterEach(() => {
  MaterialPool.getInstance().dispose();
  vi.unstubAllGlobals();
});

describe("settlement relationship colors", () => {
  it("imprints the village emblem on the banner, preserves relationship color beneath it and releases the texture", () => {
    const fills: string[] = [];
    const context = {
      fillStyle: "",
      fillRect: () => fills.push(context.fillStyle),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
    };
    vi.stubGlobal("document", { createElement: () => ({ getContext: () => context }) });
    const geometry = new BoxGeometry();
    const material = new MeshStandardMaterial();
    const authored = new Mesh(geometry, material);
    authored.userData.relationshipCloth = true;
    authored.userData.settlementMotion = "banner";
    const source = new Group();
    source.add(authored);
    const instance = new Mesh(geometry, material.clone());
    const appearance = new SettlementAppearance(source, [instance]);
    appearance.setRelationship("owned");
    const texture = instance.material.map!;
    expect(texture.name).toBe("Village huts and palisade imprint");
    expect(texture.flipY).toBe(false);
    expect(instance.material.color.getHexString()).toBe("ffffff");
    expect(fills[0]).toBe(SETTLEMENT_RELATIONSHIPS.owned.color);
    expect(context.fill).toHaveBeenCalledTimes(7);
    fills.length = 0;
    appearance.setRelationship("enemy");
    expect(instance.material.map).toBe(texture);
    expect(fills[0]).toBe(SETTLEMENT_RELATIONSHIPS.enemy.color);
    const release = vi.spyOn(texture, "dispose");
    appearance.dispose();
    expect(release).toHaveBeenCalledOnce();
    instance.material.dispose();
    material.dispose();
    geometry.dispose();
  });

  it("recolors banner and entrance cloth without changing pooled buildings or adding order artwork", () => {
    const pool = MaterialPool.getInstance();
    const source = new Group();
    const geometry = new BoxGeometry();
    const authored = new Mesh(geometry, new MeshStandardMaterial({ color: "#9b793f" }));
    authored.userData.relationshipCloth = true;
    source.add(authored);
    const shared = pool.getStandardMaterial(authored.material);
    const banner = new Mesh(geometry, pool.getStandardMaterial(shared));
    const entrance = new Mesh(geometry, pool.getStandardMaterial(shared));
    const appearance = new SettlementAppearance(source, [banner, entrance]);
    for (const relationship of Object.keys(SETTLEMENT_RELATIONSHIPS) as SettlementRelationship[]) {
      appearance.setRelationship(relationship);
      for (const instance of [banner, entrance]) {
        expect(`#${instance.material.color.getHexString()}`).toBe(SETTLEMENT_RELATIONSHIPS[relationship].color);
        expect(instance.material.map).toBeNull();
        expect(instance.material).not.toBe(shared);
      }
      expect(shared.color.getHexString()).toBe("9b793f");
    }
    expect(() => appearance.setRelationship("missing" as SettlementRelationship)).toThrow(
      "Unknown settlement relationship",
    );
    banner.material.dispose();
    entrance.material.dispose();
    authored.material.dispose();
    geometry.dispose();
  });
});
