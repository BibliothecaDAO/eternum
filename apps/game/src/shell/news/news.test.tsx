import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { formatContentDay } from "@bibliothecadao/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { latestFeatures } from "@/ui/features/world/latest-features";

vi.hoisted(() => vi.stubGlobal("fetch", async () => new Response(null, { status: 401 })));
// Signed out: What's new is read by anyone.
vi.mock("@/hooks/context/identity-session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/context/identity-session")>()),
  useIdentitySession: () => ({ status: "signed-out", session: null }),
}));

import { setViewportWidth } from "../frame/test-viewport";
import { WhatsNewPage } from "./news";
import { publishedPosts } from "./posts";

let unmount: (() => Promise<void>) | null = null;
afterEach(async () => {
  await unmount?.();
  unmount = null;
});

const Where = () => <output data-where>{useLocation().pathname}</output>;

const open = async (width: number) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  setViewportWidth(width);
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/scroll"]}>
        <Routes>
          <Route path="/scroll" element={<WhatsNewPage />} />
          <Route path="*" element={null} />
        </Routes>
        <Where />
      </MemoryRouter>,
    ),
  );
  unmount = () => act(async () => root.unmount());
  return container;
};

const panel = (page: HTMLElement, title: string) =>
  [...page.querySelectorAll<HTMLElement>(".app-panel")].find(
    (each) => each.querySelector("h2")?.textContent === title,
  )!;

describe.each([390, 1440])("What's new at %i px", (width) => {
  it("is a place of its own: no Back, and its place in the bar is the current one", async () => {
    const page = await open(width);
    expect(page.querySelector('[data-role="back"]')).toBeNull();
    const places = [...page.querySelectorAll<HTMLAnchorElement>('[data-role="tab"]')];
    expect(places.map((place) => place.getAttribute("aria-label") ?? place.textContent)).toEqual([
      "Play",
      "Season",
      "What's new",
      "You",
    ]);
    const current = places.filter((place) => place.getAttribute("aria-current") === "page");
    expect(current.map((place) => [place.textContent, place.getAttribute("href")])).toEqual([
      ["What's new", "/scroll"],
    ]);
  });

  it("reads each latest change whole, and opens a post of the Scroll on its page", async () => {
    const page = await open(width);
    const changes = [...panel(page, "Latest changes").querySelectorAll(".app-row")];
    expect(changes.map((row) => row.querySelector(".app-row__detail")?.textContent)).toEqual(
      latestFeatures.map((change) => `${formatContentDay(change.date)} · ${change.description}`),
    );
    const posts = [...panel(page, "The Scroll").querySelectorAll<HTMLButtonElement>(".app-row button")];
    expect(posts.map((post) => post.querySelector(".app-row__title")?.textContent)).toEqual(
      publishedPosts.map((post) => post.title),
    );
    await act(async () => posts[0].click());
    expect(page.querySelector("[data-where]")!.textContent).toBe(`/scroll/${publishedPosts[0].slug}`);
  });

  it("ends on the footer's community links", async () => {
    const page = await open(width);
    const community = [
      ...page.querySelectorAll<HTMLAnchorElement>('[data-band="footer"] nav[aria-label="Community"] a'),
    ];
    expect(community.map((link) => [link.textContent, link.getAttribute("href"), link.target])).toEqual([
      ["Discord", "https://discord.gg/realmsworld", "_blank"],
      ["X", "https://x.com/LootRealms", "_blank"],
      ["Telegram", "https://t.me/+UpfCtj7qEO9hZjU1", "_blank"],
      ["GitHub", "https://github.com/BibliothecaDAO", "_blank"],
    ]);
  });
});
