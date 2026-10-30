// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

/** The identity service: a session the test sets, and the account's ticket as the redeem route answers it. */
const service = vi.hoisted(() => ({
  session: { status: "signed-out", session: null } as {
    status: string;
    session: { user: { realmsId: string } } | null;
  },
  redeemCampaignTicket: vi.fn(),
}));
vi.mock("@/hooks/context/identity-session", async (original) => ({
  ...(await original<typeof import("@/hooks/context/identity-session")>()),
  identityClient: service,
  useIdentitySession: () => service.session,
}));
/** The games the directory lists: the Devcon season (preset 6) beside an ordinary Frontier one. */
const directory = vi.hoisted(() => ({ games: [] as unknown[] | undefined }));
vi.mock("../herald", async (original) => ({
  ...(await original<typeof import("../herald")>()),
  useDirectory: () => ({ data: directory.games && { games: directory.games }, isError: false }),
}));

import { CAMPAIGNS, IdentityRequestError } from "@realms-world/identity";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import { setViewportWidth } from "../frame/test-viewport";
import { entryHref } from "../game-links";
import { useConnectStore } from "../sign-in/connect";
import { JoinDevconPage } from "./join-devcon-page";
import { homeDailyClaim } from "@bibliothecadao/eternum";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { campaignHomeFacts } from "@/lab/game/campaign-scenario";

const season = (gameId: number, presetId: number) => ({
  chainId: "0x52",
  game_id: gameId,
  mode: "frontier",
  preset_id: presetId,
  status: "Live",
  clock: { start_main_at: 100 },
});
const DEVCON_SEASON = season(1, 6);

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  setViewportWidth(390);
  localStorage.clear();
  service.session = { status: "signed-out", session: null };
  service.redeemCampaignTicket.mockReset();
  directory.games = [season(2, 5), DEVCON_SEASON];
  useConnectStore.setState({ request: null });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

/** Where the router stands, written on the page for the test to read. */
const Where = () => {
  const location = useLocation();
  return <output data-where>{`${location.pathname}${location.search}`}</output>;
};
const path = () => host.querySelector("[data-where]")?.textContent ?? null;
const visit = (address: string) =>
  act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        {/* A new router per visit, as a page load is: a mounted router never reads new entries. */}
        <MemoryRouter key={address} initialEntries={[address]}>
          <Routes>
            <Route path="/join/devcon" element={<JoinDevconPage />} />
            <Route path="/join/devcon/:code" element={<JoinDevconPage />} />
            <Route path="*" element={null} />
          </Routes>
          <Where />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
const signIn = () => {
  service.session = { status: "signed-in", session: { user: { realmsId: "0xa1" } } };
};
type Answer = "regular" | "golden" | Error;
/**
 * The account's tickets as the redeem route answers them: `held`, the read without a code (none unless given), and
 * `opens`, what a flyer's code opens.
 */
const tickets = ({ held, opens }: { held?: Answer; opens?: Answer }) =>
  service.redeemCampaignTicket.mockImplementation(async (_campaign: string, code: string | null) => {
    const answer = code === null ? (held ?? new IdentityRequestError(400, "invalid_redemption")) : opens;
    if (answer === undefined) throw new Error("no answer for a code");
    if (answer instanceof Error) throw answer;
    return { campaign: "devcon-2026", tier: answer };
  });
/** The flyers' codes the page redeemed: a read without a code opens nothing. */
const redeemedCodes = () =>
  service.redeemCampaignTicket.mock.calls.map(([, code]) => code).filter((code) => code !== null);
const kept = () => localStorage.getItem("realms:campaign-code:devcon-2026");
const text = () => host.textContent ?? "";
const buttons = () => [...host.querySelectorAll("button")].map((button) => button.textContent);
const press = (label: string) =>
  act(async () => [...host.querySelectorAll("button")].find((button) => button.textContent?.includes(label))!.click());

