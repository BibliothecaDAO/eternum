import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Session } from "@realms-world/identity";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { canonicalRealm } from "@bibliothecadao/eternum";

const signedIn = vi.hoisted(() => ({ wallet: null as string | null, realmsId: "0x7" }));
const session = () =>
  ({
    session: { id: "s", expiresAt: "2099-01-01T00:00:00.000Z", userId: "u" },
    user: {
      id: "u",
      realmsId: signedIn.realmsId,
      name: "Maelis",
      email: "you@mail.test",
      emailVerified: true,
      address: signedIn.wallet,
    },
  }) as unknown as Session;
vi.mock("@/hooks/context/identity-session", async (importOriginal) => {
  const identity = await importOriginal<typeof import("@/hooks/context/identity-session")>();
  return { ...identity, useIdentitySession: () => identity.useIdentitySessionStore() };
});
vi.mock("../herald", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../herald")>()),
  useRealmsPlayer: () => ({ data: "0x5eed0292" }),
  useRecentResults: () => ({ isError: false, isPending: false, data: { games: [] } }),
  useDirectory: () => ({
    data: {
      games: [
        {
          chainId: "0x52",
          game_id: 1,
          name: "frontier-100",
          mode: "frontier",
          status: "Live",
          clock_scale: 1,
          clock: { start_main_at: 100, end_at: 9_999_999_999 },
          quest_bonus_percent: 50,
        },
      ],
    },
  }),
  useLeaderboard: () => ({ data: undefined }),
}));

import { useIdentitySessionStore } from "@/hooks/context/identity-session";
import { setViewportWidth } from "../frame/test-viewport";
import { ProfilePage } from "./profile-pages";
import {
  FRAGMENTS_PAGE_WORDS,
  HELD_REALMS_UNREADABLE,
  HOME_STEP_WORDS,
  NO_HELD_REALMS,
} from "../../ui/design-system/kit/words";

const HELD_REALMS = "/api/value/held-realms";
const named = (realmId: number) => `${realmId} · ${canonicalRealm(realmId)!.name}`;

let unmount: (() => Promise<void>) | null = null;
afterEach(async () => {
  await unmount?.();
  unmount = null;
  signedIn.wallet = null;
  signedIn.realmsId = "0x7";
  useIdentitySessionStore.setState({ status: "anonymous", session: null, settled: false });
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const held = (...realmIds: number[]) =>
  Response.json({
    realms: realmIds,
    held: realmIds.map((realmId) => ({ realmId, map: `https://index.test/maps/${realmId}.svg` })),
  });

const relay = (...answers: (() => Response)[]) => {
  const asked: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    asked.push(String(url));
    if (String(url) !== HELD_REALMS) return new Promise<Response>(() => {});
    return (answers.length > 1 ? answers.shift()! : answers[0]!)();
  });
  return asked;
};

const openYou = async (width: number) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  setViewportWidth(width);
  useIdentitySessionStore.setState({ status: "signed-in", session: session() });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={["/profile"]}>
          <Routes>
            <Route path="/profile" element={<ProfilePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  unmount = async () => {
    await act(async () => root.unmount());
    container.remove();
  };
  const press = async (text: string) =>
    act(async () =>
      [...document.querySelectorAll<HTMLElement>("a, button")].find((node) => node.textContent === text)!.click(),
    );
  return { container, press, sheet: () => document.querySelector('[role="dialog"]') };
};

describe.each([1440, 390])("Unlinked wallet on You, at %i px", (width) => {
  it("offers one inline way to open Wallet & Devices when none is linked, and asks for no Realms", async () => {
    const asked = relay(() => held());
    const you = await openYou(width);
    expect(asked).not.toContain(HELD_REALMS);
    const links = [...you.container.querySelectorAll("a, button")].filter(
      (node) => node.textContent === FRAGMENTS_PAGE_WORDS.linkWallet,
    );
    expect(links).toHaveLength(1);
    await you.press(FRAGMENTS_PAGE_WORDS.linkWallet);
    expect(you.container.querySelector("[data-you-tab]")?.getAttribute("data-you-tab")).toBe("wallet");
  });
});

it("shows one Try again notice when Realms fail to load, and reloads into the showcase with quest bonus", async () => {
  signedIn.wallet = "0x269c";
  relay(
    () => Response.json({ error: "realm_holdings_unavailable" }, { status: 503 }),
    () => held(4786),
  );
  const you = await openYou(1440);
  await vi.waitFor(() => expect(you.container.textContent).toContain(HELD_REALMS_UNREADABLE));
  expect([...you.container.querySelectorAll("button")].filter((node) => node.textContent === "Try again")).toHaveLength(
    1,
  );
  await you.press("Try again");
  await vi.waitFor(() =>
    expect(you.container.querySelector(".profile-realm-tile__name")?.textContent).toBe(named(4786)),
  );
  expect(you.container.querySelector(".profile-realm-tile__bonus")?.textContent).toContain(
    HOME_STEP_WORDS.questBonus(50),
  );
});

it("says a linked wallet holding no Realm holds none", async () => {
  signedIn.wallet = "0x269c";
  relay(() => held());
  const you = await openYou(390);
  await vi.waitFor(() => expect(you.container.textContent).toContain(NO_HELD_REALMS));
});

it("shows Realms in the showcase on both desktop and phone and opens the shared sheet for all Realms beyond nine", async () => {
  signedIn.wallet = "0x269c";
  const twelve = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  relay(() => held(...twelve));
  const you = await openYou(1440);
  await vi.waitFor(() => expect(you.container.querySelectorAll(".profile-realm-tile")).toHaveLength(9));
  expect(you.container.querySelector(".profile-realm-tile__name")?.textContent).toBe(named(1));
  await you.press("All 12");
  expect(you.sheet()!.querySelectorAll("li")).toHaveLength(12);
});
