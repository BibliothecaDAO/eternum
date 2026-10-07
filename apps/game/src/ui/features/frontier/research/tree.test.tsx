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
            },
            { key: "hut", icon: "Ht", name: "Hut", tier: 5, sides: [], next: undefined, choice: false },
          ]}
          castle={[
            { key: "shrine", icon: "Sh", label: "Shrine", essence: 2_000, state: "open" },
            { key: "d2", icon: "Dp", label: "II", essence: 400_000, state: "locked" },
          ]}
          onRow={onRow}
          onCastle={onCastle}
        />,
      ),
    );
    const farm = host.querySelector<HTMLButtonElement>('[aria-label="Farm"]')!;
    expect(farm.textContent).toBe("FarmUncommon4,0003,000");
    expect(host.querySelector('[aria-label="Hut"] img[src="/image-icons/ui-check.png"]')).not.toBeNull();
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
          { icon: "Gr", name: "Granary", gain: { icon: "Sg", label: "limit", value: "18k → 27k" } },
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
    expect(host.querySelector('img[src="/image-icons/ui-star.png"]')).not.toBeNull();
    act(() =>
      buttons()
        .find((button) => button.textContent === "Upgrade4,0003,000")!
        .click(),
    );
    expect(onUpgrade).toHaveBeenCalled();
    act(() => root.render(sheet(5)));
    expect(buttons().some((button) => button.textContent?.startsWith("Upgrade"))).toBe(false);
  });

  it("researches a castle row for its Essence", () => {
    const onResearch = vi.fn();
    act(() =>
      root.render(
        <CastleNodeSheet
          node={{ key: "well", icon: "Wl", label: "Well", essence: 6_000, state: "open" }}
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
