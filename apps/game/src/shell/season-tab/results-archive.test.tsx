import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";

/** Prod's top five on Season 1 as its archive holds them, and the names identity serves for them. */
const NAMES = vi.hoisted(
  () =>
    ({
      "0x4c21ba6f5c8e24182ee0eefd56de97ade5f7570041dd0ec7d7d8ece2195cc4": "Volcanic",
      "0x510fa645565fc77a784918630a27d0e1c07255b698fb44966ebd0b801439001": "djizus",
      "0x648174392d94df37bc7d59c3abf22116d20df16ddf0e380c5ff79aff86738c4": "Canzi",
      "0x57b9e20b749d8fa23967c0621bccd56ad781984f6620b08a25cda35acb4340": "Nexonik",
      "0x344cfcfa43038047bba55dcff787e8cd588fee7251e5ec2ddd86f60cd60d8c6": "Krump",
    }) as Record<string, string>,
);
const player = vi.hoisted(() => ({ current: null as string | null }));
// Identity answers the names; anything else asked of the network (a shard) never answers.
vi.hoisted(() =>
  vi.stubGlobal("fetch", (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : String(input), "http://localhost");
    const accounts = url.searchParams.get("accounts")?.split(",") ?? [];
    if (!url.pathname.endsWith("/api/profiles")) return new Promise<Response>(() => {});
    return Promise.resolve(
      Response.json({
        profiles: Object.fromEntries(
          accounts.filter((account) => NAMES[account]).map((account) => [account, { name: NAMES[account] }]),
        ),
      }),
    );
  }),
);
// The board is the real read; the lists the page looks the game up in hold nothing, as after the old shard is gone.
vi.mock("../herald", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../herald")>()),
  useRealmsPlayer: () => ({ data: player.current }),
  useDirectory: () => ({ data: { games: [] } }),
  useRecentResults: () => ({ data: { games: [] } }),
}));
vi.mock("@/hooks/context/identity-session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/context/identity-session")>()),
  useIdentitySession: () => ({ status: "signed-out", session: null }),
}));

import { setViewportWidth } from "../frame/test-viewport";
import { ResultsPage } from "./results-page";

const PLAYTEST = "/results/0x50524f44554354494f4e5f31386530376435323330633539393933-1";

let unmount: (() => Promise<void>) | null = null;
afterEach(async () => {
  await unmount?.();
  player.current = null;
});

const open = async (width: number) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  setViewportWidth(width);
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={[PLAYTEST]}>
          <Routes>
            <Route path="/results/:id" element={<ResultsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  // Let identity's names land.
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  unmount = () => act(async () => root.unmount());
  return container;
};

const podium = (container: HTMLElement) =>
  [...container.querySelectorAll(".season-recap__podium li")].map((place) =>
    [...place.children].map((cell) => cell.textContent),
  );
/** The page's own buttons: Season, the end map, Withdraw, Continue, Share my season. */
const buttons = (container: HTMLElement) =>
  [...container.querySelectorAll("button[data-kind]")].map((button) => button.textContent);

it.each([390, 1440])(
  "shows Season 1 · Playtest's recap from its archive, with no shard behind it, at %ipx",
  async (width) => {
    const container = await open(width);
    expect(container.textContent).toContain("Season 1 · Playtest · Ended 31 Oct");
    expect(container.textContent).toContain("The mist lifted");
    expect(podium(container)).toEqual([
      ["1", "Volcanic", "166"],
      ["2", "djizus", "136"],
      ["3", "Canzi", "114"],
    ]);
    // A reader with no realm on the board: no card, nothing to share.
    expect(container.querySelector(".season-card")).toBeNull();
    // Its shard is gone: no end map to open; Continue is the page's step.
    expect(buttons(container)).toEqual(["Season", "Continue"]);
  },
);

it("gives a Season 1 player their card with their final place and LORDS, Share last, and no Withdraw into a shard that is gone", async () => {
  player.current = "0x510fa645565fc77a784918630a27d0e1c07255b698fb44966ebd0b801439001";
  const container = await open(1440);
  const card = container.querySelector(".season-card")!;
  expect(card.querySelector(".season-card__place")?.textContent).toBe("#2of 45 realms");
  expect(card.querySelector(".season-card__name")?.textContent).toBe("djizus");
  expect([...card.querySelectorAll(".season-card__figure")].map((figure) => figure.textContent)).toContain("1.5KLORDS");
  expect(buttons(container)).toEqual(["Season", "Continue", "Share my season"]);
});
