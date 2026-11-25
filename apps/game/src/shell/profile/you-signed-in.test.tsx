import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Session } from "@realms-world/identity";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => vi.stubGlobal("fetch", () => new Promise<Response>(() => {})));

const signedIn = vi.hoisted(() => ({
  session: {
    session: { id: "s", expiresAt: "2099-01-01T00:00:00.000Z", userId: "u" },
    user: { id: "u", realmsId: "0x7", name: "Maelis", email: "you@mail.test", image: "04", emailVerified: true },
  } as unknown as Session,
  games: [] as Record<string, unknown>[],
}));
vi.mock("@/hooks/context/identity-session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/context/identity-session")>()),
  useIdentitySession: () => ({ status: "signed-in", session: signedIn.session }),
}));
vi.mock("../herald", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../herald")>()),
  useRealmsPlayer: () => ({ data: "0x5eed0292" }),
  useRecentResults: () => ({ isError: false, isPending: false, data: { games: [] } }),
  useDirectory: () => ({ data: { games: signedIn.games } }),
  useLeaderboard: () => ({ data: undefined }),
}));

import { identityClient } from "@/hooks/context/identity-session";
import { setViewportWidth } from "../frame/test-viewport";
import { SEASON_SPENDS_FRAGMENTS } from "../season";
import { ProfilePage, SettingsRedirect } from "./profile-pages";
import { INVITED_FRIENDS_WORDS, INVITE_WORDS, PROFILE_WORDS, REWARD_WORDS, SEASON_INVITE_WORDS } from "../../ui/design-system/kit/words";

let currentLocation = { pathname: "", search: "", hash: "" };
const TrackLocation = () => {
  const { pathname, search, hash } = useLocation();
  currentLocation = { pathname, search, hash };
  return null;
};

let unmount: (() => Promise<void>) | null = null;
afterEach(async () => {
  await unmount?.();
  unmount = null;
  signedIn.games = [];
  vi.restoreAllMocks();
});

const open = async (path: string, width: number) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  setViewportWidth(width);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={[path]}>
          <TrackLocation />
          <Routes>
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/profile/settings" element={<SettingsRedirect />} />
            <Route path="*" element={null} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  unmount = async () => {
    await act(async () => root.unmount());
    container.remove();
  };
  return container.querySelector('[data-band="body"]')!;
};

