// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import {
  HUD_COLUMN_MARK,
  HUD_FOOT_MARK,
  HUD_TOP_MARK,
  inOpenMapArea,
  keepLabelsBesideHudColumns,
  openMapArea,
} from "./hud-clearance";

/** A HUD column at these screen bounds, as the HUD marks it. */
const column = (left: number, right: number) => {
  const element = document.createElement("aside");
  Object.entries(HUD_COLUMN_MARK).forEach(([name, value]) => element.setAttribute(name, value));
  element.getBoundingClientRect = () => ({ left, right, top: 60, bottom: 1060 }) as DOMRect;
  document.body.append(element);
};

/** A world label CSS2DRenderer anchored at (x, y), this wide. */
const label = (layer: HTMLElement, x: number, y: number, width: number) => {
  const element = document.createElement("div");
  element.style.transform = `translate(-50%,-50%) translate(${x}px,${y}px)`;
  Object.defineProperty(element, "offsetWidth", { value: width });
  layer.append(element);
  return element;
};

afterEach(() => document.body.replaceChildren());

it("shifts a label anchored on the open map back beside the column it would reach under", () => {
  column(12, 332);
  column(1588, 1908);
  const layer = document.createElement("div");
  const crate = label(layer, 425, 200, 300);
  const nearRight = label(layer, 1500, 400, 300);
  keepLabelsBesideHudColumns(layer);
  expect(crate.style.translate).toBe("57px 0");
  expect(nearRight.style.translate).toBe("-62px 0");
});

it("leaves a label alone clear of the columns, under one, or once it no longer reaches", () => {
  column(12, 332);
  const layer = document.createElement("div");
  const open = label(layer, 900, 200, 300);
  const under = label(layer, 200, 200, 300);
  const crate = label(layer, 425, 200, 300);
  keepLabelsBesideHudColumns(layer);
  expect([open.style.translate, under.style.translate]).toEqual(["", ""]);
  crate.style.transform = "translate(-50%,-50%) translate(700px,200px)";
  keepLabelsBesideHudColumns(layer);
  expect(crate.style.translate).toBe("");
});

it("reads every label's width before it moves any, so the page is laid out once, not once per label", () => {
  column(12, 332);
  const layer = document.createElement("div");
  const order: string[] = [];
  for (const x of [425, 430, 435]) {
    const element = document.createElement("div");
    element.style.transform = `translate(-50%,-50%) translate(${x}px,200px)`;
    Object.defineProperty(element, "offsetWidth", {
      get: () => {
        order.push("read");
        return 300;
      },
    });
    const style = element.style;
    let translate = "";
    Object.defineProperty(style, "translate", {
      get: () => translate,
      set: (value: string) => {
        order.push("write");
        translate = value;
      },
    });
    layer.append(element);
  }
  keepLabelsBesideHudColumns(layer);
  expect(order).toEqual(["read", "read", "read", "write", "write", "write"]);
});

it("finds the map's open area between the columns, below their tops and above the order bubbles", () => {
  column(12, 332);
  column(1588, 1908);
  const foot = document.createElement("div");
  Object.entries(HUD_FOOT_MARK).forEach(([name, value]) => foot.setAttribute(name, value));
  foot.getBoundingClientRect = () => ({ left: 344, right: 1576, top: 960, bottom: 1060 }) as DOMRect;
  document.body.append(foot);
  expect(openMapArea({ width: 1920, height: 1080 })).toEqual({ left: 332, right: 1588, top: 60, bottom: 960 });
});

it("is the whole viewport where the HUD marks nothing", () => {
  expect(openMapArea({ width: 1920, height: 1080 })).toEqual({ left: 0, right: 1920, top: 0, bottom: 1080 });
});

it("starts a phone's open area under its top band and ends it on its foot, and says what stands in it", () => {
  const mark = (marks: Record<string, string>, rect: Partial<DOMRect>) => {
    const element = document.createElement("div");
    Object.entries(marks).forEach(([name, value]) => element.setAttribute(name, value));
    element.getBoundingClientRect = () => rect as DOMRect;
    document.body.append(element);
  };
  mark(HUD_TOP_MARK, { left: 8, right: 382, top: 8, bottom: 150 });
  mark(HUD_FOOT_MARK, { left: 8, right: 382, top: 700, bottom: 836 });
  const phone = { width: 390, height: 844 };
  expect(openMapArea(phone)).toEqual({ left: 0, right: 390, top: 150, bottom: 700 });
  expect([inOpenMapArea({ x: 195, y: 400 }, phone), inOpenMapArea({ x: 195, y: 760 }, phone)]).toEqual([true, false]);
});
