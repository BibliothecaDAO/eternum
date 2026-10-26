// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { relicChestRelics, RELIC_PACKS } from "@bibliothecadao/types";
import { expect, it, vi } from "vitest";

const publicPack = vi.hoisted(() => ({ pack: "War", lucky: false }));
vi.mock("@/hooks/helpers/use-native-facts", () => ({ useNativeRow: () => publicPack }));
vi.mock("@bibliothecadao/eternum", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@bibliothecadao/eternum")>()),
  configManager: { getActiveGameId: () => 1, getVictoryPointGrants: () => ({ openRelicCrate: 250 }) },
}));

import { type ChestOpen, ChestTileDetails } from "./chest-tile-details";

const sealed = (open: ChestOpen) =>
  new DOMParser().parseFromString(renderToStaticMarkup(<ChestTileDetails opening={null} open={open} />), "text/html");

it("says in a plain line what opening the crate needs, with no dead button, and opens it once an army stands beside it (live-qa-night-2 B-4)", () => {
  const verbs = (dom: Document) => [...dom.querySelectorAll(".ui-button")].map((button) => button.textContent);
  const blocked = sealed({ blocked: "Needs an army beside it" });
  expect(verbs(blocked)).toEqual([]);
  expect(blocked.body.textContent).toContain("Needs an army beside it");
  expect(blocked.body.textContent).not.toContain("Move next to it");

  const ready = sealed({ onOpen: () => undefined });
  expect(verbs(ready)).toEqual(["Open"]);
  expect(ready.querySelector<HTMLButtonElement>(".ui-button")!.disabled).toBe(false);
});

it.each(Object.keys(RELIC_PACKS).flatMap((pack) => [false, true].map((lucky) => ({ pack, lucky }))))(
  "conceals the sealed $pack pack at lucky=$lucky while keeping the opening action and points",
  ({ pack, lucky }) => {
    Object.assign(publicPack, { pack, lucky });
    const markup = renderToStaticMarkup(<ChestTileDetails opening={null} open={{ onOpen: () => undefined }} />);
    const dom = new DOMParser().parseFromString(markup, "text/html");
    expect(dom.querySelector('[aria-label="Relics"]')).toBeNull();
    expect(dom.body.textContent).toContain("Three relics. Open to reveal them.");
    expect(dom.body.textContent).toContain("250");
    expect(dom.body.textContent).not.toContain("Relic II");
    expect(dom.body.textContent).not.toContain("Relic I");
    expect([...dom.querySelectorAll("button")].at(-1)?.textContent).toBe("Open");
  },
);

it("opens from the sealed panel, then keeps the exact awarded relics in its receipt after the chest is gone", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const host = document.createElement("div");
  const root = createRoot(host);
  const open = vi.fn();
  const opening = {
    kind: "relics" as const,
    title: "Crate opened",
    explorerId: 7,
    hex: { x: 4, y: 5 },
    timestamp: 100,
    relics: relicChestRelics({ pack: "Fortress", lucky: true }),
  };
  try {
    await act(async () => root.render(<ChestTileDetails opening={null} open={{ onOpen: open }} />));
    await act(async () =>
      [...host.querySelectorAll("button")].find((button) => button.textContent === "Open")!.click(),
    );
    expect(open).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[aria-label="Relics"]')).toBeNull();
    await act(async () => root.render(<ChestTileDetails opening={opening} open={{ onOpen: open }} />));
    expect([...host.querySelectorAll('[aria-label="Relics"] li')].map((li) => li.textContent)).toEqual([
      "Structure Defense Relic II",
      "Damage Reduction Relic II",
      "Troop Production Relic II",
    ]);
    expect(host.textContent).toContain("Crate opened");
    expect([...host.querySelectorAll("button")].some((button) => button.textContent === "Open")).toBe(false);
    await act(async () =>
      root.render(<ChestTileDetails opening={null} open={{ blocked: "Move an army next to it." }} />),
    );
    expect(host.querySelector('[aria-label="Relics"]')).toBeNull();
    expect(host.textContent).toContain("Move an army next to it.");
  } finally {
    await act(async () => root.unmount());
  }
});