it("shows every visitor the sealed ticket alone, and opens it as soon as sign-in comes back", async () => {
  await visit("/join/devcon/T9HW3NPB");
  expect(text()).toContain("Your ticket");
  expect(text()).toContain("A realm waits for you");
  // Nothing before the opening tells a tier or what it claims: the opening can never contradict it.
  expect(text()).not.toMatch(/golden|Labor|Essence|Devcon realm/i);
  expect(buttons()).toEqual(["Open your ticket"]);
  await press("Open your ticket");
  expect(useConnectStore.getState().request).toEqual({ next: "/join/devcon?open" });
  expect(service.redeemCampaignTicket).not.toHaveBeenCalled();

  // Back from sign-in on the bare link, which serves the kept code: the ticket opens without a second press.
  signIn();
  tickets({ opens: "golden" });
  await visit("/join/devcon?open");
  await vi.waitFor(() => expect(host.querySelector(".app-ticket")?.getAttribute("data-face")).toBe("golden"));
  expect(redeemedCodes()).toEqual(["T9HW3NPB"]);
  expect(path()).toBe("/join/devcon");
  expect(host.querySelector(".app-ticket")?.getAttribute("data-face")).toBe("golden");
  expect(text()).toContain("Golden Devcon ticket");
  // The count printed on flyers and the one the landing tells are the campaign's one golden count.
  expect(text()).toContain(`One of ${CAMPAIGNS["devcon-2026"].golden} at Devcon`);
  expect(text()).toContain("2,000 Labor each day");
  expect(text()).toContain("2,000 Essence each day");
  expect(kept()).toBeNull();
  await press("Choose your home");
  expect(path()).toBe(entryHref(DEVCON_SEASON as never, "play"));
});

it("lets an account already signed in open its ticket with a deliberate press, and spins while it opens", async () => {
  signIn();
  let answer: () => void = () => undefined;
  const answered = new Promise<void>((resolve) => (answer = resolve));
  service.redeemCampaignTicket.mockImplementation(async (_campaign: string, code: string | null) => {
    if (code === null) throw new IdentityRequestError(400, "invalid_redemption");
    await answered;
    return { campaign: "devcon-2026", tier: "regular" };
  });
  await visit("/join/devcon/K7M2QX4R");
  expect(buttons()).toEqual(["Open your ticket"]);
  expect(redeemedCodes()).toEqual([]);
  await press("Open your ticket");
  // Opening is under way, not refused: the shared spinner and its word, at full strength.
  const opening = [...host.querySelectorAll("button")].find((button) => button.textContent === "Opening…")!;
  expect(opening.getAttribute("aria-busy")).toBe("true");
  expect(opening.querySelector(".ui-spinner")).not.toBeNull();
  await act(async () => answer());
  expect(redeemedCodes()).toEqual(["K7M2QX4R"]);
  expect(host.querySelector(".app-ticket")?.getAttribute("data-face")).toBe("opened");
  expect(text()).toContain("Devcon ticket");
  expect(text()).toContain("A Devcon realm is yours");
  expect(text()).toContain("1,000 Labor each day");
  expect(text()).toContain("1,000 Essence each day");
  expect(text()).not.toMatch(/golden/i);
});

it("says plainly that an account already holds its ticket, shows that one, and never spends a second flyer", async () => {
  signIn();
  tickets({ held: "golden", opens: "regular" });
  await visit("/join/devcon/K7M2QX4R");
  await vi.waitFor(() => expect(text()).toContain("You already hold your Devcon ticket"));
  expect(host.querySelector(".app-ticket")?.getAttribute("data-face")).toBe("golden");
  expect(text()).toContain("2,000 Labor each day");
  // The second flyer's code is never redeemed, and leaves this browser for someone else.
  expect(redeemedCodes()).toEqual([]);
  expect(kept()).toBeNull();
  await press("Choose your home");
  expect(path()).toBe(entryHref(DEVCON_SEASON as never, "play"));
});

