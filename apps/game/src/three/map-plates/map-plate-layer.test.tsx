// @vitest-environment jsdom
import { act } from "react";
import { PerspectiveCamera, Vector3 } from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HUD_COLUMN_MARK } from "../utils/labels/hud-clearance";
import { MapPlateLayer } from "./map-plate-layer";
import { plateSize } from "./map-plate-layout";
import type { ArmyPlate, StructurePlate } from "./map-plate-model";
import { tokenSize } from "./map-plate-token";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Each label drawn, its token or its plate, by its owner's name, as React renders it. */
const { drawn } = vi.hoisted(() => ({ drawn: [] as string[] }));
vi.mock("./map-plates", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./map-plates")>();
  return {
    ...actual,
    Plate: (props: Parameters<typeof actual.Plate>[0]) => {
      drawn.push(`plate ${props.plate.owner}`);
      return <actual.Plate {...props} />;
    },
  };
});
vi.mock("./map-plate-token", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./map-plate-token")>();
  return {
    ...actual,
    Token: (props: Parameters<typeof actual.Token>[0]) => {
      drawn.push(`token ${props.plate.owner}`);
      return <actual.Token {...props} />;
    },
  };
});

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
  const isOpen = (text: string) => Boolean(plateOf(text)?.querySelector('[data-open="true"]'));
  const isToken = (text: string) => Boolean(plateOf(text)?.querySelector(".mp-token"));
  const placeOf = (element: HTMLElement) => {
    const [, x, y] = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(element.style.transform)!;
    return { x: Number(x), y: Number(y) };
  };

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
    // At rest, its token: the species' portrait and the guard's count, no tier chip; the army's token keeps its tier.
    const beastToken = plateOf("2,800")!.querySelector<HTMLElement>(".mp-token")!;
    expect(beastToken.textContent).toBe("2,800");
    expect(beastToken.querySelector('[data-icon="beast-wyvern"]')).not.toBeNull();
    expect(beastToken.getAttribute("aria-label")).toBe("Wyvern 2,800");
    expect(plateOf("1,321")!.textContent).toContain("T1");
    structures.setHover(1);
    await frame();
    expect([...plateOf("Wyvern")!.querySelectorAll(".mp-plate__row")].map((row) => row.textContent)).toEqual([
      "Woecrag Ruin",
      "Wyvern",
      "2,800",
    ]);
  });

  it("draws every thing as its token right over it, and follows the thing as it moves", async () => {
    const armies = layer.createScope("army");
    armies.setLabel({ entityId: 2, position: new Vector3(0, 0, 0), plate: army });
    await frame();
    expect(isToken("1,321")).toBe(true);
    const before = plateOf("1,321")!;
    expect(placeOf(before).x).toBe(Math.round(400 - tokenSize(army).width / 2));
    expect(before.style.transform).not.toBe("");
    const first = before.style.transform;

    armies.setLabel({ entityId: 2, position: new Vector3(2, 0, 0), plate: army });
    await frame();
    expect(plateOf("1,321")!.style.transform).not.toBe(first);
    expect(plateOf("1,321")!.style.display).toBe("");
  });

  it("opens the hovered thing's plate in its token's place, and keeps the selected one open, ringed", async () => {
    const structures = layer.createScope("structure");
    structures.setLabel({ entityId: 1, position: new Vector3(0, 0, 0), plate: realm });
    await frame();
    const token = container.querySelector<HTMLElement>(".mp-at")!;
    expect(token.querySelector(".mp-token")).not.toBeNull();
    // Where the token was drawn, before anything opened.
    const drawnToken = { ...placeOf(token), ...tokenSize(realm) };

    structures.setHover(1);
    await frame();
    // Opened: the token gives way to the plate, standing on the token's foot, its slots in attack order.
    expect(isOpen("Niziz")).toBe(true);
    expect(plateOf("Niziz")!.querySelector(".mp-token")).toBeNull();
    expect(plateOf("Niziz")!.textContent).toContain("›");
    const size = plateSize(realm, "open");
    const plate = placeOf(plateOf("Niziz")!);
    // On the token's foot, its middle over the token's (to the pixel each was rounded to).
    expect(Math.abs(plate.x + size.width / 2 - (drawnToken.x + drawnToken.width / 2))).toBeLessThanOrEqual(1);
    expect(Math.abs(plate.y + size.height - (drawnToken.y + drawnToken.height))).toBeLessThanOrEqual(1);

    structures.clearHover();
    await frame();
    expect(container.querySelector(".mp-token")).not.toBeNull();
    expect(container.querySelector('[data-open="true"]')).toBeNull();

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
    // Its stamina on its own row under its troops: three rows, the last its exact reading.
    const rows = [...plateOf("clientlane")!.querySelectorAll(".mp-plate__row")];
    expect(rows).toHaveLength(3);
    expect(rows[2].textContent).toBe("60/120");
    expect(rows[2].querySelector(".mp-plate__meter")).not.toBeNull();

    structures.clearHover();
    await frame();
    expect(container.querySelectorAll('[data-open="true"]')).toHaveLength(1);
    expect(isOpen("clientlane")).toBe(true);
  });

  it("leaves out 'player | home' on the player's own army while selected, not while its tile is hovered", async () => {
    const armies = layer.createScope("army");
    armies.setLabel({
      entityId: 2,
      position: new Vector3(0, 0, 0),
      plate: { ...army, relation: "own", owner: "djizus" },
    });
    armies.setHover(2);
    await frame();
    expect(plateOf("1,321")!.textContent).toContain("djizus");

    armies.clearHover();
    layer.setSelected(2);
    await frame();
    // Its troops, then its stamina: two rows.
    const rows = [...plateOf("1,321")!.querySelectorAll(".mp-plate__row")].map((row) => row.textContent);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toBe("60/120");
    expect(plateOf("1,321")!.textContent).not.toContain("djizus");
  });

  it("drops the labels of things no longer placed, and only its own scope's", async () => {
    const armies = layer.createScope("army");
    const structures = layer.createScope("structure");
    armies.setLabel({ entityId: 2, position: new Vector3(-3, 0, 0), plate: army });
    armies.setLabel({
      entityId: 4,
      position: new Vector3(3, 0, 0),
      plate: { ...army, troops: { ...army.troops, count: 77 } },
    });
    structures.setLabel({ entityId: 2, position: new Vector3(0, 0, 3), plate: realm });
    await frame();
    expect(layer.labelCount).toBe(3);

    armies.retainOnly([2]);
    await frame();
    expect(plateOf("77")).toBeUndefined();
    expect(plateOf("1,321")).toBeDefined();
    expect(layer.labelCount).toBe(2);
  });

  it("hides its labels while another scene is on screen", async () => {
    layer.createScope("structure").setLabel({ entityId: 1, position: new Vector3(0, 0, 0), plate: realm });
    await frame();
    const element = container.querySelector<HTMLElement>('[data-role="map-plates"]')!;

    layer.setVisible(false);
    expect(element.style.display).toBe("none");
    layer.setVisible(true);
    expect(element.style.display).toBe("");
  });

  it("places a label React committed after a frame had already run, on a still map", async () => {
    const structures = layer.createScope("structure");
    structures.setLabel({ entityId: 1, position: new Vector3(0, 0, 0), plate: realm });
    // A game frame runs before the layer's React root commits the new label.
    layer.update(camera, 800, 600);
    await frame();
    const element = container.querySelector<HTMLElement>(".mp-at")!;
    expect(element.style.display).toBe("");
    expect(placeOf(element).x).toBe(Math.round(400 - tokenSize(realm).width / 2));
  });

  it("moves its labels when the camera's projection changes and its place does not", async () => {
    layer.createScope("structure").setLabel({ entityId: 1, position: new Vector3(2, 0, 0), plate: realm });
    await frame();
    const element = container.querySelector<HTMLElement>(".mp-at")!;
    const before = element.style.transform;
    const zoomed = camera.clone();
    zoomed.zoom = 2;
    zoomed.updateProjectionMatrix();
    await act(async () => {
      await Promise.resolve();
    });
    layer.update(zoomed, 800, 600);
    expect(element.style.transform).not.toBe(before);
  });

  it("steps a token beside a HUD column it would reach under", async () => {
    const column = document.createElement("aside");
    Object.entries(HUD_COLUMN_MARK).forEach(([name, value]) => column.setAttribute(name, value));
    column.getBoundingClientRect = () =>
      ({ x: 0, y: 0, left: 0, width: 390, right: 390, top: 0, height: 600, bottom: 600 }) as DOMRect;
    document.body.append(column);
    try {
      // Its thing on the open map 10px right of the column: its token would reach under it, so it stands beside it.
      layer.createScope("structure").setLabel({ entityId: 1, position: new Vector3(0, 0, 0), plate: realm });
      await frame();
      expect(placeOf(container.querySelector<HTMLElement>(".mp-at")!).x).toBe(390);
    } finally {
      column.remove();
    }
  });

  it("lays a token out at its drawn size once it is on the page, not at its estimate", async () => {
    const width = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth")!;
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
      configurable: true,
      get(this: HTMLElement) {
        return this.classList.contains("mp-token") ? 200 : 0;
      },
    });
    try {
      layer.createScope("structure").setLabel({ entityId: 1, position: new Vector3(0, 0, 0), plate: realm });
      await frame();
      // Drawn 200px wide: centred over its thing, 100px to either side.
      expect(placeOf(container.querySelector<HTMLElement>(".mp-at")!).x).toBe(300);
    } finally {
      Object.defineProperty(HTMLElement.prototype, "offsetWidth", width);
    }
  });

  it("places the order line beside its tile, and the token it covers steps aside until it goes", async () => {
    layer.createScope("structure").setLabel({ entityId: 1, position: new Vector3(0, 0, 0), plate: realm });
    await frame();
    const element = container.querySelector<HTMLElement>(".mp-at")!;
    const { y } = placeOf(element);
    const at = layer.placeOrderLine({ at: { x: 400, y: y - 30 }, size: { width: 80, height: 40 } });
    expect(at).toEqual({ x: 412, y: y - 4 });
    expect(element.dataset.yields).toBe("true");

    layer.placeOrderLine(null);
    expect(element.dataset.yields).toBe("false");
  });

  it("draws again only the label whose tile is hovered, not every label on the map", async () => {
    const armies = layer.createScope("army");
    ["Oren", "Tamsin", "Ysolde"].forEach((owner, index) =>
      armies.setLabel({ entityId: index + 1, position: new Vector3(index * 3 - 3, 0, 0), plate: { ...army, owner } }),
    );
    await frame();
    drawn.length = 0;

    armies.setHover(2);
    await frame();
    expect(drawn).toEqual(["plate Tamsin"]);
    expect(isOpen("Tamsin")).toBe(true);
  });

  it("moves a marching army's label each frame without drawing it again", async () => {
    const armies = layer.createScope("army");
    armies.setLabel({ entityId: 2, position: new Vector3(0, 0, 0), plate: army });
    await frame();
    const before = plateOf("1,321")!.style.transform;
    drawn.length = 0;

    armies.setPosition(2, new Vector3(2, 0, 0));
    await frame();
    expect(plateOf("1,321")!.style.transform).not.toBe(before);
    expect(drawn).toEqual([]);
    // A thing with no label has nothing to move.
    armies.setPosition(9, new Vector3(1, 0, 0));
    await frame();
    expect(container.querySelectorAll(".mp-at")).toHaveLength(1);
  });

  it("reads every drawn size before it places or hides any label, so a frame lays the page out once", async () => {
    const armies = layer.createScope("army");
    armies.setLabel({ entityId: 1, position: new Vector3(0, 0, 0), plate: army });
    armies.setLabel({ entityId: 2, position: new Vector3(2, 0, 0), plate: { ...army, owner: "Oren" } });
    armies.setLabel({ entityId: 3, position: new Vector3(0, 0, 0), plate: { ...army, owner: "Ysolde" } });
    await frame();
    // The third walks off screen: the frame must read the others' sizes before it hides it.
    const order: string[] = [];
    const width = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth")!;
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
      configurable: true,
      get() {
        order.push("read");
        return 40;
      },
    });
    const elements = [...container.querySelectorAll<HTMLElement>(".mp-at")];
    for (const element of elements)
      for (const name of ["transform", "display"] as const) {
        let value = element.style[name];
        Object.defineProperty(element.style, name, {
          configurable: true,
          get: () => value,
          set: (next: string) => {
            order.push("write");
            value = next;
          },
        });
      }
    try {
      armies.setLabel({ entityId: 3, position: new Vector3(0, 0, 500), plate: { ...army, owner: "Ysolde" } });
      armies.setLabel({ entityId: 1, position: new Vector3(1, 0, 0), plate: army });
      await frame();
    } finally {
      Object.defineProperty(HTMLElement.prototype, "offsetWidth", width);
    }
    expect(order).toContain("read");
    expect(order.slice(order.indexOf("write"))).not.toContain("read");
  });
});

