import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BuildingType } from "@bibliothecadao/types";

import { BuildView } from "../build/build-view";
import { CastleView } from "../upgrade/castle-view";
import { BuildingsRow } from "./buildings-row";

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

describe("the build sheet", () => {
  it("prices each building in labor, ticks one already standing, locks one behind its gate, and builds", () => {
    const onBuild = vi.fn();
    const onChoose = vi.fn();
    act(() =>
      root.render(
        <BuildView
          population={{ free: 2, total: 6 }}
          tiles={[
            { key: "farm", icon: "farm", name: "Farm", tip: "", foot: { kind: "price", labor: 6_800, short: false } },
            {
              key: "workshop",
              icon: "workshop",
              name: "Workshop",
              tip: "",
              foot: { kind: "price", labor: 10_000, short: true },
            },
            { key: "war", icon: "war-hall", name: "War hall", tip: "", foot: { kind: "built" } },
            { key: "lodge", icon: "scout-lodge", name: "Scouts' lodge", tip: "", foot: { kind: "locked", gate: 3 } },
          ]}
          chosen={0}
          onChoose={onChoose}
          gains={[{ icon: "wheat", value: "+375/h", label: "produces" }]}
          prices={[{ of: "labor", amount: 6_800 }]}
          refusal={undefined}
          sending={false}
          onBuild={onBuild}
          onClose={() => {}}
        />,
      ),
    );
    const tile = (name: string) => host.querySelector<HTMLButtonElement>(`[aria-label="${name}"]`)!;
    // The head holds what is free of the realm's population, and says so in words on its tooltip.
    const population = host.querySelector('[aria-label="population 2 / 6"]')!;
    expect(population.getAttribute("data-tip")).toBe("population 2 free of 6");
    expect(tile("Workshop").textContent).toBe("Workshop10,000");
    expect(tile("War hall").className).toContain("opacity-50");
    expect(tile("Scouts' lodge").querySelector('[aria-label="Rare"]')).not.toBeNull();
    act(() => tile("Workshop").click());
    expect(onChoose).toHaveBeenCalledWith(1);
    act(() =>
      buttons()
        .find((button) => button.textContent === "Build6,800")!
        .click(),
    );
    expect(onBuild).toHaveBeenCalled();
  });

  it("says in one line what the building needs against what there is, with the fix on the gold button in Build's place", () => {
    const onFix = vi.fn();
    act(() =>
      root.render(
        <BuildView
          population={{ free: 2, total: 6 }}
          tiles={[
            { key: "farm", icon: "farm", name: "Farm", tip: "", foot: { kind: "price", labor: 15_000, short: true } },
          ]}
          chosen={0}
          onChoose={() => {}}
          gains={[]}
          prices={[{ of: "labor", amount: 15_000 }]}
          refusal={{
            reason: { kind: "short", of: "labor", held: 9_640, need: 15_000, wait: 10 * 3_600 + 44 * 60 },
            fix: { icon: "map", word: "Explore for labor", onFix },
          }}
          sending={false}
          onBuild={() => {}}
          onClose={() => {}}
        />,
      ),
    );
    expect(host.querySelector('[role="status"]')!.textContent).toBe("Needs 15,000 labor, have 9,640 · in 10h 44m");
    expect(buttons().some((button) => button.textContent?.startsWith("Build"))).toBe(false);
    act(() =>
      buttons()
        .find((button) => button.textContent === "Explore for labor")!
        .click(),
    );
    expect(onFix).toHaveBeenCalled();
  });
});

