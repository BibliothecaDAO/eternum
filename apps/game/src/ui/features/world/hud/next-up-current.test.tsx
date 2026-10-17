// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@/ui/modules/entity-details/hooks/use-realm-level-up", () => ({ useRealmLevelUp: () => null }));

import { NextUpView } from "./next-up";
import { useNextUpShows } from "./next-up-shows";
import type { NextStep } from "./next-step";

const step = (key: string, verb: string | null = `Do ${key}`): NextStep => ({
  key,
  kind: "order",
  line: `Step ${key}.`,
  verb,
  busy: false,
  run: verb === null ? null : vi.fn(),
});

let host: HTMLDivElement;
let root: Root;
const draw = (steps: NextStep[], refusal: string | null = null) =>
  act(() => root.render(<NextUpView steps={steps} refusal={refusal} />));
const shown = () => host.querySelector("p")?.textContent;
const button = (word: string) => [...host.querySelectorAll("button")].find((each) => each.textContent?.includes(word));

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div");
  root = createRoot(host);
});
afterEach(() => act(() => root.unmount()));

it("shows the current step, lets the player page to the others, and is back on the current one when it changes", () => {
  const [lost, explore, crate] = [step("lost"), step("explore"), step("crate")];
  draw([explore, crate]);
  expect(shown()).toBe("Step explore.");

  act(() => button("1 of 2")!.click());
  expect(shown()).toBe("Step crate.");
  draw([explore, crate]);
  expect(shown()).toBe("Step crate.");

  draw([lost, explore, crate]);
  expect(shown()).toBe("Step lost.");
  expect(button("1 of 3")).toBeDefined();
});

it("wraps from the last page back to the current step", () => {
  draw([step("a"), step("b")]);
  act(() => button("1 of 2")!.click());
  act(() => button("2 of 2")!.click());
  expect(shown()).toBe("Step a.");
});

it("waits before play opens: the button is disabled, says when play starts, and Space takes nothing", () => {
  draw([step("raise")], "Starts in 2m 42s");
  expect(button("Do raise")!.disabled).toBe(true);
  expect(host.textContent).toContain("Starts in 2m 42s");
  expect(useNextUpShows.getState().act).toBeNull();

  draw([step("raise")]);
  expect(button("Do raise")!.disabled).toBe(false);
  expect(useNextUpShows.getState().act).not.toBeNull();
});

it("draws no button for a step the player takes on the map", () => {
  draw([step("explore", null)]);
  expect(shown()).toBe("Step explore.");
  expect(host.querySelectorAll("section button")).toHaveLength(1);
  expect(useNextUpShows.getState()).toEqual({ showing: false, act: null });
});

it("collapses only from its chevron and title, never from a stray click on its header", () => {
  draw([step("a"), step("b")]);
  const header = host.querySelector("section > div")! as HTMLElement;
  act(() => header.click());
  act(() => button("1 of 2")!.click());
  expect(shown()).toBe("Step b.");
  act(() => button("Next up")!.click());
  expect(shown()).toBeUndefined();
  act(() => button("Next up")!.click());
  expect(shown()).toBe("Step b.");
});
