import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CastleView } from "../upgrade/castle-view";

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
  it("shows the labor the castle makes a minute in its table's corner, never the labor held the top bar shows", () => {
    act(() =>
      root.render(
        <CastleView
          laborRate="+1.7/min"
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
    const head = host.querySelector("[data-castle-card] [data-compare] > :first-child")!;
    expect(head.textContent).toBe("+1.7/minSettlementCity");
    expect(host.querySelector('[role="meter"]')).toBeNull();
  });

  const side = (level: number) => ({
    level,
    art: "realm-1" as const,
    plots: [6, 18, 36, 60][level],
    slots: [3, 4, 5, 6][level],
    limit: [6_000, 18_000, 50_000, 120_000][level],
    maxArmySize: [3_000, 9_000, 25_000, 60_000][level],
  });

  it("shows the level now and next with what it brings, and upgrades for its labor", () => {
    const onUpgrade = vi.fn();
    act(() =>
      root.render(
        <CastleView
          laborRate="+1.7/min"
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
    // One table read across, each thing the level gives now → next, in the owner's words (no "troops a deploy").
    const rows = [...sheet.querySelectorAll("[data-compare] > div:not(:first-child)")].map((row) =>
      [...row.children].map((cell) => cell.textContent),
    );
    expect(rows).toEqual([
      ["Plots", "18", "→", "36"],
      ["Army slots", "4", "→", "5"],
      ["Storage", "18K", "→", "50K"],
      ["Max army size", "9,000", "→", "25K"],
    ]);
    expect(host.querySelector(".ui-cost")?.textContent).toBe("15K labor");
    expect(
      buttons()
        .find((button) => button.textContent === "Upgrade")!
        .closest(".ui-window__foot"),
    ).not.toBeNull();
    act(() =>
      buttons()
        .find((button) => button.textContent === "Upgrade")!
        .click(),
    );
    expect(onUpgrade).toHaveBeenCalled();
  });

  it("keeps Upgrade, dimmed, beside what it needs against what is held when the realm cannot pay, and nothing else", () => {
    const onUpgrade = vi.fn();
    act(() =>
      root.render(
        <CastleView
          laborRate="+1.7/min"
          now={side(0)}
          next={side(1)}
          prices={[{ of: "labor", amount: 4_000 }]}
          refusal={{ reason: { kind: "short", of: "labor", held: 2_011, need: 4_000, wait: 19 * 3_600 + 44 * 60 } }}
          sending={false}
          onUpgrade={onUpgrade}
          onClose={() => {}}
        />,
      ),
    );
    const upgrade = buttons().find((button) => button.textContent === "Upgrade")!;
    expect(upgrade.disabled).toBe(true);
    // The foot is the line and the verb: no price line repeating the need, no Explore (owner, 27 October).
    const foot = upgrade.closest(".ui-window__foot")!;
    expect(foot.textContent).toBe("Needs 4,000 labor, have 2,011 · in 19h 44mUpgrade");
    expect(foot.querySelectorAll("button")).toHaveLength(1);
    act(() => upgrade.click());
    expect(onUpgrade).not.toHaveBeenCalled();
  });

  it("has no next side and no verb at the last level", () => {
    act(() =>
      root.render(
        <CastleView
          laborRate="+1.7/min"
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
