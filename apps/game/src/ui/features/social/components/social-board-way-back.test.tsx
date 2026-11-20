// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => vi.stubGlobal("fetch", () => new Promise<Response>(() => {})));

import { setViewportWidth } from "@/shell/frame/test-viewport";
import { useSocialStore } from "./use-social-store";
import { StandingsLab } from "@/ui/features/debug/kit-lab/standings-lab";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  window.history.replaceState(null, "", "/");
  useSocialStore.setState({ selectedTab: 0, isExpanded: false, selectedPlayer: 0n, selectedGuild: 0n } as never);
});

const press = async (words: string) => {
  const control = [...host.querySelectorAll<HTMLElement>("button, [role=tab]")].find(
    (each) => each.textContent?.trim() === words || each.getAttribute("aria-label") === words,
  );
  if (!control) throw new Error(`No control “${words}”`);
  await act(async () => control.click());
};
const cardShown = () => host.querySelector('[aria-label="Player details"]') !== null;

/** The standings' rows, each a player who opens their card. */
const players = () => [...host.querySelectorAll<HTMLButtonElement>("[data-player-address] button")];
const openPlayer = (index: number) => act(async () => players()[index]!.click());
const tabs = () => [...host.querySelectorAll("[role=tab]")].map((tab) => tab.textContent?.trim());

const open = async (width: number, search = "") => {
  window.history.replaceState(null, "", `/lab/kit/standings${search}`);
  setViewportWidth(width);
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <StandingsLab />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  for (let tick = 0; tick < 20 && !host.querySelector("[role=tab]"); tick += 1)
    await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
};

describe("a Blitz player's card has no Back (review-no-back-3): Players is its one tab, shown as the way back", () => {
  it("on a phone stands in the list's place, and the lit Players tab steps back to the list", async () => {
    await open(390, "?mode=blitz");
    expect(tabs()).toEqual(["Players"]);
    const listed = players().length;
    expect(listed).toBeGreaterThan(1);
    await openPlayer(0);
    expect(cardShown()).toBe(true);
    expect(players()).toHaveLength(0);
    expect(tabs()).toEqual(["Players"]);
    await press("Players");
    expect(cardShown()).toBe(false);
    expect(players()).toHaveLength(listed);
    await openPlayer(1);
    expect(cardShown()).toBe(true);
  });

  it("on a desktop stands beside the list", async () => {
    await open(1440, "?mode=blitz");
    const listed = players().length;
    await openPlayer(0);
    expect(cardShown()).toBe(true);
    expect(players()).toHaveLength(listed);
    await press("Players");
    expect(cardShown()).toBe(false);
  });
});
