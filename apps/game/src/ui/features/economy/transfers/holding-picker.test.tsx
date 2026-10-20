// @vitest-environment jsdom
import { StructureType } from "@bibliothecadao/types";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

// The owner's Blitz holdings of 20 October: six realms, four villages, a camp, three rifts and a Hyperstructure.
const facts = vi.hoisted(() => ({ structures: [] as unknown[] }));

vi.mock("@/config/game-modes/use-game-mode-config", () => ({ useGameModeConfig: () => ({ id: "blitz" }) }));
vi.mock("@/hooks/context/game-context", () => ({ useGame: () => ({ setup: { store: {} } }) }));
vi.mock("@/hooks/use-fact-view", () => ({ useFactView: () => facts.structures }));
vi.mock("@/sync/fact-views", () => ({ playerStructuresView: {} }));
vi.mock("@/ui/features/world/containers/top-header/structure-picker/use-structures-with-metadata", () => ({
  useStructuresWithMetadata: () => facts.structures,
}));
vi.mock("@/ui/design-system/icon", () => ({ Icon: () => null }));

import { HoldingPicker } from "./holding-picker";

const ESSENCE_RIFT = 1;
const holding = (entityId: number, category: StructureType, displayName: string) => ({
  entityId,
  category,
  displayName,
  realmLevel: 0,
  realmLevelLabel: category === StructureType.Realm ? "Settlement" : null,
  isFavorite: false,
  structure: { base: { category }, metadata: { mine_kind: ESSENCE_RIFT } },
});
const several = (from: number, count: number, category: StructureType, name: string) =>
  Array.from({ length: count }, (_, index) => holding(from + index, category, `${name} ${index + 1}`));

let host: HTMLDivElement;
let root: Root;
let sheet: HTMLStyleElement;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  facts.structures = [
    ...several(1, 6, StructureType.Realm, "Realm"),
    ...several(10, 4, StructureType.Village, "Village"),
    holding(20, StructureType.Camp, "Camp"),
    ...several(30, 3, StructureType.Mine, "Rift"),
    holding(40, StructureType.Hyperstructure, "Mythical Hyperstructure"),
  ];
  // The HUD's own style sheet, its build-time theme() values read as 0: what this reads is its rules, not its sizes.
  sheet = document.createElement("style");
  sheet.textContent = readFileSync(join(__dirname, "../../../design-system/kit/hud-sheet.css"), "utf8").replace(
    /theme\([^)]*\)/g,
    "0",
  );
  document.head.append(sheet);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  sheet.remove();
});

const tabs = () => [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')];

it("offers every kind held, a Hyperstructure among them, as compact tabs in a row that wraps rather than leave its panel", () => {
  act(() =>
    root.render(<HoldingPicker title="Send to" chosen={[]} otherEnd={[]} onPick={vi.fn()} note={() => null} />),
  );

  expect(tabs().map((tab) => tab.getAttribute("aria-label"))).toEqual([
    "Realms, 6",
    "Villages, 4",
    "Camps, 1",
    "Rifts, 3",
    "Hyperstructures, 1",
  ]);
  // No tab spells its kind out, the lit one included: each is its painting with its count on it.
  expect(
    tabs().every(
      (tab) => tab.dataset.shape === "mark" && tab.textContent === tab.querySelector(".ui-chip")?.textContent,
    ),
  ).toBe(true);
  expect(getComputedStyle(host.querySelector('[role="tablist"]')!).flexWrap).toBe("wrap");
  // The heading names the kind shown instead.
  expect(host.querySelector("h3")?.textContent).toBe("Send to · Realms");
});

it("sends to a Hyperstructure held: its tab lists it, the heading names it, and picking it chooses it", () => {
  const onPick = vi.fn();
  act(() =>
    root.render(<HoldingPicker title="Send to" chosen={[]} otherEnd={[1]} onPick={onPick} note={() => null} />),
  );

  act(() =>
    tabs()
      .find((tab) => tab.getAttribute("aria-label") === "Hyperstructures, 1")!
      .click(),
  );
  expect(host.querySelector("h3")?.textContent).toBe("Send to · Hyperstructures");
  const rows = [...host.querySelectorAll<HTMLButtonElement>('[role="tabpanel"] button.ui-row')];
  expect(rows.map((row) => row.textContent)).toEqual(["Mythical Hyperstructure"]);
  act(() => rows[0]!.click());
  expect(onPick).toHaveBeenCalledWith(40);
});
