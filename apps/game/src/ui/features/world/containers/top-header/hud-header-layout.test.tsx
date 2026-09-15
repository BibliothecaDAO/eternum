import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import { HudHeaderLayout } from "./hud-header-layout";

let container: HTMLDivElement;
let root: Root;

const slot = (name: string) => <span data-slot={name}>{name}</span>;

const render = (lane: "portrait" | "landscape" | null) =>
  act(async () =>
    root.render(
      <HudHeaderLayout
        lane={lane}
        identity={slot("identity")}
        clock={slot("clock")}
        viewControls={slot("views")}
        attention={slot("attention")}
        settings={slot("settings")}
      />,
    ),
  );

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
});

it("keeps portrait settings in the bounded status row and navigation in its own row", async () => {
  await render("portrait");
  const statusRow = container.querySelector('[aria-label="Game status"]')!;
  const navigationRow = container.querySelector('[aria-label="Map navigation"]')!;

  expect([...statusRow.querySelectorAll("[data-slot]")].map((node) => node.textContent)).toEqual([
    "identity",
    "clock",
    "settings",
  ]);
  expect([...navigationRow.querySelectorAll("[data-slot]")].map((node) => node.textContent)).toEqual([
    "views",
    "attention",
  ]);
});

it("retains the single-row desktop order", async () => {
  await render(null);
  expect([...container.querySelectorAll("[data-slot]")].map((node) => node.textContent)).toEqual([
    "identity",
    "views",
    "clock",
    "attention",
    "settings",
  ]);
});
