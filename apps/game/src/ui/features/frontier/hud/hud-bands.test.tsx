import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { HudBands } from "./hud-bands";

let host: HTMLDivElement;
let root: Root;

/** A phone held upright, or sideways (the sideways query matches). */
const holdPhone = (sideways: boolean) =>
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: sideways && query.includes("orientation: landscape"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

const draw = (page?: boolean) =>
  act(() =>
    root.render(
      <HudBands
        strip={<i data-part="strip" />}
        nextUp={<i data-part="next-up" />}
        page={page ? <i data-part="page" /> : undefined}
        action={<i data-part="action" />}
        dock={<i data-part="dock" />}
        nav={<i data-part="nav" />}
      />,
    ),
  );

/** The bands' parts in reading order, each with the HUD band it stands in (its top, foot or side column). */
const parts = () =>
  [...host.querySelectorAll("[data-part]")].map((part) => {
    const band = part.closest("[data-hud-top], [data-hud-foot], [data-hud-column]");
    const kind = band?.hasAttribute("data-hud-top")
      ? "top"
      : band?.hasAttribute("data-hud-foot")
        ? "foot"
        : band
          ? "column"
          : "map";
    return `${part.getAttribute("data-part")}:${kind}`;
  });

it("stands upright as bands: the strip and Next up over the map, the action row, the dock and the places under it", () => {
  holdPhone(false);
  draw();
  expect(parts()).toEqual(["strip:top", "next-up:top", "action:foot", "dock:foot", "nav:foot"]);
});

it("stands sideways as a rail of places at the left and one column at the right, the map between them", () => {
  holdPhone(true);
  draw();
  expect(parts()).toEqual(["nav:column", "strip:column", "next-up:column", "action:column", "dock:column"]);
});

it("puts a nav page where the action row and the dock stood, held either way, and keeps the map", () => {
  holdPhone(false);
  draw(true);
  expect(parts()).toEqual(["strip:top", "next-up:top", "page:foot", "nav:foot"]);
  holdPhone(true);
  draw(true);
  expect(parts()).toEqual(["nav:column", "strip:column", "next-up:column", "page:column"]);
});
