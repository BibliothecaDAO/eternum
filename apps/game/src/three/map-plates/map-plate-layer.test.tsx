// @vitest-environment jsdom
import { act } from "react";
import { PerspectiveCamera, Vector3 } from "three";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MapPlateLayer } from "./map-plate-layer";
import type { ArmyPlate, StructurePlate } from "./map-plate-model";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const army: ArmyPlate = {
  kind: "army",
  relation: "enemy",
  owner: "Tamsin",
  homeName: "Niziz",
  code: "3·2",
  troops: { type: "knight", tier: 1, count: 1321 },
  stamina: 0.5,
};

const realm: StructurePlate = {
  kind: "structure",
  relation: "enemy",
  title: "Niziz",
  icon: "realm",
  owner: "Tamsin",
  nobody: "Unclaimed",
  level: 1,
  code: "3·1",
  guards: [],
  arrivals: [],
};

describe("the map's plate layer, as the world map's managers drive it", () => {
  let container: HTMLDivElement;
  let layer: MapPlateLayer;
  const camera = new PerspectiveCamera(50, 800 / 600, 0.1, 100);
  camera.position.set(0, 10, 10);
  camera.lookAt(0, 0, 0);

  const frame = async () => {
    await act(async () => {
      await Promise.resolve();
    });
    layer.update(camera, 800, 600);
  };
  const plateOf = (text: string) =>
    [...container.querySelectorAll<HTMLElement>(".mp-at")].find((element) => element.textContent?.includes(text));
  const isOpen = (text: string) => plateOf(text)?.querySelector('[data-open="true"]') !== null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    layer = new MapPlateLayer(() => container);
  });

  afterEach(async () => {
    await act(async () => layer.dispose());
    container.remove();
  });

  it("draws a thing's plate over it, and follows the thing as it moves", async () => {
    const armies = layer.createScope("army");
    armies.setLabel({ entityId: 2, position: new Vector3(0, 0, 0), plate: army });
    await frame();
    const before = plateOf("Tamsin")!.style.transform;
    expect(before).toMatch(/^translate\(400px, /);

    armies.setLabel({ entityId: 2, position: new Vector3(2, 0, 0), plate: army });
    await frame();
    expect(plateOf("Tamsin")!.style.transform).not.toBe(before);
    expect(plateOf("Tamsin")!.style.display).toBe("");
  });

  it("opens the plate whose tile is hovered, and keeps the selected one open, ringed", async () => {
    const structures = layer.createScope("structure");
    structures.setLabel({ entityId: 1, position: new Vector3(0, 0, 0), plate: realm });
    await frame();
    expect(isOpen("Niziz")).toBe(false);

    structures.setHover(1);
    await frame();
    expect(plateOf("Niziz")!.textContent).toContain("Level 1");

    structures.clearHover();
    await frame();
    expect(isOpen("Niziz")).toBe(false);

    layer.setSelected(1);
    await frame();
    expect(isOpen("Niziz")).toBe(true);
    expect(plateOf("Niziz")!.dataset.selected).toBe("true");
  });

  it("drops the plates of things no longer placed, and only its own scope's", async () => {
    const armies = layer.createScope("army");
    const structures = layer.createScope("structure");
    armies.setLabel({ entityId: 2, position: new Vector3(-3, 0, 0), plate: army });
    armies.setLabel({ entityId: 4, position: new Vector3(3, 0, 0), plate: { ...army, owner: "Oren" } });
    structures.setLabel({ entityId: 2, position: new Vector3(0, 0, 3), plate: realm });
    await frame();

    armies.retainOnly([2]);
    await frame();
    expect(plateOf("Oren")).toBeUndefined();
    expect(plateOf("Tamsin")).toBeDefined();
    expect(plateOf("Niziz")).toBeDefined();
  });

  it("hides its plates while another scene is on screen", async () => {
    layer.createScope("structure").setLabel({ entityId: 1, position: new Vector3(0, 0, 0), plate: realm });
    await frame();
    const element = container.querySelector<HTMLElement>('[data-role="map-plates"]')!;

    layer.setVisible(false);
    expect(element.style.display).toBe("none");
    layer.setVisible(true);
    expect(element.style.display).toBe("");
  });
});
