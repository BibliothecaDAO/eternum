// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { HUD_COLUMN_MARK, keepLabelsBesideHudColumns } from "./hud-clearance";

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
