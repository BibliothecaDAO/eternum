import { existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

vi.hoisted(() => vi.stubGlobal("fetch", async () => new Response(null, { status: 401 })));
// Signed out: what anyone can read does not wait on an account.
vi.mock("@/hooks/context/identity-session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/context/identity-session")>()),
  useIdentitySession: () => ({ status: "signed-out", session: null }),
}));
vi.mock("../herald", () => ({ useRealmsPlayer: () => ({ data: null }) }));

import { setViewportWidth } from "../frame/test-viewport";
import { WhatsNewPage } from "../news/news";
import { HOW_TO_PLAY, ProfilePage } from "./profile-pages";

let unmount: (() => Promise<void>) | null = null;
afterEach(async () => {
  await unmount?.();
  unmount = null;
});

const Where = () => <output data-where>{useLocation().pathname}</output>;

const open = async (path: string, width: number) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  setViewportWidth(width);
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/profile" element={<ProfilePage />} />
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

const body = (page: HTMLElement) => page.querySelector('[data-band="body"]')!;

it("offers a signed-out reader Sign in, How to play on the Blitz guide in a new tab, and What's new", async () => {
  const page = await open("/profile", 390);
  const controls = [...body(page).querySelectorAll("a, button")].map((control) => control.textContent);
  expect(controls).toEqual(["Sign in", "How to play", "What's new"]);
  const docs = body(page).querySelector<HTMLAnchorElement>("a")!;
  expect([docs.href, docs.target]).toEqual(["https://docs.realms.world/blitz/key-concepts", "_blank"]);
  const whatsNew = [...body(page).querySelectorAll("button")].find((button) => button.textContent === "What's new")!;
  await act(async () => whatsNew.click());
  expect(page.querySelector("[data-where]")!.textContent).toBe("/scroll");
});

// The docs site answers every address with its shell, so a page renamed there would open blank: the guide must be a
// page the docs app (apps/game-docs) writes.
it("opens How to play on a page the docs site has", () => {
  const { pathname } = new URL(HOW_TO_PLAY);
  const apps = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
  const page = join(apps, "game-docs/docs/pages", `${pathname}.mdx`);
  expect([relative(apps, page), existsSync(page)]).toEqual(["game-docs/docs/pages/blitz/key-concepts.mdx", true]);
});

it.each([390, 1440])("ends What's new on the footer's community links at %i px", async (width) => {
  const page = await open("/scroll", width);
  const community = [...page.querySelectorAll<HTMLAnchorElement>('[data-band="footer"] nav[aria-label="Community"] a')];
  expect(community.map((link) => [link.textContent, link.getAttribute("href"), link.target])).toEqual([
    ["Discord", "https://discord.gg/realmsworld", "_blank"],
    ["X", "https://x.com/LootRealms", "_blank"],
    ["Telegram", "https://t.me/+UpfCtj7qEO9hZjU1", "_blank"],
    ["GitHub", "https://github.com/BibliothecaDAO", "_blank"],
  ]);
  // Back leads to You, where What's new is one row.
  expect(page.querySelector<HTMLAnchorElement>('[data-role="back"]')!.getAttribute("href")).toBe("/profile");
});