describe("a plate's drawn size, as the layer weighs it frame after frame (review-plate-icons-4)", () => {
  const ownArmy: ArmyPlate = { ...army, relation: "own", owner: "djizus" };
  const camera = new PerspectiveCamera(50, 800 / 600, 0.1, 100);
  camera.position.set(0, 10, 10);
  camera.lookAt(0, 0, 0);
  const restore: (() => void)[] = [];

  /**
   * The real layer over a still map, its thing at the middle of the screen, the HUD's columns leaving a corridor 13px
   * wider than the plate's estimate (room for it and its 6px gaps, with 1px over), the plate drawn `extra` px wider than
   * that estimate and its token 74×50. Each frame passes RELAYOUT_MS, so every frame lays out again.
   */
  const stage = (view: "selected" | "open", extra: number) => {
    const estimate = plateSize(ownArmy, view);
    const drawn = { width: estimate.width + extra, height: estimate.height };
    for (const [property, value] of [
      ["offsetWidth", (element: HTMLElement) => (element.classList.contains("mp-token") ? 74 : drawn.width)],
      ["offsetHeight", (element: HTMLElement) => (element.classList.contains("mp-token") ? 50 : drawn.height)],
    ] as const) {
      const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, property)!;
      Object.defineProperty(HTMLElement.prototype, property, {
        configurable: true,
        get(this: HTMLElement) {
          return this.classList.contains("mp-token") || this.classList.contains("mp-plate") ? value(this) : 0;
        },
      });
      restore.push(() => Object.defineProperty(HTMLElement.prototype, property, original));
    }
    const corridor = estimate.width + 13;
    const columns = [0, 400 + corridor / 2].map((x) => {
      const column = document.createElement("aside");
      Object.entries(HUD_COLUMN_MARK).forEach(([name, value]) => column.setAttribute(name, value));
      const width = 400 - corridor / 2;
      column.getBoundingClientRect = () =>
        ({ x, y: 0, width, height: 600, left: x, right: x + width, top: 0, bottom: 600 }) as DOMRect;
      document.body.append(column);
      return column;
    });
    restore.push(() => columns.forEach((column) => column.remove()));
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => (now += 501));
    restore.push(() => vi.restoreAllMocks());
    const container = document.createElement("div");
    document.body.append(container);
    const layer = new MapPlateLayer(() => container);
    restore.push(() => container.remove());
    restore.push(() => act(async () => layer.dispose()) as unknown as void);
    const scope = layer.createScope("army");
    scope.setLabel({ entityId: 1, position: new Vector3(0, 0, 0), plate: ownArmy });
    const frame = async () => {
      await act(async () => {
        await Promise.resolve();
        layer.update(camera, 800, 600);
      });
      return container.querySelector<HTMLElement>(".mp-at")!.dataset.view;
    };
    const frames = async (count: number) => {
      const views: (string | undefined)[] = [];
      for (let index = 0; index < count; index += 1) views.push(await frame());
      return views;
    };
    const ask = () => (view === "selected" ? layer.setSelected(1) : scope.setHover(1));
    return { frames, ask, columns };
  };

  afterEach(async () => {
    for (const undo of restore.splice(0).reverse()) await undo();
  });

  for (const view of ["selected", "open"] as const) {
    it(`keeps a ${view} plate that is drawn too wide for its place closed, frame after frame, on a still map`, async () => {
      const { frames, ask } = stage(view, 2);
      await frames(2);
      ask();
      // It opens once at its estimate, is drawn 2px wider, and stays its token from then on: no flicker, no redraws.
      const views = await frames(10);
      expect(views.slice(2)).toEqual(Array(8).fill("token"));
      expect(views.filter((shown, index) => index > 0 && shown !== views[index - 1]).length).toBeLessThanOrEqual(1);
    });

    it(`keeps a ${view} plate that fits open, frame after frame`, async () => {
      const { frames, ask } = stage(view, 0);
      await frames(2);
      ask();
      expect(await frames(10)).toEqual(Array(10).fill(view));
    });
  }

  it("opens a plate it closed once the room it needs is there", async () => {
    const { frames, ask, columns } = stage("selected", 2);
    await frames(2);
    ask();
    expect((await frames(6)).at(-1)).toBe("token");
    // The HUD's columns go: the plate is weighed at its drawn size, which now fits.
    columns.forEach((column) => column.remove());
    expect(await frames(4)).toEqual(Array(4).fill("selected"));
  });
});
