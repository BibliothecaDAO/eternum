import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TypeUpgradeSheet } from "../upgrade/type-upgrade-sheet";
import { CastleNodeSheet, TreePage } from "./tree-page";

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

const buttons = () => [...host.querySelectorAll<HTMLButtonElement>("button")];

describe("a research in flight on the castle's tree", () => {
  it("shows on its own row, in the price's place, where the player looks once the sheet has closed", () => {
    const row = { icon: "farm" as const, tier: 2 as const, sides: [], choice: false, tip: "" };
    const node = { icon: "shrine" as const, tip: "", essence: 2_000, state: "open" as const };
    act(() =>
      root.render(
        <TreePage
          essence={18_250}
          labor={9_640}
          rows={[
            { ...row, key: "farm", name: "Farm", next: { essence: 4_000, labor: 3_000 }, researching: true },
            { ...row, key: "hut", name: "Hut", next: { essence: 500, labor: 300 } },
          ]}
          castle={[
            { ...node, key: "shrine", label: "Shrine", researching: true },
            { ...node, key: "well", label: "Well" },
          ]}
          onRow={() => {}}
          onCastle={() => {}}
        />,
      ),
    );
    // A type's row is the row around its title; a castle row is its ring, named, with its name beside it.
    const rowNamed = (name: string) =>
      [...host.querySelectorAll<HTMLElement>(".ui-row")].find(
        (each) => each.querySelector(".ui-row__title")?.textContent === name,
      )!;
    const ring = (name: string) => host.querySelector<HTMLButtonElement>(`[aria-label="${name}"]`)!;
    expect(rowNamed("Farm").querySelector('[role="status"]')?.textContent).toBe("Upgrading…");
    expect(rowNamed("Farm").textContent).not.toContain("4,000");
    expect(ring("Shrine").querySelector('[role="status"]')?.textContent).toBe("Researching…");
    // The rows beside them keep their price and say nothing is under way.
    expect(rowNamed("Hut").querySelector('[role="status"]')).toBeNull();
    expect(rowNamed("Hut").textContent).toContain("500");
    expect(ring("Well").textContent).toContain("2,000");
  });
});

