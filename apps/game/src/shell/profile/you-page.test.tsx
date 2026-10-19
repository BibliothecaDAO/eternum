import { existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

vi.hoisted(() => vi.stubGlobal("fetch", async () => new Response(null, { status: 401 })));
// Signed out: what anyone can read does not wait on an account.
vi.mock("@/hooks/context/identity-session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/context/identity-session")>()),
  useIdentitySession: () => ({ status: "signed-out", session: null }),
}));
vi.mock("../herald", () => ({ useRealmsPlayer: () => ({ data: null }) }));

import { setViewportWidth } from "../frame/test-viewport";
import { HOW_TO_PLAY, ProfilePage } from "./profile-pages";

let unmount: (() => Promise<void>) | null = null;
afterEach(async () => {
  await unmount?.();
  unmount = null;
});

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
          <Route path="*" element={null} />
        </Routes>
      </MemoryRouter>,
    ),
  );
  unmount = () => act(async () => root.unmount());
  return container;
};

const body = (page: HTMLElement) => page.querySelector('[data-band="body"]')!;

it("offers a signed-out reader Sign in and How to play on the Blitz guide in a new tab", async () => {
  const page = await open("/profile", 390);
  // The page's own controls: the footer every page ends on is the frame's, checked with it.
  const controls = [...body(page).querySelectorAll("a, button")]
    .filter((control) => !control.closest('[data-band="footer"]'))
    .map((control) => control.textContent);
  expect(controls).toEqual(["Sign in", "How to play"]);
  const docs = body(page).querySelector<HTMLAnchorElement>("a")!;
  expect([docs.href, docs.target]).toEqual(["https://docs.realms.world/blitz/key-concepts", "_blank"]);
});

// The docs site answers every address with its shell, so a page renamed there would open blank: the guide must be a
// page the docs app (apps/game-docs) writes.
it("opens How to play on a page the docs site has", () => {
  const { pathname } = new URL(HOW_TO_PLAY);
  const apps = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
  const page = join(apps, "game-docs/docs/pages", `${pathname}.mdx`);
  expect([relative(apps, page), existsSync(page)]).toEqual(["game-docs/docs/pages/blitz/key-concepts.mdx", true]);
});
