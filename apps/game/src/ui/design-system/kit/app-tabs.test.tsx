import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";

import { AppTabs } from "./app-elements";

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

const AGES = [
  { key: "blitz", label: "Blitz" },
  { key: "frontier", label: "Frontier" },
  { key: "eternum", label: "Eternum" },
] as const;

const Ages = () => {
  const [age, setAge] = useState<(typeof AGES)[number]["key"]>("blitz");
  return (
    <AppTabs tabs={AGES} value={age} onChange={setAge} label="Ages">
      <p>{`${age} board`}</p>
    </AppTabs>
  );
};

const tabs = () => [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
const chosen = () => tabs().find((tab) => tab.getAttribute("aria-selected") === "true")!;
const press = (key: string) =>
  act(() => {
    document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });

it("draws the chosen view as the panel its tab controls and is labelled by", () => {
  act(() => root.render(<Ages />));
  const panel = host.querySelector<HTMLElement>('[role="tabpanel"]')!;
  expect(panel.textContent).toBe("blitz board");
  expect(chosen().getAttribute("aria-controls")).toBe(panel.id);
  expect(panel.getAttribute("aria-labelledby")).toBe(chosen().id);
});

it("is one tab stop, and the arrows, Home and End move the choice and the focus, wrapping at the ends", () => {
  act(() => root.render(<Ages />));
  expect(tabs().map((tab) => tab.tabIndex)).toEqual([0, -1, -1]);
  act(() => chosen().focus());

  press("ArrowRight");
  expect(chosen().textContent).toBe("Frontier");
  expect(document.activeElement).toBe(chosen());
  expect(tabs().map((tab) => tab.tabIndex)).toEqual([-1, 0, -1]);
  expect(host.querySelector('[role="tabpanel"]')!.textContent).toBe("frontier board");

  press("End");
  expect(chosen().textContent).toBe("Eternum");
  press("ArrowRight");
  expect(chosen().textContent).toBe("Blitz");
  press("ArrowLeft");
  expect(chosen().textContent).toBe("Eternum");
  press("Home");
  expect(chosen().textContent).toBe("Blitz");
  expect(document.activeElement).toBe(chosen());
});
