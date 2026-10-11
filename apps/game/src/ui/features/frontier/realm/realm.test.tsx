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
          tiles={[
            { key: "farm", icon: "Fm", name: "Farm", foot: { kind: "price", labor: 6_800, short: false } },
            { key: "workshop", icon: "Wk", name: "Workshop", foot: { kind: "price", labor: 10_000, short: true } },
            { key: "war", icon: "Wa", name: "War hall", foot: { kind: "built" } },
            { key: "lodge", icon: "Ld", name: "Scouts' lodge", foot: { kind: "locked", gate: 3 } },
          ]}
          chosen={0}
          onChoose={onChoose}
          gains={[{ icon: "Wh", value: "+375/h", label: "produces" }]}
          prices={[{ of: "labor", amount: 6_800 }]}
          short={undefined}
          sending={false}
          onBuild={onBuild}
          onMap={() => {}}
          onClose={() => {}}
        />,
      ),
    );
    const tile = (name: string) => host.querySelector<HTMLButtonElement>(`[aria-label="${name}"]`)!;
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

  it("puts the labor held against the price, its wait and Map in Build's place when the realm cannot pay", () => {
    const onMap = vi.fn();
    act(() =>
      root.render(
        <BuildView
          tiles={[{ key: "farm", icon: "Fm", name: "Farm", foot: { kind: "price", labor: 15_000, short: true } }]}
          chosen={0}
          onChoose={() => {}}
          gains={[]}
          prices={[{ of: "labor", amount: 15_000 }]}
          short={{ kind: "short", icon: "La", held: 9_640, need: 15_000, wait: 10 * 3_600 + 44 * 60 }}
          sending={false}
          onBuild={() => {}}
          onMap={onMap}
          onClose={() => {}}
        />,
      ),
    );
    expect(buttons().some((button) => button.textContent?.startsWith("Build"))).toBe(false);
    act(() =>
      buttons()
        .find((button) => button.textContent === "Map")!
        .click(),
    );
    expect(onMap).toHaveBeenCalled();
  });
});

describe("the castle", () => {
  const side = (level: number) => ({
    level,
    art: "/images/buildings/construction/castleOne.png",
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
          now={side(1)}
          next={side(2)}
          prices={[{ of: "labor", amount: 15_000 }]}
          short={undefined}
          sending={false}
          onUpgrade={onUpgrade}
          onMap={() => {}}
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

  it("has no next side and no verb at the last level", () => {
    act(() =>
      root.render(
        <CastleView
          now={side(3)}
          next={null}
          prices={[]}
          short={undefined}
          sending={false}
          onUpgrade={() => {}}
          onMap={() => {}}
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
