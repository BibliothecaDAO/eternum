// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

// The week of quests on Today, over the lab's game with Season 1's quest rules (its HUD lab views hold them), signed in
// as the lab's seasoned player; only the network stands in.
const { UnifiedHudLab } = await import("@/ui/features/debug/kit-lab/unified-hud-lab");
const { dailyQuest, dailyQuests } = await import("@bibliothecadao/eternum").then(async (core) => ({
  dailyQuest: core.dailyQuest,
  dailyQuests: (await import("@bibliothecadao/types")).dailyQuests,
}));

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("min-width"),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}", { status: 404 })),
  );
  Element.prototype.scrollIntoView = () => {};
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

it("lists the week's quests on Today, in the bag's order up to the season's last day, today's marked", async () => {
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/unified/frontier"]}>
        <QueryClientProvider client={new QueryClient()}>
          <Routes>
            <Route path="unified/:view?" element={<UnifiedHudLab />} />
          </Routes>
        </QueryClientProvider>
      </MemoryRouter>,
    ),
  );
  await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Today"]')!.click());
  const week = host.querySelector('[aria-label="This week\'s quests"]');
  expect(week).not.toBeNull();
  const rows = [...week!.querySelectorAll(".ui-row")].map((row) => row.textContent);
  // The lab's game is on the first of its three days: the seed's bag for days 1 to 3, and none past the season.
  const seed = 1n;
  expect(rows).toEqual(
    Array.from({ length: 3 }, (_, day) => {
      const quest = dailyQuests.find(({ id }) => id === dailyQuest(seed, day))!;
      return `${quest.name}Day ${day + 1}${day === 0 ? "Today" : "Coming"}`;
    }),
  );
});
