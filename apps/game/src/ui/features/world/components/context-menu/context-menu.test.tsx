// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useUIStore } from "@/hooks/store/use-ui-store";
import { SceneName } from "@/three/types/common";
import type { ContextMenuAction } from "@/types/context-menu";

import { ContextMenu } from "./context-menu";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useUIStore.getState().closeContextMenu();
});

const action = (label: string, rest: Partial<ContextMenuAction> = {}): ContextMenuAction => ({
  id: label,
  label,
  onSelect: vi.fn(),
  ...rest,
});

/** The menus on screen, each by its title (the first has none) and its items' words. */
const menus = () =>
  [...host.querySelectorAll<HTMLElement>(".ui-menu")].map((menu) => ({
    title: menu.querySelector(".ui-menu__title")?.textContent ?? null,
    items: [...menu.querySelectorAll(".ui-menu__label")].map((label) => label.textContent),
    left: Number.parseFloat(menu.parentElement!.style.left),
  }));
const press = (label: string) =>
  act(() =>
    [...host.querySelectorAll<HTMLButtonElement>(".ui-menu__item")]
      .find((item) => item.querySelector(".ui-menu__label")?.textContent === label)!
      .click(),
  );

it("opens each submenu beside the list it came from, its row lit, with no Back and no arrows", () => {
  const farm = action("Farm");
  useUIStore.getState().openContextMenu({
    id: "realm",
    position: { x: 40, y: 40 },
    scene: SceneName.Hexception,
    actions: [
      action("Build", {
        childTitle: "Select Building Category",
        children: [action("Resource Buildings", { childTitle: "Resource Buildings", children: [farm] })],
      }),
      action("Transfer"),
    ],
  });
  act(() => root.render(<ContextMenu />));

  press("Build");
  press("Resource Buildings");
  const [first, second, third] = menus();
  expect([first, second, third].map(({ title, items }) => ({ title, items }))).toEqual([
    { title: null, items: ["Build", "Transfer"] },
    { title: "Select Building Category", items: ["Resource Buildings"] },
    { title: "Resource Buildings", items: ["Farm"] },
  ]);
  // Each stands to the right of the one before, every list still open.
  expect(first!.left < second!.left && second!.left < third!.left).toBe(true);
  expect([...host.querySelectorAll('.ui-menu__item[data-state="hover"]')].map((item) => item.textContent)).toEqual([
    "Build",
    "Resource Buildings",
  ]);
  expect(host.querySelector('[aria-label="Back"], [data-icon="chevron-left"], [data-icon="chevron-right"]')).toBeNull();

  press("Farm");
  expect(farm.onSelect).toHaveBeenCalledOnce();
  expect(useUIStore.getState().contextMenu).toBeNull();
});

it("closes a deeper submenu when another row of an earlier list is opened", () => {
  useUIStore.getState().openContextMenu({
    id: "realm",
    position: { x: 40, y: 40 },
    scene: SceneName.Hexception,
    actions: [
      action("Build", { children: [action("Resource Buildings", { children: [action("Farm")] })] }),
      action("Train", { children: [action("Knight")] }),
    ],
  });
  act(() => root.render(<ContextMenu />));
  press("Build");
  press("Resource Buildings");
  press("Train");
  expect(menus().map(({ items }) => items)).toEqual([["Build", "Train"], ["Knight"]]);
});
