import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BuildingType } from "@bibliothecadao/types";

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
    expect(host.querySelector(".ui-cost")?.textContent).toBe("15K labor");
    expect(buttons().find((button) => button.textContent === "Upgrade")!.closest(".ui-window__foot")).not.toBeNull();
    act(() =>
      buttons()
        .find((button) => button.textContent === "Upgrade")!
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
    expect(host.querySelector(".ui-cost")?.textContent).toBe("4,000 labor");
    const upgrade = buttons().find((button) => button.textContent === "Upgrade")!;
    expect(upgrade.disabled).toBe(true);
    // The verb, why it cannot run and the fix stand in the sheet's foot, never squeezed or scrolled away on a phone.
    expect(upgrade.closest(".ui-window__foot")).not.toBeNull();
    expect(host.querySelector('.ui-window__foot [role="status"]')).not.toBeNull();
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
