import { BoxGeometry, Group, Mesh, MeshStandardMaterial, ImageLoader } from "three";
import { orders } from "@bibliothecadao/types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MaterialPool } from "../utils/material-pool";
import { SettlementAppearance, SETTLEMENT_RELATIONSHIPS, type SettlementRelationship } from "./settlement-appearance";

afterEach(() => {
  MaterialPool.getInstance().dispose();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("settlement relationship colors", () => {
  it("imprints the camp helmet on the banner, preserves relationship color beneath it and releases the texture", () => {
    const fills: string[] = [];
    const context = {
      fillStyle: "",
      fillRect: () => fills.push(context.fillStyle),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      bezierCurveTo: vi.fn(),
    };
    vi.stubGlobal("document", { createElement: () => ({ getContext: () => context }) });
    const geometry = new BoxGeometry();
    const material = new MeshStandardMaterial();
    const authored = new Mesh(geometry, material);
    authored.userData.relationshipCloth = "banner";
    authored.userData.settlementMotion = "banner";
    const source = new Group();
    source.add(authored);
    const instance = new Mesh(geometry, material.clone());
    const appearance = new SettlementAppearance(source, [instance]);
    appearance.setRelationship("owned");
    const texture = instance.material.map!;
    expect(texture.name).toBe("Camp horned helmet imprint");
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
    authored.userData.relationshipCloth = "trim";
    authored.userData.settlementMotion = "banner";
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

it("clears stale local realm heraldry when metadata disappears during artwork loading", async () => {
  const context = { fillRect: vi.fn(), clearRect: vi.fn(), drawImage: vi.fn() };
  vi.stubGlobal("document", { createElement: () => ({ getContext: () => context }) });
  const finishes: Array<(image: HTMLImageElement) => void> = [];
  vi.spyOn(ImageLoader.prototype, "loadAsync").mockImplementation(
    () => new Promise((resolve) => finishes.push(resolve)),
  );
  const source = new Group();
  const banner = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
  banner.userData.orderCloth = "banner";
  const trim = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
  trim.userData.orderCloth = "trim";
  source.add(banner, trim);
  const appearance = new SettlementAppearance(source, [banner, trim]);
  const first = appearance.setOrder(0);
  await appearance.setOrder(undefined);
  for (const finish of finishes) finish({ width: 128, height: 128 } as HTMLImageElement);
  await first;
  expect(trim.material.color.getHexString()).toBe("aa3028");
  expect(context.drawImage).not.toHaveBeenCalled();
  const lastOrder = orders.at(-1)!;
  await appearance.setOrder(lastOrder.orderId);
  expect(`#${trim.material.color.getHexString()}`.toLowerCase()).toBe("#aa3028");
  expect(context.drawImage).toHaveBeenCalledOnce();
  appearance.dispose();
  for (const mesh of [banner, trim]) {
    mesh.geometry.dispose();
    mesh.material.dispose();
  }
});
