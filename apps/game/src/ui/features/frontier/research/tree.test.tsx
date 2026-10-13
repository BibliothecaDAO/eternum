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
    const row = { icon: "Fm" as const, tier: 2 as const, sides: [], choice: false, tip: "" };
    const node = { icon: "Sh" as const, tip: "", essence: 2_000, state: "open" as const };
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
    const named = (name: string) => host.querySelector<HTMLButtonElement>(`[aria-label="${name}"]`)!;
    expect(named("Farm").getAttribute("aria-busy")).toBe("true");
    expect(named("Farm").querySelector('[role="status"]')?.textContent).toBe("Upgrading…");
    expect(named("Farm").textContent).not.toContain("4,000");
    expect(named("Shrine").querySelector('[role="status"]')?.textContent).toBe("Researching…");
    // The rows beside them keep their price and stay free.
    expect(named("Hut").getAttribute("aria-busy")).toBe("false");
    expect(named("Hut").textContent).toContain("500");
    expect(named("Well").textContent).toContain("2,000");
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
              icon: "Fm",
              name: "Farm",
              tier: 2,
              sides: ["Fi"],
              next: { essence: 4_000, labor: 3_000 },
              choice: true,
              tip: "Farm: Fields wheat 1,500 → 1,800/h · Granary limit 18K → 27K",
            },
            { key: "hut", icon: "Ht", name: "Hut", tier: 5, sides: [], next: undefined, choice: false, tip: "Hut" },
          ]}
          castle={[
            {
              key: "shrine",
              icon: "Sh",
              label: "Shrine",
              tip: "Shrine: your armies find Shrines, +200 XP each",
              essence: 2_000,
              state: "open",
            },
            { key: "d2", icon: "Dp", label: "II", tip: "", essence: 400_000, state: "locked" },
          ]}
          onRow={onRow}
          onCastle={onCastle}
        />,
      ),
    );
    const farm = host.querySelector<HTMLButtonElement>('[aria-label="Farm"]')!;
    expect(farm.textContent).toBe("FarmUncommon4,0003,000");
    // Each row and castle row says what it gives on its tooltip.
    expect(farm.getAttribute("data-tip")).toBe("Farm: Fields wheat 1,500 → 1,800/h · Granary limit 18K → 27K");
    expect(host.querySelector('[aria-label="Shrine"]')!.getAttribute("data-tip")).toBe(
      "Shrine: your armies find Shrines, +200 XP each",
    );
    expect(host.querySelector('[aria-label="Hut"] img[src="/image-icons/kit/ui-check.png"]')).not.toBeNull();
    expect(host.querySelector<HTMLButtonElement>('[aria-label="II"]')!.className).toContain("opacity-50");
    act(() => farm.click());
    act(() => host.querySelector<HTMLButtonElement>('[aria-label="Shrine"]')!.click());
    expect(onRow).toHaveBeenCalledWith("farm");
    expect(onCastle).toHaveBeenCalledWith("shrine");
  });

  it("lifts one of a tier's two sides and upgrades beside the seal; at legendary nothing is next", () => {
    const onLift = vi.fn();
    const onUpgrade = vi.fn();
    const sheet = (tier: 2 | 5) => (
      <TypeUpgradeSheet
        icon="Fm"
        name="Farm"
        tier={tier}
        sides={[
          { icon: "Fi", name: "Fields", gain: { icon: "Wh", label: "wheat", value: "1,500 → 1,800/h" } },
          { icon: "Gr", name: "Granary", gain: { icon: "Sg", label: "limit", value: "18K → 27K" } },
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
    expect(host.querySelector('[aria-label="Granary"]')?.getAttribute("aria-checked")).toBe("true");
    act(() => host.querySelector<HTMLButtonElement>('[aria-label="Fields"]')!.click());
    expect(onLift).toHaveBeenCalledWith(0);
    expect(host.querySelector('img[src="/image-icons/kit/final-seal.png"]')).not.toBeNull();
    act(() =>
      buttons()
        .find((button) => button.textContent === "Upgrade4,0003,000")!
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
          icon="Bs"
          name="Barracks"
          tier={1}
          sides={[
            { icon: "Dr", name: "Drill", gain: { icon: "Tr", label: "troops", value: "101 → 126/h" } },
            { icon: "Ra", name: "Rations", gain: { icon: "Wh", label: "wheat", value: "2 → 1.75" } },
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
    const upgrade = buttons().find((button) => button.textContent === "Upgrade4,0003,000")!;
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
          icon="Bs"
          name="Barracks"
          now={[
            { icons: ["Tr"], label: "troops each makes an hour", value: "+101/h" },
            { icons: ["Bs"], label: "standing", value: "×2" },
            { icons: ["Tr", "Sg"], label: "troops held of its store's limit", value: "2,976 / 6,000" },
            { icons: ["Pp"], label: "population each takes", value: "3" },
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
          node={{ key: "d2", icon: "E2", label: "II", tip: "", essence: 400_000, state: "locked" }}
          gives={null}
          refusal={{ reason: { kind: "failed", line: "Needs Ethereal I" } }}
          sending={false}
          onResearch={() => {}}
          onClose={() => {}}
        />,
      ),
    );
    expect(buttons().find((button) => button.textContent === "Research400,000")!.disabled).toBe(true);
    expect(host.querySelector('[role="status"]')!.textContent).toBe("Needs Ethereal I");
  });

  it("researches a castle row for its Essence", () => {
    const onResearch = vi.fn();
    act(() =>
      root.render(
        <CastleNodeSheet
          node={{ key: "well", icon: "Wl", label: "Well", tip: "", essence: 6_000, state: "open" }}
          gives={null}
          sending={false}
          onResearch={onResearch}
          onClose={() => {}}
        />,
      ),
    );
    act(() =>
      buttons()
        .find((button) => button.textContent === "Research6,000")!
        .click(),
    );
    expect(onResearch).toHaveBeenCalled();
  });
});
