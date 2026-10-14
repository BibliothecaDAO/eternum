import type { Session } from "@realms-world/identity";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, type ReactNode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

vi.hoisted(() => vi.stubGlobal("fetch", async () => new Response(null, { status: 401 })));
// The ledger answers nothing: only where each detour leads is under test.
vi.mock("@/runtime/l2-rpc", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/runtime/l2-rpc")>()),
  L2_LEDGER: "0x1ed9e7",
  l2Provider: () => ({ callContract: () => new Promise(() => {}) }),
}));
const identity = vi.hoisted(() => ({ session: null as Session | null }));
vi.mock("@/hooks/context/identity-session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/context/identity-session")>()),
  useIdentitySession: () => ({ status: identity.session ? "signed-in" : "signed-out", session: identity.session }),
}));

import { identityClient } from "@/hooks/context/identity-session";

import { PaidEntry, SignInToJoin } from "./blitz/entry-panel";
import { AccountCard } from "./profile/account-card";
import { ProfileRowPage } from "./profile/profile-pages";
import { environmentLedger } from "./value/ledger";

const LOBBY = "/blitz/slot-blitz-1";
const unlinked = {
  session: { id: "s", expiresAt: "2099-01-01T00:00:00.000Z", userId: "u" },
  user: { id: "u", realmsId: "0x7", name: "Maelis", email: "you@mail.test", image: "04", emailVerified: true },
} as unknown as Session;
const linked = { ...unlinked, user: { ...unlinked.user, address: "0x04a1d2c3e4f59f3c" } } as Session;

let where = "";
const Where = () => {
  const location = useLocation();
  useEffect(() => {
    where = `${location.pathname}${location.search}`;
  }, [location]);
  return null;
};

let cleanup: (() => Promise<void>) | null = null;
afterEach(async () => {
  await cleanup?.();
  cleanup = null;
  identity.session = null;
});

/** Renders `page` at `path` among the routes a detour can reach, and returns a re-render. */
const mount = async (path: string, page: () => ReactNode) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(identityClient, "listSignInProviders").mockResolvedValue([]);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const render = () =>
    act(async () =>
      root.render(
        <MemoryRouter initialEntries={[path]}>
          <QueryClientProvider client={client}>
            <Where />
            <Routes>
              <Route path="*" element={page()} />
            </Routes>
          </QueryClientProvider>
        </MemoryRouter>,
      ),
    );
  await render();
  cleanup = async () => {
    await act(async () => root.unmount());
    container.remove();
  };
  return render;
};

const press = (word: string) =>
  act(async () => [...document.querySelectorAll("button")].find((button) => button.textContent === word)!.click());

it("asks a signed-out player in a lobby to sign in, and brings them back to that lobby", async () => {
  await mount(LOBBY, () => <SignInToJoin />);
  await press("Sign in");
  expect(where).toBe(`/sign-in?next=${encodeURIComponent(LOBBY)}`);
});

it("sends a player with no payout wallet to link one, carrying the lobby to return to", async () => {
  identity.session = unlinked;
  await mount(LOBBY, () => (
    <PaidEntry ledger={environmentLedger()!} slot={{ shard: "0x52", slotId: 1 }} owner={null} game={undefined} />
  ));
  await press("Link wallet");
  expect(where).toBe(`/profile/account?next=${encodeURIComponent(LOBBY)}`);
});

it("opens Account on the payout wallet when sent to link one, and returns to the lobby once it is linked", async () => {
  identity.session = unlinked;
  const render = await mount(`/profile/account?next=${encodeURIComponent(LOBBY)}`, () => (
    <AccountCard session={identity.session!} />
  ));
  expect(document.body.textContent).toContain("I have a wallet");
  expect(where).toContain("/profile/account");

  identity.session = linked;
  await render();
  expect(where).toBe(LOBBY);
});

it("keeps a player on Account when their wallet was already linked as they arrived", async () => {
  identity.session = linked;
  await mount(`/profile/account?next=${encodeURIComponent(LOBBY)}`, () => <AccountCard session={identity.session!} />);
  expect(where).toBe(`/profile/account?next=${encodeURIComponent(LOBBY)}`);
});

it("returns a player who signs in from Account to Account, with where it was sending them", async () => {
  const account = `/profile/account?next=${encodeURIComponent(LOBBY)}`;
  await mount(account, () => <ProfileRowPage row="account" />);
  await press("Sign in");
  expect(where).toBe(`/sign-in?next=${encodeURIComponent(account)}`);
});