describe("the castle's tree", () => {
  it("rows each standing type with its tier, sides and next price, then the castle rows, and opens either", () => {
    const onRow = vi.fn();
    const onCastle = vi.fn();
    act(() =>
      root.render(
        <TreePage
          essence={18_250}
          labor={9_640}
          rows={[
            {
              key: "farm",
              icon: "farm",
              name: "Farm",
              tier: 2,
              sides: ["fields"],
              next: { essence: 4_000, labor: 3_000 },
              choice: true,
              tip: "Farm: Fields wheat 1,500 → 1,800/h · Granary limit 18K → 27K",
            },
            {
              key: "hut",
              icon: "workers-hut",
              name: "Hut",
              tier: 5,
              sides: [],
              next: undefined,
              choice: false,
              tip: "Hut",
            },
          ]}
          castle={[
            {
              key: "shrine",
              icon: "shrine",
              label: "Shrine",
              tip: "Shrine: your armies find Shrines, +200 XP each",
              essence: 2_000,
              state: "open",
            },
            { key: "d2", icon: "portal", label: "II", tip: "", essence: 400_000, state: "locked" },
          ]}
          onRow={onRow}
          onCastle={onCastle}
        />,
      ),
    );
    const row = (name: string) =>
      [...host.querySelectorAll<HTMLElement>(".ui-row")].find(
        (each) => each.querySelector(".ui-row__title")?.textContent === name,
      )!;
    const farm = row("Farm");
    expect(farm.textContent).toBe("FarmUncommon4,0003,000");
    // Each row and castle row says what it gives on its tooltip.
    expect(farm.getAttribute("data-tip")).toBe("Farm: Fields wheat 1,500 → 1,800/h · Granary limit 18K → 27K");
    expect(host.querySelector('[aria-label="Shrine"]')!.getAttribute("data-tip")).toBe(
      "Shrine: your armies find Shrines, +200 XP each",
    );
    expect(row("Hut").querySelector('img[src="/icons/facets/64/check.webp"]')).not.toBeNull();
    // A locked castle row carries the lock on its ring.
    expect(host.querySelector('[aria-label="II"] img[src="/icons/facets/64/lock.webp"]')).not.toBeNull();
    act(() => farm.querySelector<HTMLButtonElement>("button")!.click());
    act(() => host.querySelector<HTMLButtonElement>('[aria-label="Shrine"]')!.click());
    expect(onRow).toHaveBeenCalledWith("farm");
    expect(onCastle).toHaveBeenCalledWith("shrine");
  });

  it("lifts one of a tier's two sides and upgrades beside the seal; at legendary nothing is next", () => {
    const onLift = vi.fn();
    const onUpgrade = vi.fn();
    const sheet = (tier: 2 | 5) => (
      <TypeUpgradeSheet
        icon="farm"
        name="Farm"
        tier={tier}
        sides={[
          { icon: "fields", name: "Fields", gain: { icon: "wheat", label: "wheat", value: "1,500 → 1,800/h" } },
          { icon: "granary", name: "Granary", gain: { icon: "resources", label: "limit", value: "18K → 27K" } },
        ]}
        lifted={1}
        onLift={onLift}
        prices={[
          { of: "essence", amount: 4_000 },
          { of: "labor", amount: 3_000 },
        ]}
        sending={false}
        onUpgrade={onUpgrade}
        onClose={() => {}}
      />
    );
    act(() => root.render(sheet(2)));
    const side = (name: string) => buttons().find((button) => button.textContent?.startsWith(name))!;
    expect(side("Granary").getAttribute("aria-pressed")).toBe("true");
    expect(side("Fields").getAttribute("aria-pressed")).toBe("false");
    act(() => side("Fields").click());
    expect(onLift).toHaveBeenCalledWith(0);
    expect(host.querySelector('img[src="/icons/facets/64/final-seal.webp"]')).not.toBeNull();
    expect(host.querySelector(".ui-cost")?.textContent).toBe("4,000 Essence · 3,000 labor");
    act(() =>
      buttons()
        .find((button) => button.textContent === "Upgrade")!
        .click(),
    );
    expect(onUpgrade).toHaveBeenCalled();
    act(() => root.render(sheet(5)));
    expect(buttons().some((button) => button.textContent?.startsWith("Upgrade"))).toBe(false);
  });

  it("ends a tier still waiting for its side in Upgrade, dimmed with its price, and says to choose one", () => {
    const onUpgrade = vi.fn();
    const onResearch = vi.fn();
    act(() =>
      root.render(
        <TypeUpgradeSheet
          icon="barracks"
          name="Barracks"
          tier={1}
          sides={[
            { icon: "drill", name: "Drill", gain: { icon: "troops", label: "troops", value: "101 → 126/h" } },
            { icon: "rations", name: "Rations", gain: { icon: "wheat", label: "wheat", value: "2 → 1.75" } },
          ]}
          onLift={() => {}}
          prices={[
            { of: "essence", amount: 4_000 },
            { of: "labor", amount: 3_000 },
          ]}
          sending={false}
          onUpgrade={onUpgrade}
          onResearch={onResearch}
          onClose={() => {}}
        />,
      ),
    );
    expect(host.querySelector(".ui-cost")?.textContent).toBe("4,000 Essence · 3,000 labor");
    const upgrade = buttons().find((button) => button.textContent === "Upgrade")!;
    expect(upgrade.disabled).toBe(true);
    expect(host.querySelector('[role="status"]')!.textContent).toBe("Choose Drill or Rations");
    // Opened from the board, the head leads to Research, where the type's row stands.
    act(() =>
      buttons()
        .find((button) => button.textContent === "Research")!
        .click(),
    );
    expect(onResearch).toHaveBeenCalledOnce();
  });

  it("shows what a standing building does now: what each makes, how many stand, what the store holds", () => {
    act(() =>
      root.render(
        <TypeUpgradeSheet
          icon="barracks"
          name="Barracks"
          now={[
            { icons: ["troops"], label: "troops each makes an hour", value: "+101/h" },
            { icons: ["barracks"], label: "standing", value: "×2" },
            { icons: ["troops", "resources"], label: "troops held of its store's limit", value: "2,976 / 6,000" },
            { icons: ["person"], label: "population each takes", value: "3" },
          ]}
          tier={1}
          prices={[]}
          sending={false}
          onUpgrade={() => {}}
          onClose={() => {}}
        />,
      ),
    );
    const said = [...host.querySelectorAll('[role="img"][aria-label]')].map((chip) => chip.getAttribute("aria-label"));
    expect(said).toEqual(
      expect.arrayContaining([
        "troops each makes an hour +101/h",
        "standing ×2",
        "troops held of its store's limit 2,976 / 6,000",
        "population each takes 3",
      ]),
    );
  });

  it("says which row a locked castle row waits for, with Research dimmed over it", () => {
    act(() =>
      root.render(
        <CastleNodeSheet
          node={{ key: "d2", icon: "depth-2", label: "II", tip: "", essence: 400_000, state: "locked" }}
          gives={null}
          refusal={{ reason: { kind: "failed", line: "Needs Ethereal I" } }}
          sending={false}
          onResearch={() => {}}
          onClose={() => {}}
        />,
      ),
    );
    expect(host.querySelector(".ui-cost")?.textContent).toBe("400K Essence");
    expect(buttons().find((button) => button.textContent === "Research")!.disabled).toBe(true);
    expect(host.querySelector('[role="status"]')!.textContent).toBe("Needs Ethereal I");
  });

  it("researches a castle row for its Essence", () => {
    const onResearch = vi.fn();
    act(() =>
      root.render(
        <CastleNodeSheet
          node={{ key: "well", icon: "well", label: "Well", tip: "", essence: 6_000, state: "open" }}
          gives={null}
          sending={false}
          onResearch={onResearch}
          onClose={() => {}}
        />,
      ),
    );
    expect(host.querySelector(".ui-cost")?.textContent).toBe("6,000 Essence");
    act(() =>
      buttons()
        .find((button) => button.textContent === "Research")!
        .click(),
    );
    expect(onResearch).toHaveBeenCalled();
  });
});