describe.each([1440, 390])("You, signed in, at %i px", (width) => {
  it("opens the player's own card on their name, never on the address's stand-in", async () => {
    const page = await open("/profile", width);
    expect(page.textContent).toContain("Maelis");
    expect(page.textContent).not.toMatch(/Lord/);
  });

  it("never shows Blitz rating, even when a Blitz game is listed", async () => {
    signedIn.games = [{ mode: "blitz", status: "Live" }];
    const active = await open("/profile", width);
    expect(active.textContent).not.toContain("Link a wallet to carry a rating");
    expect(active.textContent).not.toContain(REWARD_WORDS.rating);
  });

  it("swaps Overview, Referrals, Wallet and Settings inline on /profile and syncs the URL hash", async () => {
    const page = await open("/profile", width);
    const tabs = [...page.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    expect(tabs).toHaveLength(4);
    expect(page.querySelector("[data-you-tab]")?.getAttribute("data-you-tab")).toBe("overview");
    await act(async () => tabs[3]!.click());
    expect(page.querySelector("[data-you-tab]")?.getAttribute("data-you-tab")).toBe("settings");
    expect(currentLocation).toMatchObject({ pathname: "/profile", hash: "#settings" });
    expect(page.textContent).toContain(PROFILE_WORDS.notifications);
    expect(page.textContent).toContain("Sign out");
  });
});

it("keeps the desktop's games plate with no finished game, saying they will show there", async () => {
  const page = await open("/profile", 1440);
  const games = [...page.querySelectorAll("section, .plate")].find((element) =>
    element.textContent?.startsWith(PROFILE_WORDS.recentGames),
  );
  expect(games?.textContent).toContain(PROFILE_WORDS.noGamesOwn);
});

it("redirects /profile/settings to /profile#settings and keeps the phone lockup across tabs", async () => {
  const page = await open("/profile/settings", 390);
  expect(currentLocation).toMatchObject({ pathname: "/profile", hash: "#settings" });
  expect(page.querySelector("[data-you-tab]")?.getAttribute("data-you-tab")).toBe("settings");
  expect(document.querySelector('[data-band="top"] h1')).toBeNull();
  const tabs = [...page.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  await act(async () => tabs[0]!.click());
  expect(currentLocation).toMatchObject({ pathname: "/profile", hash: "#realms" });
  expect(page.querySelector("[data-you-tab]")?.getAttribute("data-you-tab")).toBe("overview");
  expect(document.querySelector('[data-band="top"] h1')).toBeNull();
});

it("redirects /profile/settings?next=%2F to Wallet & Devices instead of Settings", async () => {
  const page = await open("/profile/settings?next=%2F", 1440);
  expect(currentLocation).toEqual({ pathname: "/profile", search: "?next=%2F", hash: "#wallet" });
  expect(page.querySelector("[data-you-tab]")?.getAttribute("data-you-tab")).toBe("wallet");
  expect(page.querySelector('[data-payout-wallet="none"]')).not.toBeNull();
});

it("opens Wallet & Devices inline when sent to link a wallet and keeps the return query across tab switches", async () => {
  const page = await open("/profile?next=%2Fshop#wallet", 1440);
  expect(page.querySelector("[data-you-tab]")?.getAttribute("data-you-tab")).toBe("wallet");
  expect(page.querySelector('[data-payout-wallet="none"]')).not.toBeNull();
  const tabs = [...page.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  await act(async () => tabs[0]!.click());
  expect(currentLocation).toEqual({ pathname: "/profile", search: "?next=%2Fshop", hash: "#realms" });
  expect(page.querySelector("[data-you-tab]")?.getAttribute("data-you-tab")).toBe("overview");
  await act(async () => tabs[2]!.click());
  expect(currentLocation).toEqual({ pathname: "/profile", search: "?next=%2Fshop", hash: "#wallet" });
  expect(page.querySelector("[data-you-tab]")?.getAttribute("data-you-tab")).toBe("wallet");
});

it("shows one invite control and one primary button on /profile#referrals when the player holds an Aspect", async () => {
  signedIn.games = [
    {
      chainId: "0x52",
      game_id: 1,
      name: "frontier-100",
      mode: "frontier",
      status: "Live",
      clock_scale: 1,
      clock: { start_main_at: 100, end_at: 9_999_999_999 },
      aspect_race: {
        finish_height: 10_000,
        season_days: 50,
        heights: { 1: 0, 2: 0, 3: 0, 4: 0 },
        triumph_percents: { 1: 150, 2: 200, 3: 50, 4: 200 },
      },
      player_state: { structures: [{ entity_id: 7, category: 1, realm_id: 1, level: 1 }] },
    },
  ];
  vi.spyOn(identityClient, "shareTally").mockResolvedValue({
    links: 1,
    posted: 1,
    visits: 2,
    joined: 1,
    activated: 0,
    friendsPaid: 1,
    fragmentsEarned: 25,
  });
  vi.spyOn(identityClient, "createInvite").mockResolvedValue({
    code: "CODE1234",
    aspect: 1,
    chainId: null,
    gameId: null,
  });
  vi.spyOn(identityClient, "invitedFriends").mockResolvedValue({
    friends: [
      { name: null, joinedAt: 3, glory: 120, state: "reached" },
      { name: "Rowan", joinedAt: 2, glory: 100, state: "paid" },
      { name: "Aldric", joinedAt: 1, glory: 45, state: "joined" },
    ],
  });
  const page = await open("/profile#referrals", 1440);
  await vi.waitFor(() =>
    expect([...page.querySelectorAll("button")].some((button) => button.textContent === SEASON_INVITE_WORDS.copy)).toBe(
      true,
    ),
  );
  const inviteTexts = new Set<string>([SEASON_INVITE_WORDS.copy, INVITE_WORDS.copy]);
  const inviteButtons = [...page.querySelectorAll("button, a")].filter((node) =>
    inviteTexts.has(node.textContent ?? ""),
  );
  expect(inviteButtons.map((node) => node.textContent)).toEqual([SEASON_INVITE_WORDS.copy]);
  const railTexts = [...page.querySelectorAll("[data-you-profile] button, [data-you-profile] a")].map(
    (node) => node.textContent,
  );
  expect(railTexts).not.toContain(INVITE_WORDS.copy);
  expect(page.querySelectorAll('button[data-kind="primary"], a[data-kind="primary"]')).toHaveLength(
    SEASON_SPENDS_FRAGMENTS ? 1 : 0,
  );
  await vi.waitFor(() => expect(page.querySelectorAll("[data-friend-state]")).toHaveLength(3));
  expect([...page.querySelectorAll("[data-friend-state]")].map((row) => row.textContent)).toEqual([
    "A friendReached 100 Glory120 Glory",
    "RowanPaid you 100 Fragments100 Glory",
    "AldricJoined45 Glory",
  ]);
  expect([...page.querySelectorAll("[data-friend-state]")].map((row) => row.getAttribute("data-friend-state"))).toEqual(
    ["reached", "paid", "joined"],
  );
});

it("offers Copy invite link on /profile#referrals for a pre-season player who chose an Order, and shows the empty friends state", async () => {
  vi.spyOn(identityClient, "shareTally").mockResolvedValue({
    links: 0,
    posted: 0,
    visits: 0,
    joined: 0,
    activated: 0,
    friendsPaid: 0,
    fragmentsEarned: 0,
  });
  vi.spyOn(identityClient, "getOrderIntent").mockResolvedValue({ order: 1, members: { 1: 12 } });
  vi.spyOn(identityClient, "createInvite").mockResolvedValue({
    code: "PRE12345",
    aspect: 1,
    chainId: null,
    gameId: null,
  });
  vi.spyOn(identityClient, "invitedFriends").mockResolvedValue({ friends: [] });
  const page = await open("/profile#referrals", 390);
  await vi.waitFor(() =>
    expect([...page.querySelectorAll("button")].some((button) => button.textContent === SEASON_INVITE_WORDS.copy)).toBe(
      true,
    ),
  );
  expect(page.textContent).not.toContain(PROFILE_WORDS.noAspectInvite);
  expect(page.textContent).toContain("Prowess");
  await vi.waitFor(() => expect(page.querySelector("[data-invited-friends-empty]")).not.toBeNull());
  expect(page.querySelector("[data-invited-friends-empty]")?.textContent).toBe(INVITED_FRIENDS_WORDS.empty);
  expect(page.querySelectorAll("[data-friend-state]")).toHaveLength(0);
});

it("offers no invite and no failure on /profile#referrals when identity has no invite for the chosen Order's account", async () => {
  vi.spyOn(identityClient, "shareTally").mockResolvedValue({
    links: 0,
    posted: 0,
    visits: 0,
    joined: 0,
    activated: 0,
    friendsPaid: 0,
    fragmentsEarned: 0,
  });
  vi.spyOn(identityClient, "getOrderIntent").mockResolvedValue({ order: 1, members: { 1: 12 } });
  let answer!: (invite: null) => void;
  const createInvite = vi
    .spyOn(identityClient, "createInvite")
    .mockReturnValue(new Promise((resolve) => (answer = resolve)));
  vi.spyOn(identityClient, "invitedFriends").mockResolvedValue({ friends: [] });
  const page = await open("/profile#referrals", 390);
  await vi.waitFor(() => expect(page.textContent).toContain(INVITE_WORDS.making));
  await act(async () => answer(null));
  await vi.waitFor(() => expect(page.textContent).not.toContain(INVITE_WORDS.making));
  expect([...page.querySelectorAll("button")].map((button) => button.textContent)).not.toContain(
    SEASON_INVITE_WORDS.copy,
  );
  expect(page.textContent).not.toContain(INVITE_WORDS.failed);
  expect(createInvite).toHaveBeenCalledOnce();
});

it("shows the join-Aspect prompt on /profile#referrals only when the player has neither a Season Aspect nor a chosen Order", async () => {
  vi.spyOn(identityClient, "shareTally").mockResolvedValue({
    links: 0,
    posted: 0,
    visits: 0,
    joined: 0,
    activated: 0,
    friendsPaid: 0,
    fragmentsEarned: 0,
  });
  vi.spyOn(identityClient, "getOrderIntent").mockResolvedValue({ order: null, members: {} });
  const createInvite = vi.spyOn(identityClient, "createInvite");
  vi.spyOn(identityClient, "invitedFriends").mockResolvedValue({ friends: [] });
  const page = await open("/profile#referrals", 1440);
  await vi.waitFor(() => expect(page.textContent).toContain(PROFILE_WORDS.noAspectInvite));
  expect(createInvite).not.toHaveBeenCalled();
});

describe("a session with no name claimed yet", () => {
  it.each(["/profile", "/profile/settings"])("offers Save name, and Sign out, on %s", async (path) => {
    const named = signedIn.session;
    signedIn.session = { ...named, user: { ...named.user, name: named.user.id } } as unknown as Session;
    try {
      const page = await open(path, 1440);
      const buttons = [...page.querySelectorAll("button")].map((button) => button.textContent);
      expect(buttons).toContain("Save name");
      expect(buttons).toContain("Sign out");
    } finally {
      signedIn.session = named;
    }
  });
});