describe("the castle", () => {
  const CASTLE_MAKES = [
    { icons: ["labor" as const], label: "labor the castle makes an hour", value: "+101/h" },
    {
      icons: ["labor" as const, "resources" as const],
      label: "labor held of its store's limit",
      value: "2,011 / 6,000",
    },
  ];

  it("shows what the castle itself makes an hour and what its store holds, each named for the tooltip", () => {
    act(() =>
      root.render(
        <CastleView
          makes={CASTLE_MAKES}
          now={side(0)}
          next={side(1)}
          prices={[{ of: "labor", amount: 4_000 }]}
          refusal={undefined}
          sending={false}
          onUpgrade={() => {}}
          onClose={() => {}}
        />,
      ),
    );
    expect(host.querySelector('[aria-label="labor the castle makes an hour +101/h"]')!.textContent).toBe("+101/h");
    expect(host.querySelector('[aria-label="labor held of its store\'s limit 2,011 / 6,000"]')).not.toBeNull();
  });

  const side = (level: number) => ({
    level,
    art: "realm-1" as const,
    plots: [6, 18, 36, 60][level],
    slots: [3, 4, 5, 6][level],
    limit: undefined,
    deployCap: [3_000, 9_000, 25_000, 50_000][level],
  });

  it("shows the level now and next with what it brings, and upgrades for its labor", () => {
    const onUpgrade = vi.fn();
    act(() =>
      root.render(
        <CastleView
          makes={CASTLE_MAKES}
          now={side(1)}
          next={side(2)}
          prices={[{ of: "labor", amount: 15_000 }]}
          refusal={undefined}
          sending={false}
          onUpgrade={onUpgrade}
          onClose={() => {}}
        />,
      ),
    );
    const sheet = host.querySelector("section[aria-label='Castle']")!;
    expect(sheet.textContent).toContain("City");
    expect(sheet.textContent).toContain("Kingdom");
    expect(sheet.querySelector('[aria-label="plots 36"]')).not.toBeNull();
    act(() =>
      buttons()
        .find((button) => button.textContent === "Upgrade15,000")!
        .click(),
    );
    expect(onUpgrade).toHaveBeenCalled();
  });

  it("keeps Upgrade, dimmed, with its price when the realm cannot pay, over the line that says why and the fix", () => {
    const onUpgrade = vi.fn();
    const onFix = vi.fn();
    act(() =>
      root.render(
        <CastleView
          makes={CASTLE_MAKES}
          now={side(0)}
          next={side(1)}
          prices={[{ of: "labor", amount: 4_000 }]}
          refusal={{
            reason: { kind: "short", of: "labor", held: 2_011, need: 4_000, wait: 19 * 3_600 + 44 * 60 },
            fix: { icon: "map", word: "Explore for labor", onFix },
          }}
          sending={false}
          onUpgrade={onUpgrade}
          onClose={() => {}}
        />,
      ),
    );
    const upgrade = buttons().find((button) => button.textContent === "Upgrade4,000")!;
    expect(upgrade.disabled).toBe(true);
    act(() => upgrade.click());
    expect(onUpgrade).not.toHaveBeenCalled();
    expect(host.querySelector('[role="status"]')!.textContent).toBe("Needs 4,000 labor, have 2,011 · in 19h 44m");
    act(() =>
      buttons()
        .find((button) => button.textContent === "Explore for labor")!
        .click(),
    );
    expect(onFix).toHaveBeenCalled();
  });

  it("has no next side and no verb at the last level", () => {
    act(() =>
      root.render(
        <CastleView
          makes={CASTLE_MAKES}
          now={side(3)}
          next={null}
          prices={[]}
          refusal={undefined}
          sending={false}
          onUpgrade={() => {}}
          onClose={() => {}}
        />,
      ),
    );
    expect(buttons().some((button) => button.textContent?.startsWith("Upgrade"))).toBe(false);
  });
});

describe("the Buildings row", () => {
  it("counts the four common types and opens a type in one tap", () => {
    const onOpen = vi.fn();
    act(() =>
      root.render(
        <BuildingsRow
          counts={{
            [BuildingType.ResourceWheat]: 18,
            [BuildingType.ResourceKnightT1]: 18,
            [BuildingType.ResourceLabor]: 8,
          }}
          onOpen={onOpen}
        />,
      ),
    );
    expect(host.textContent).toBe("Buildings18188—");
    act(() => host.querySelector<HTMLButtonElement>('[aria-label="Barracks 18"]')!.click());
    expect(onOpen).toHaveBeenCalledWith(BuildingType.ResourceKnightT1);
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Hut —"]')!.disabled).toBe(true);
  });
});
