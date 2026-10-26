import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";

import { useShortcutStore } from "@/hooks/store/use-shortcut-store";

import { KeyboardShortcuts, KeyboardShortcutsSetting } from "./keyboard-shortcuts";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  useShortcutStore.getState().addShortcut({ id: "test.build", key: "b", description: "Open Build", action: () => {} });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  useShortcutStore.getState().removeShortcutsByPrefix("test.");
});

/** Settings as it holds the keys: the one row, and the list in its place once Show is pressed. */
const SettingsKeys = () => {
  const [shown, setShown] = useState(false);
  return shown ? (
    <KeyboardShortcuts onBack={() => setShown(false)} />
  ) : (
    <KeyboardShortcutsSetting onShow={() => setShown(true)} />
  );
};

const press = async (name: string) => {
  const button = [...host.querySelectorAll("button")].find(
    (candidate) => (candidate.getAttribute("aria-label") ?? candidate.textContent) === name,
  )!;
  await act(async () => button.click());
};

const keysListed = () =>
  [...host.querySelectorAll("dl > div")].map((row) => [
    row.querySelector("dt")!.textContent,
    row.querySelector("dd")!.textContent,
  ]);

it("lists no key in Settings, only the row that opens them, one press away", async () => {
  await act(async () => root.render(<SettingsKeys />));
  expect(host.querySelector(".ui-setting__name")!.textContent).toBe("Keyboard shortcuts");
  expect(keysListed()).toEqual([]);

  await press("Show");
  expect(host.querySelector("h2")!.textContent).toBe("Keyboard shortcuts");
  expect(keysListed()).toEqual([
    ["B", "Open Build"],
    ["Enter", "Open chat"],
  ]);

  await press("Back");
  expect(keysListed()).toEqual([]);
  expect(host.querySelector(".ui-setting__name")!.textContent).toBe("Keyboard shortcuts");
});

it("lists every meaning of a key bound twice whole, a line each, never cut short (qa-app-1 P3-2)", async () => {
  const long = "Back out one step";
  useShortcutStore.getState().addShortcut({
    id: "test.back-local",
    key: "Escape",
    description: "Return to world view from local view",
    action: () => {},
  });
  useShortcutStore.getState().addShortcut({ id: "test.back", key: "Escape", description: long, action: () => {} });
  await act(async () => root.render(<KeyboardShortcuts onBack={() => {}} />));
  const esc = [...host.querySelectorAll("dl > div")].find((row) => row.querySelector("dt")!.textContent === "Esc")!;
  const meanings = esc.querySelector("dd")!;
  expect([...meanings.children].map((line) => line.textContent)).toEqual([
    "Return to world view from local view",
    long,
  ]);
  // Nothing in the row clips its words: no truncation, wherever the list is narrow.
  expect([meanings, ...meanings.children].some((element) => element.classList.contains("truncate"))).toBe(false);
});
