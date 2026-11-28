import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";

import { HudPopoverRoot, popoverAboveAnchor, popoverAnchor, useHudPopover } from "./hud-popover";

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
});

const Popover = ({ name }: { name: string }) => {
  const { triggerProps, popover } = useHudPopover();
  return (
    <>
      <button type="button" {...triggerProps}>
        {name}
      </button>
      {popover(<p>{`${name} card`}</p>, { className: "lab-popover" })}
    </>
  );
};

const trigger = (name: string) =>
  [...host.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === name)!;
const shown = () => [...document.querySelectorAll("[data-hud-popover]")].map((layer) => layer.textContent);

it("keeps one popover open over the HUD: opening another closes the first", () => {
  act(() =>
    root.render(
      <>
        <Popover name="Quest" />
        <Popover name="Places" />
      </>,
    ),
  );
  act(() => trigger("Quest").click());
  expect(shown()).toEqual(["Quest card"]);
  expect(trigger("Quest").getAttribute("aria-controls")).toBe(document.querySelector("[data-hud-popover]")!.id);
  act(() => trigger("Places").click());
  expect(shown()).toEqual(["Places card"]);
  expect(trigger("Quest").getAttribute("aria-expanded")).toBe("false");
  act(() => trigger("Places").click());
  expect(shown()).toEqual([]);
});

it("closes on a press outside it and on Escape, handing focus back to its trigger", () => {
  act(() => root.render(<Popover name="Quest" />));
  act(() => trigger("Quest").click());
  act(() => document.querySelector("[data-hud-popover] p")!.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  expect(shown()).toEqual(["Quest card"]);
  act(() => document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  expect(shown()).toEqual([]);
  act(() => trigger("Quest").click());
  expect(document.activeElement).toBe(document.querySelector("[data-hud-popover]"));
  act(() =>
    document
      .querySelector("[data-hud-popover]")!
      .dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })),
  );
  expect(shown()).toEqual([]);
  expect(document.activeElement).toBe(trigger("Quest"));
});

it("anchors a popover under the horizontal centre of its trigger, or above when placed over a bottom bar", () => {
  expect(popoverAnchor({ left: 610, bottom: 44, width: 92 })).toEqual({ x: 656, top: 52 });
  expect(popoverAnchor({ left: 196, bottom: 86, width: 102 })).toEqual({ x: 247, top: 94 });
  expect(popoverAboveAnchor({ left: 80, top: 776, width: 72 }, 844)).toEqual({ x: 116, bottom: 76 });
});

it("opens in the HUD's own root at the HUD's scale, its anchor in that scale's pixels", () => {
  const scaled = document.createElement("div");
  document.body.append(scaled);
  try {
    act(() =>
      root.render(
        <HudPopoverRoot.Provider value={{ node: scaled, scale: 2 }}>
          <Popover name="Quest" />
        </HudPopoverRoot.Provider>,
      ),
    );
    trigger("Quest").getBoundingClientRect = () => ({ left: 600, bottom: 100, width: 80 }) as DOMRect;
    act(() => trigger("Quest").click());
    const layer = scaled.querySelector<HTMLElement>("[data-hud-popover]")!;
    expect(layer.textContent).toBe("Quest card");
    expect([layer.style.getPropertyValue("--popover-x"), layer.style.getPropertyValue("--popover-top")]).toEqual([
      "320px",
      "54px",
    ]);
  } finally {
    scaled.remove();
  }
});