it("checks for a held ticket again when Open is pressed before the account's ticket could be read", async () => {
  signIn();
  service.redeemCampaignTicket.mockRejectedValueOnce(new IdentityRequestError(503, "campaigns_unavailable"));
  await visit("/join/devcon/K7M2QX4R");
  expect(buttons()).toEqual(["Open your ticket"]);
  tickets({ held: "regular", opens: "golden" });
  await press("Open your ticket");
  expect(text()).toContain("You already hold your Devcon ticket");
  expect(host.querySelector(".app-ticket")?.getAttribute("data-face")).toBe("opened");
  expect(text()).not.toMatch(/golden/i);
  expect(redeemedCodes()).toEqual([]);
});

it("offers Try again when the ticket could not be opened, and Play once the campaign has closed", async () => {
  signIn();
  tickets({ opens: new Error("offline") });
  await visit("/join/devcon/K7M2QX4R");
  await press("Open your ticket");
  expect(text()).toContain("Your ticket could not be opened.");
  expect(kept()).toBe("K7M2QX4R");
  tickets({ opens: new IdentityRequestError(410, "campaign_closed") });
  await press("Try again");
  expect(text()).toContain("Devcon tickets have closed.");
  expect(redeemedCodes()).toEqual(["K7M2QX4R", "K7M2QX4R"]);
  expect(text()).not.toContain("Try again");
  await press("Continue");
  expect(path()).toBe("/");
});

it.each([
  ["/join/devcon/K7M2QX4R", 410, "ticket_taken", "Another player already opened this ticket."],
  ["/join/devcon/K7M2QX4R", 409, "realm_founded", "Your realm is already founded: give this flyer to a friend."],
  ["/join/devcon", 400, "invalid_redemption", "This link holds no ticket. Scan the QR on your Devcon flyer."],
])("on %s, says why no ticket opens (%i %s) and leads on to Play", async (address, status, code, line) => {
  signIn();
  tickets({ opens: new IdentityRequestError(status, code) });
  await visit(address);
  await press("Open your ticket");
  expect(text()).toContain(line);
  expect(text()).not.toMatch(/Open your ticket|Try again/);
  // The flyer is not this account's to use: its code is let go, not kept for another try.
  expect(kept()).toBeNull();
  await press("Continue");
  expect(path()).toBe("/");
});

it("holds Choose your home until the directory says where the Devcon game is, never sending the player to Play", async () => {
  directory.games = undefined;
  signIn();
  tickets({ opens: "regular" });
  await visit("/join/devcon/K7M2QX4R");
  await press("Open your ticket");
  const waiting = [...host.querySelectorAll("button")].find((button) => button.textContent === "Choose your home")!;
  expect(waiting.disabled).toBe(true);
  expect(waiting.querySelector(".ui-spinner")).not.toBeNull();
  // The directory answers: the same reveal, now leading to the Devcon game.
  directory.games = [DEVCON_SEASON];
  await visit("/join/devcon/K7M2QX4R");
  await press("Choose your home");
  expect(path()).toBe(entryHref(DEVCON_SEASON as never, "play"));
});

it("leads Choose your home to Play while no Devcon game runs", async () => {
  directory.games = [season(2, 5)];
  signIn();
  tickets({ opens: "regular" });
  await visit("/join/devcon/K7M2QX4R");
  await press("Open your ticket");
  await press("Choose your home");
  expect(path()).toBe("/");
});

it.each([
  ["regular", "opened", { labor: 1_000, essence: 1_000 }],
  ["golden", "golden", { labor: 2_000, essence: 2_000 }],
] as const)("promises a %s ticket what its realm then claims in the game", async (tier, face, claim) => {
  // The realm as the contract founds it, read by the game's Realm sheet and the Day open push alike.
  const store = new NativeFactStore();
  store.applyFacts(campaignHomeFacts(tier) as never);
  expect(homeDailyClaim(store, { gameId: 1, entityId: 7, realmId: 0 })).toEqual(claim);

  signIn();
  tickets({ opens: tier });
  await visit("/join/devcon/K7M2QX4R");
  await press("Open your ticket");
  expect(host.querySelector(".app-ticket")?.getAttribute("data-face")).toBe(face);
  expect(text()).toContain(`${claim.labor.toLocaleString("en-US")} Labor each day`);
  expect(text()).toContain(`${claim.essence.toLocaleString("en-US")} Essence each day`);
});
