// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

/** The game mode the panel is drawn in. */
const mode = vi.hoisted(() => ({ id: "blitz" as "blitz" | "eternum" | "frontier" }));
vi.mock("@/config/game-modes/use-game-mode-config", () => ({ useGameModeConfig: () => ({ id: mode.id }) }));

import { DestroyBuildingButton } from "./destroy-building-button";

let host: HTMLDivElement;
let root: Root;
const press = (label: string) =>
  act(() => host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!.click());
const draw = (building: string, onDestroy: () => void, busy = false) =>
  act(() => root.render(<DestroyBuildingButton key={building} busy={busy} onDestroy={onDestroy} />));

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  root = createRoot(host);
});
afterEach(() => act(() => root.unmount()));

it.each(["blitz", "eternum"] as const)("deletes the building on one press in %s, asking nothing", (id) => {
  mode.id = id;
  const destroy = vi.fn();
  draw("7:10:10", destroy);
  press("Delete");
  expect(destroy).toHaveBeenCalledTimes(1);
  expect(host.querySelector('[aria-label="Confirm delete"]')).toBeNull();
});

it("asks first in Frontier, and deletes once on OK", () => {
  mode.id = "frontier";
  const destroy = vi.fn();
  draw("7:10:10", destroy);
  press("Delete");
  expect(destroy).not.toHaveBeenCalled();
  press("Confirm delete");
  expect(destroy).toHaveBeenCalledTimes(1);
});

it("drops the question when another building is picked, deleting nothing", () => {
  mode.id = "frontier";
  const destroy = vi.fn();
  draw("7:10:10", destroy);
  press("Delete");
  draw("7:11:10", destroy);
  expect(host.querySelector('[aria-label="Confirm delete"]')).toBeNull();
  expect(destroy).not.toHaveBeenCalled();
});

it("takes no press while a delete is on its way", () => {
  mode.id = "blitz";
  const destroy = vi.fn();
  draw("7:10:10", destroy, true);
  press("Delete");
  expect(destroy).not.toHaveBeenCalled();
});
