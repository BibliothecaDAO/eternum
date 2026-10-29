import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { IdentityRequestError, type Session } from "@realms-world/identity";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
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

import { identityClient, useIdentitySessionStore } from "@/hooks/context/identity-session";
import { HomeSourcePicker } from "@/ui/features/game-entry/home-source-picker";
import { setViewportWidth } from "../frame/test-viewport";
import { DEVCON } from "../join/devcon";
import { JoinDevconPage } from "../join/join-devcon-page";
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
  Response.json({ realms: realmIds.map((realmId) => ({ realmId, map: `https://index.test/maps/${realmId}.svg` })) });

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
const ticket = (tier: "regular" | "golden" | null) =>
  vi
    .spyOn(identityClient, "redeemCampaignTicket")
    .mockImplementation(async () =>
      tier ? { campaign: DEVCON.campaign, tier } : Promise.reject(new IdentityRequestError(400, "invalid_redemption")),
    );

/** A Devcon game's Realm step on its own, as the doorway mounts it: the second screen that shows the account's ticket. */
const RealmStep = () => {
  const [value, setValue] = useState("");
  return (
    <HomeSourcePicker
      presetId={6}
      registered={null}
      value={value}
      onChange={setValue}
      onSettled={() => undefined}
      disabled={false}
    />
  );
};

/**
 * The player's own You page, with Settings beside it for the wallet link's detour, and the Devcon landing and a Devcon
 * game's Realm step one link away, all on one query client as the app has.
 */
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
          <Link to="/join/devcon/TEST0000">Test flyer</Link>
          <Link to="/profile">Test you</Link>
          <Link to="/play/devcon">Test step</Link>
          <Routes>
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/profile/settings" element={<p>Settings page</p>} />
            <Route path="/join/devcon/:code" element={<JoinDevconPage />} />
            <Route path="/play/devcon" element={<RealmStep />} />
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
  const follow = async (text: string) =>
    act(async () => [...container.querySelectorAll("a")].find((link) => link.textContent === text)!.click());
  return { container, strip, press, follow, sheet: () => document.querySelector('[role="dialog"]') };
};

describe.each([1440, 390])("Holdings on the player's own card, at %i px", (width) => {
  it("counts the linked wallet's Realms and lists them by number and name in their sheet", async () => {
    signedIn.wallet = "0x269c";
    relay(() => held(3, 4786));
    ticket(null);
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
    ticket(null);
    const you = await openYou(width);
    await vi.waitFor(() => expect(you.strip()).toEqual(["Link wallet"]));
    expect(asked).not.toContain(HELD_REALMS);
    await you.press("Link wallet");
    expect(you.container.textContent).toContain("Settings page");
  });

  it.each([
    { tier: "regular" as const, cell: "DevconTicket", face: "opened", claim: "1,000 Labor each day" },
    { tier: "golden" as const, cell: "DevconGolden ticket", face: "golden", claim: "2,000 Labor each day" },
  ])(
    "shows a $tier Devcon ticket, and in its sheet the ticket and its realm's daily claim",
    async ({ tier, cell, face, claim }) => {
      signedIn.wallet = "0x269c";
      relay(() => held());
      ticket(tier);
      const you = await openYou(width);
      await vi.waitFor(() => expect(you.strip()).toEqual(["0Realms", cell]));
      await you.press(cell);
      const sheet = you.sheet()!;
      expect(sheet.querySelector(".app-ticket")?.getAttribute("data-face")).toBe(face);
      expect(sheet.textContent).toContain(claim);
      expect(DEVCON.claim(tier === "golden").labor.toLocaleString("en-US")).toBe(claim.split(" ")[0]);
    },
  );
});

it("says the Realms could not be read, and reads them again on Try again", async () => {
  signedIn.wallet = "0x269c";
  relay(
    () => Response.json({ error: "realm_holdings_unavailable" }, { status: 503 }),
    () => held(4786),
  );
  ticket(null);
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
  ticket(null);
  const you = await openYou(390);
  await vi.waitFor(() => expect(you.strip()).toEqual(["0Realms"]));
  await you.press("0Realms");
  expect(you.sheet()!.textContent).toContain("Your linked wallet holds no Realm");
});

it("shows a ticket just opened on the landing on You and on a game's Realm step at once, with no read again", async () => {
  relay(() => held());
  let opened = false;
  const reads = vi.spyOn(identityClient, "redeemCampaignTicket").mockImplementation(async (_campaign, code) => {
    if (code) opened = true;
    if (opened) return { campaign: DEVCON.campaign, tier: "golden" };
    throw new IdentityRequestError(400, "invalid_redemption");
  });
  const you = await openYou(390);
  await vi.waitFor(() => expect(reads).toHaveBeenCalledTimes(1));
  expect(you.strip()).toEqual(["Link wallet"]);

  await you.follow("Test flyer");
  await you.press("Open your ticket");
  await vi.waitFor(() => expect(you.container.querySelector('.app-ticket[data-face="golden"]')).not.toBeNull());
  await you.follow("Test you");
  expect(you.strip()).toEqual(["Link wallet", "DevconGolden ticket"]);
  await you.follow("Test step");
  expect(you.container.querySelector(".home-picker__featured h3")?.textContent).toBe("Golden Devcon ticket");
  // The landing's one redeem told every screen: no screen read the ticket again.
  expect(reads.mock.calls.map(([, code]) => code)).toEqual([null, "TEST0000"]);
});

it("says an unreadable ticket cannot be read, and shows it once Try again answers", async () => {
  relay(() => held());
  const reads = vi
    .spyOn(identityClient, "redeemCampaignTicket")
    .mockRejectedValueOnce(new IdentityRequestError(503, "campaigns_unavailable"))
    .mockResolvedValue({ campaign: DEVCON.campaign, tier: "regular" });
  const you = await openYou(1440);
  await vi.waitFor(() => expect(you.strip()).toEqual(["Link wallet", "—Ticket"]));
  await you.press("—Ticket");
  expect(you.sheet()!.textContent).toContain("Your ticket cannot be read right now");
  await you.press("Try again");
  await vi.waitFor(() => expect(you.strip()).toEqual(["Link wallet", "DevconTicket"]));
  expect(you.sheet()!.querySelector(".app-ticket")?.getAttribute("data-face")).toBe("opened");
  expect(reads).toHaveBeenCalledTimes(2);
});

it("never shows another account's ticket: a new account's own answer decides", async () => {
  relay(() => held());
  let answerSecond: (value: unknown) => void = () => undefined;
  vi.spyOn(identityClient, "redeemCampaignTicket").mockImplementation(async () => {
    if (useIdentitySessionStore.getState().session?.user.realmsId === "0x7")
      return { campaign: DEVCON.campaign, tier: "golden" };
    return new Promise((resolve) => (answerSecond = resolve)) as never;
  });
  const you = await openYou(390);
  await vi.waitFor(() => expect(you.strip()).toEqual(["Link wallet", "DevconGolden ticket"]));
  signedIn.realmsId = "0x8";
  await act(async () => useIdentitySessionStore.setState({ session: session() }));
  expect(you.strip()).toEqual(["Link wallet"]);
  await act(async () => answerSecond(Promise.reject(new IdentityRequestError(400, "invalid_redemption"))));
  expect(you.strip()).toEqual(["Link wallet"]);
});
