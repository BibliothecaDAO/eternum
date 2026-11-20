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
vi.mock("../herald", () => ({
  useRealmsPlayer: () => ({ data: "0x5eed0292" }),
  useRecentResults: () => ({ isError: false, isPending: false, data: { games: [] } }),
  useDirectory: () => ({ data: { games: [] } }),
  useLeaderboard: () => ({ data: undefined }),
}));

import { useIdentitySessionStore } from "@/hooks/context/identity-session";
import { setViewportWidth } from "../frame/test-viewport";
import { ProfilePage } from "./profile-pages";

const HELD_REALMS = "/api/value/held-realms";
const named = (realmId: number) => `${realmId} · ${canonicalRealm(realmId)!.name}`;

let unmount: (() => Promise<void>) | null = null;
afterEach(async () => {
  await unmount?.();
  unmount = null;
  signedIn.wallet = null;
  signedIn.realmsId = "0x7";
  useIdentitySessionStore.setState({ status: "loading", session: null });
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Held Realms as the relay answers them: each one's number and the index's map of it. */
const held = (...realmIds: number[]) =>
  Response.json({
    realms: realmIds,
    held: realmIds.map((realmId) => ({ realmId, map: `https://index.test/maps/${realmId}.svg` })),
  });

/** The relay's held-Realms answers, in turn (the last repeats), and every request the page made. */
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
            <Route path="/profile/settings" element={<p>Settings page</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  unmount = async () => {
    await act(async () => root.unmount());
    container.remove();
  };
  const strip = () =>
    [...(container.querySelector('[role="group"][aria-label="Holdings"]')?.querySelectorAll("button") ?? [])].map(
      (cell) => cell.textContent,
    );
  const press = async (text: string) =>
    act(async () => [...document.querySelectorAll("button")].find((button) => button.textContent === text)!.click());
  return { container, strip, press, sheet: () => document.querySelector('[role="dialog"]') };
};

describe.each([1440, 390])("Holdings on the player's own card, at %i px", (width) => {
  it("counts the linked wallet's Realms and lists them by number and name in their sheet", async () => {
    signedIn.wallet = "0x269c";
    relay(() => held(3, 4786));
    const you = await openYou(width);
    await vi.waitFor(() => expect(you.strip()).toEqual(["2Realms"]));
    await you.press("2Realms");
    const sheet = you.sheet()!;
    expect(sheet.getAttribute("aria-label")).toBe("Your Realms");
    expect([...sheet.querySelectorAll("li")].map((row) => row.textContent)).toEqual([named(3), named(4786)]);
    expect([...sheet.querySelectorAll("button")].some((button) => button.textContent === "Market")).toBe(true);
  });

  it("offers the way to link a wallet when none is linked, and asks for no Realms", async () => {
    const asked = relay(() => held());
    const you = await openYou(width);
    await vi.waitFor(() => expect(you.strip()).toEqual(["Link a wallet for your Realms and LORDS"]));
    expect(asked).not.toContain(HELD_REALMS);
    await you.press("Link a wallet for your Realms and LORDS");
    expect(you.container.textContent).toContain("Settings page");
  });
});

it("says the Realms could not be read, and reads them again on Try again", async () => {
  signedIn.wallet = "0x269c";
  relay(
    () => Response.json({ error: "realm_holdings_unavailable" }, { status: 503 }),
    () => held(4786),
  );
  const you = await openYou(1440);
  await vi.waitFor(() => expect(you.strip()).toEqual(["—Realms"]));
  await you.press("—Realms");
  expect(you.sheet()!.textContent).toContain("Your Realms cannot be read right now");
  await you.press("Try again");
  await vi.waitFor(() =>
    expect([...you.sheet()!.querySelectorAll("li")].map((row) => row.textContent)).toEqual([named(4786)]),
  );
  expect(you.strip()).toEqual(["1Realms"]);
});

it("says a linked wallet holding no Realm holds none", async () => {
  signedIn.wallet = "0x269c";
  relay(() => held());
  const you = await openYou(390);
  await vi.waitFor(() => expect(you.strip()).toEqual(["0Realms"]));
  await you.press("0Realms");
  expect(you.sheet()!.textContent).toContain("Your linked wallet holds no Realm");
});
