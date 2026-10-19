// @vitest-environment jsdom
import { act } from "react";
import { PerspectiveCamera, Vector3 } from "three";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { HUD_COLUMN_MARK } from "../utils/labels/hud-clearance";
import { MapPlateLayer } from "./map-plate-layer";
import type { ArmyPlate, StructurePlate } from "./map-plate-model";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const army: ArmyPlate = {
  kind: "army",
  relation: "enemy",
  owner: "Tamsin",
  homeName: "Niziz",
  troops: { type: "knight", tier: 1, count: 1321 },
  stamina: { current: 60, max: 120 },
};

const realm: StructurePlate = {
  kind: "structure",
  relation: "enemy",
  owner: "Tamsin",
  name: "Niziz",
  named: true,
  guards: [
    { type: "knight", tier: 1, count: 300 },
    { type: "paladin", tier: 3, count: 600 },
  ],
  arrivals: [],
  icon: "realm",
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

  it("shows a beast's species and strength without a tier while armies retain theirs", async () => {
    const structures = layer.createScope("structure");
    const armies = layer.createScope("army");
    structures.setLabel({
      entityId: 1,
      position: new Vector3(-3, 0, 0),
      plate: {
        ...realm,
        relation: "neutral",
        name: "Ruin",
        named: false,
        place: "Woecrag",
        beast: "Wyvern",
        guards: [{ type: "knight", tier: 1, count: 2800, beast: "wyvern" }],
        icon: "beast-wyvern",
      },
    });
    armies.setLabel({ entityId: 2, position: new Vector3(3, 0, 0), plate: army });
    await frame();
    expect(plateOf("Wyvern")!.textContent).toBe("Wyvern2,800");
    expect(plateOf("Wyvern")!.querySelector('[data-icon="beast-wyvern"]')).not.toBeNull();
    expect(plateOf("Tamsin")!.textContent).toContain("T1");
    structures.setHover(1);
    await frame();
    expect([...plateOf("Wyvern")!.querySelectorAll(".mp-plate__row")].map((row) => row.textContent)).toEqual([
      "Woecrag Ruin",
      "Wyvern",
      "2,800",
    ]);
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
    // Opened, the guard total gives way to its slots in the order an attacker meets them.
    expect(isOpen("Niziz")).toBe(true);
    expect(plateOf("Niziz")!.textContent).toContain("›");

    structures.clearHover();
    await frame();
    expect(isOpen("Niziz")).toBe(false);

    layer.setSelected(1);
    await frame();
    expect(isOpen("Niziz")).toBe(true);
    expect(plateOf("Niziz")!.dataset.selected).toBe("true");
  });

  it("keeps the selected army's plate open, with its home, while another tile is hovered", async () => {
    const armies = layer.createScope("army");
    const structures = layer.createScope("structure");
    armies.setLabel({
      entityId: 2,
      position: new Vector3(0, 0, 0),
      plate: { ...army, owner: "clientlane", homeName: "Stolsli" },
    });
    structures.setLabel({ entityId: 1, position: new Vector3(3, 0, 0), plate: realm });
    layer.setSelected(2);
    await frame();
    expect(isOpen("clientlane")).toBe(true);
    expect(plateOf("clientlane")!.textContent).toContain("Stolsli");

    structures.setHover(1);
    await frame();
    expect(isOpen("Niziz")).toBe(true);
    expect(isOpen("clientlane")).toBe(true);
    expect(plateOf("clientlane")!.textContent).toContain("Stolsli");
    // Its stamina on its own row under its troops, as at rest: three rows, the last its exact reading.
    const rows = [...plateOf("clientlane")!.querySelectorAll(".mp-plate__row")];
    expect(rows).toHaveLength(3);
    expect(rows[2].textContent).toBe("60/120");
    expect(rows[2].querySelector(".mp-plate__meter")).not.toBeNull();

    structures.clearHover();
    await frame();
    expect(isOpen("Niziz")).toBe(false);
    expect(isOpen("clientlane")).toBe(true);
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

  it("places a plate React committed after a frame had already run, on a still map", async () => {
    const structures = layer.createScope("structure");
    structures.setLabel({ entityId: 1, position: new Vector3(0, 0, 0), plate: realm });
    // A game frame runs before the layer's React root commits the new plate.
    layer.update(camera, 800, 600);
    await frame();
    expect(plateOf("Niziz")!.style.display).toBe("");
    expect(plateOf("Niziz")!.style.transform).toMatch(/^translate\(400px, /);
  });

  it("moves its plates when the camera's projection changes and its place does not", async () => {
    layer.createScope("structure").setLabel({ entityId: 1, position: new Vector3(2, 0, 0), plate: realm });
    await frame();
    const before = plateOf("Niziz")!.style.transform;
    const zoomed = camera.clone();
    zoomed.zoom = 2;
    zoomed.updateProjectionMatrix();
    await act(async () => {
      await Promise.resolve();
    });
    layer.update(zoomed, 800, 600);
    expect(plateOf("Niziz")!.style.transform).not.toBe(before);
  });

  it("steps a plate beside a HUD column it would reach under", async () => {
    const column = document.createElement("aside");
    Object.entries(HUD_COLUMN_MARK).forEach(([name, value]) => column.setAttribute(name, value));
    column.getBoundingClientRect = () => ({ left: 0, right: 300, top: 0, bottom: 600 }) as DOMRect;
    document.body.append(column);
    const width = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth")!;
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
      configurable: true,
      get(this: HTMLElement) {
        return this.classList.contains("mp-at") ? 300 : 0;
      },
    });
    try {
      // Anchored on the open map 100px right of the column, 300px wide: it would reach 50px under it.
      layer.createScope("structure").setLabel({ entityId: 1, position: new Vector3(0, 0, 0), plate: realm });
      await frame();
      expect(plateOf("Niziz")!.style.translate).toBe("50px 0");
    } finally {
      Object.defineProperty(HTMLElement.prototype, "offsetWidth", width);
      column.remove();
    }
  });
});
