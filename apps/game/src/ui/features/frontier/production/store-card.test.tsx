import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { nativeResearchConstants as research } from "@bibliothecadao/eternum/game-client";

import { sidePicks } from "../research/sides-taken";
import { StoreCard, type StoreLine } from "./store-card";

const line = (overrides: Partial<StoreLine> & Pick<StoreLine, "kind">): StoreLine => ({
  perHour: 500,
  held: 9_640,
  limit: 18_000,
  tone: "calm",
  fullIn: 16 * 3_600 + 44 * 60,
  noBuilding: false,
  ...overrides,
});

const renderCard = (card: StoreLine, onSpend = vi.fn(), onBuild = vi.fn()) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<StoreCard line={card} onSpend={onSpend} onBuild={onBuild} />));
  return {
    text: () => host.querySelector(`section[aria-label='${card.kind}']`)!.textContent,
    /** Each research side on the card: its mark (data-side), whether that mark is drawn, its rank gem's reading. */
    sides: () =>
      [
        ...host.querySelector(`[data-store-card='${card.kind}']`)!.closest("section")!.querySelectorAll("[data-side]"),
      ].map((side) => [
        side.getAttribute("data-side"),
        side.querySelector(`[data-icon='${side.getAttribute("data-side")}']`) !== null,
        side.querySelector(".ui-tier")!.getAttribute("aria-label"),
      ]),
    press: (word: string) =>
      act(() => [...host.querySelectorAll("button")].find((b) => b.textContent === word)!.click()),
    done: () => {
      act(() => root.unmount());
      host.remove();
    },
  };
};

describe("a store's card", () => {
  it("says the store's rate, what it holds against its limit and when it is full", () => {
    const card = renderCard(line({ kind: "wheat" }));
    expect(card.text()).toBe("Wheat+8/minFull in 16h 44m9,640 / 18K");
    // Found by the store it is for, as the playtest's wheat-store step finds it (steps.mjs).
    expect(document.querySelectorAll('[data-store-card="wheat"]')).toHaveLength(1);
    card.done();
  });

  it("shows each side of its row's research on its own row: the side's mark, then its rank gem", () => {
    // Fields V and Granary III, in the Farm row's two three-bit fields.
    const card = renderCard(line({ kind: "wheat", sides: sidePicks(5n + (3n << 3n), research.ROW_FARM) }));
    expect(card.sides()).toEqual([
      ["fields", true, "V"],
      ["granary", true, "III"],
    ]);
    card.done();
    const unknown = renderCard(line({ kind: "wheat", sides: undefined }));
    expect(unknown.sides()).toEqual([]);
    unknown.done();
  });

  it("says a full store is full and sends the player where it is spent", () => {
    const onSpend = vi.fn();
    const card = renderCard(line({ kind: "labor", held: 18_000, tone: "ember" }), onSpend);
    expect(card.text()).toBe("Labor0/minFullRealm18K");
    card.press("Realm");
    expect(onSpend).toHaveBeenCalledWith("realm");
    card.done();
  });

  it("offers Build for a store no building makes", () => {
    const onBuild = vi.fn();
    const card = renderCard(
      line({ kind: "troops", perHour: 0, noBuilding: true, fullIn: undefined }),
      vi.fn(),
      onBuild,
    );
    card.press("Build");
    expect(onBuild).toHaveBeenCalled();
    card.done();
  });
});
