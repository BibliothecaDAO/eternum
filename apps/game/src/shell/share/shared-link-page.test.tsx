// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

/** The identity service: a shared link's visit, as its route answers it. */
const service = vi.hoisted(() => ({ openShare: vi.fn() }));
vi.mock("@/hooks/context/identity-session", async (original) => ({
  ...(await original<typeof import("@/hooks/context/identity-session")>()),
  identityClient: service,
  useIdentitySession: () => ({ status: "signed-out", session: null }),
}));

const season = vi.hoisted(() => ({ calendar: { data: undefined as unknown } }));
vi.mock("../season-calendar", async (original) => ({
  ...(await original<typeof import("../season-calendar")>()),
  useSeasonCalendar: () => season.calendar,
}));

import { IdentityRequestError } from "@realms-world/identity";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { setViewportWidth } from "../frame/test-viewport";
import { SharedLinkPage } from "./shared-link-page";

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  setViewportWidth(390);
  service.openShare.mockReset();
  season.calendar = { data: undefined };
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

/** A friend opens the link a player posted. */
const open = async (path: string) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/s/:code" element={<SharedLinkPage />} />
            <Route path="/" element={<p>Play page</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
};
/** What names the game on the page: each heading's words, and each image's name that says Frontier. */
const frontierNames = () => [
  ...[...host.querySelectorAll("h1, h2")].map((heading) => heading.textContent),
  ...[...host.querySelectorAll("img")].map((image) => image.alt).filter((alt) => alt === "Frontier"),
];
const play = () =>
  [...host.querySelectorAll("a, button")].find((each) => each.textContent?.includes("Start your adventure"));

it("records the visit and says who shared which day, with the way into Frontier", async () => {
  service.openShare.mockResolvedValue({ kind: "frontier-day", moment: 12, name: "Ashwalker" });
  await open("/s/ABCD2345");
  expect(service.openShare).toHaveBeenCalledWith("ABCD2345", null);
  expect(host.textContent).toContain("Ashwalker shared Day 12 of Frontier");
  await act(async () => (play() as HTMLElement).click());
  expect(host.textContent).toBe("Play page");
});

const invite = () => host.querySelector("[data-shared-invite]")?.textContent;
const pageLine = () => host.querySelector("p")?.textContent;

it("names who invites the friend to which Aspect, its members and its four Orders, by the catalog's names", async () => {
  service.openShare.mockResolvedValue({ kind: "aspect", moment: 2, name: "Linden", order: null, members: 31 });
  await open("/s/ABCD2347");
  expect(frontierNames()).toEqual(["Join Luminary", "Frontier"]);
  expect(invite()).toBe(
    "Linden invites youJoin Luminary31 members · Order of Perfection, Brilliance, Protection, Enlightenment",
  );
  expect(pageLine()).toBe("Members of one Aspect never fight each other.");
});

it("names no members for an invite into a running game, whose members the game counts", async () => {
  service.openShare.mockResolvedValue({ kind: "aspect", moment: 4, name: "Orrin", order: null, members: null });
  await open("/s/ABCD2350");
  expect(invite()).toBe("Orrin invites youJoin InsightOrder of Fox, Twins, Reflection, Detection");
});

it("says which Order the sharer kept, and names a sharer with no public name as a player", async () => {
  service.openShare.mockResolvedValue({ kind: "aspect", moment: 1, name: null, order: 13, members: 1 });
  await open("/s/ABCD2348");
  expect(invite()).toContain("A player invites youJoin Prowess1 member · ");
  expect(pageLine()).toBe("Members of one Aspect never fight each other. A player plays Order of Titans.");
});

it("before the season, shows the time left and asks a signed-out friend to create an account", async () => {
  const now = Math.floor(Date.now() / 1000);
  season.calendar = {
    data: {
      phases: [
        {
          phase: "frontier",
          startsAt: new Date((now + 14 * 86_400) * 1000).toISOString(),
          endsAt: new Date((now + 64 * 86_400) * 1000).toISOString(),
        },
      ],
    },
  };
  service.openShare.mockResolvedValue({ kind: "aspect", moment: 1, name: "Dana", order: 13, members: 39 });
  await open("/s/ABCD2349");
  expect(host.textContent).toContain("Starts");
  expect(pageLine()).toBe("Members of one Aspect never fight each other. Dana plays Order of Titans.");
  const verbs = [...host.querySelectorAll("button, a")].map((each) => each.textContent);
  expect(verbs).toContain("Create your Realm");
  expect(verbs).not.toContain("Start your adventure");
});

it("tells identity the channel the link was posted from, and nothing for one no player's link carries", async () => {
  service.openShare.mockResolvedValue({ kind: "frontier-day", moment: 12, name: "Ashwalker" });
  await open("/s/ABCD2345?via=system");
  expect(service.openShare).toHaveBeenLastCalledWith("ABCD2345", "system");
  // Another link opened afresh, as a new tab would.
  await act(async () => root.unmount());
  root = createRoot(host);
  await open("/s/ABCD2346?via=fax");
  expect(service.openShare).toHaveBeenLastCalledWith("ABCD2346", null);
});

it("still leads into the game from a link that leads to no shared day, and asks identity nothing for a malformed one", async () => {
  service.openShare.mockRejectedValue(new IdentityRequestError(404, "share_unknown"));
  await open("/s/ABCD2345");
  expect(host.textContent).toContain("This link leads to no shared day.");
  expect(play()).toBeDefined();

  service.openShare.mockClear();
  await open("/s/not-a-code");
  expect(service.openShare).not.toHaveBeenCalled();
  expect(host.textContent).toContain("This link leads to no shared day.");
});

it("names Frontier once, as its crest, with the shared day as the page's one heading, on a phone and a desktop", async () => {
  service.openShare.mockResolvedValue({ kind: "frontier-day", moment: 12, name: "Ashwalker" });
  for (const width of [390, 1440]) {
    setViewportWidth(width);
    await act(async () => root.unmount());
    root = createRoot(host);
    await open("/s/ABCD2345");
    expect(frontierNames()).toEqual(["Ashwalker shared Day 12 of Frontier", "Frontier"]);
  }
});
