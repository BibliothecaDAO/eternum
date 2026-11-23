import { existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

vi.hoisted(() => vi.stubGlobal("fetch", async () => new Response(null, { status: 401 })));
vi.mock("@/hooks/context/identity-session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/context/identity-session")>()),
  useIdentitySession: () => ({ status: "signed-out", session: null }),
}));
vi.mock("../herald", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../herald")>()),
  useRealmsPlayer: () => ({ data: null }),
}));

import { setViewportWidth } from "../frame/test-viewport";
import { HOW_TO_PLAY } from "../community";
import { ProfilePage } from "./profile-pages";

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
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="*" element={null} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  unmount = () => act(async () => root.unmount());
  return container;
};

const body = (page: HTMLElement) => page.querySelector('[data-band="body"]')!;

it("offers a signed-out reader Sign in cleanly while What's new, How to play and Market live in the footer", async () => {
  const page = await open("/profile", 390);
  const controls = [...body(page).querySelectorAll("a, button")].map((control) => control.textContent);
  expect(controls).toEqual(["Sign in"]);
  const footer = page.querySelector('[data-band="footer"]')!;
  const footerText = footer.textContent ?? "";
  expect(footerText).toContain("What's new");
  expect(footerText).toContain("How to play");
  expect(footerText).toContain("Market");
});

it("opens How to play on a page the docs site has", () => {
  const { pathname } = new URL(HOW_TO_PLAY);
  const apps = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
  const page = [`${pathname}.mdx`, `${pathname}/index.mdx`]
    .map((file) => join(apps, "game-docs/docs/pages", file))
    .find((file) => existsSync(file));
  expect(page && relative(apps, page)).toBe("game-docs/docs/pages/frontier/index.mdx");
});
