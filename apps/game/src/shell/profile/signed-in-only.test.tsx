import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Session } from "@realms-world/identity";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

vi.hoisted(() => vi.stubGlobal("fetch", () => new Promise<Response>(() => {})));

vi.mock("../herald", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../herald")>()),
  useRealmsPlayer: () => ({ data: "0x5eed0292" }),
  useRecentResults: () => ({ isError: false, isPending: false, data: { games: [] } }),
  useDirectory: () => ({ isError: false, isPending: false, data: { games: [] } }),
  useLeaderboard: () => ({ data: undefined }),
}));

import { identityClient, useIdentitySessionStore } from "@/hooks/context/identity-session";
import { WORDS } from "@/ui/design-system/kit/words";
import { setViewportWidth } from "../frame/test-viewport";
import { FragmentsPage } from "../shop/fragments-page";
import { ProfilePage } from "./profile-pages";

const SESSION = {
  session: { id: "s", expiresAt: "2099-01-01T00:00:00.000Z", userId: "u" },
  user: { id: "u", realmsId: "0x7", name: "Maelis", email: "you@mail.test", image: "04", emailVerified: true },
} as unknown as Session;

let unmount: (() => Promise<void>) | null = null;
afterEach(async () => {
  await unmount?.();
  unmount = null;
  useIdentitySessionStore.getState().applySession(null);
  vi.restoreAllMocks();
});

const open = async (path: string) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  setViewportWidth(1440);
  vi.spyOn(identityClient, "getSession").mockImplementation(() => new Promise(() => {}));
  vi.spyOn(identityClient, "getSealCode").mockResolvedValue({ held: false });
  useIdentitySessionStore.setState({ status: "anonymous", session: null, settled: false, error: null });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/shop" element={<FragmentsPage spends={false} />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  unmount = async () => {
    await act(async () => root.unmount());
    container.remove();
  };
  return container;
};

it("draws the Sign in card immediately on /profile while getSession is pending and upgrades to AccountHub when session arrives", async () => {
  const page = await open("/profile");
  expect([...page.querySelectorAll("button")].map((button) => button.textContent)).toContain(WORDS.signIn);
  expect(page.querySelector("[data-you-hub]")).toBeNull();
  expect(page.querySelector('[role="status"]')).toBeNull();

  await act(async () => useIdentitySessionStore.getState().applySession(SESSION));
  expect(page.querySelector("[data-you-hub]")).not.toBeNull();
  expect(page.textContent).toContain("Maelis");
});

it("draws the Sign in card immediately on /shop while getSession is pending and upgrades to Shop when session arrives", async () => {
  const page = await open("/shop");
  expect([...page.querySelectorAll("button")].map((button) => button.textContent)).toContain(WORDS.signIn);
  expect(page.querySelector("[data-shop-page]")).toBeNull();
  expect(page.querySelector('[role="status"]')).toBeNull();

  await act(async () => useIdentitySessionStore.getState().applySession(SESSION));
  expect(page.querySelector("[data-shop-page]")).not.toBeNull();
});
