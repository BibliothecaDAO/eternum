// @vitest-environment jsdom
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

import { CAMPAIGNS, IdentityRequestError } from "@realms-world/identity";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import { setViewportWidth } from "../frame/test-viewport";
import { useConnectStore } from "../sign-in/connect";
import { JoinDevconPage } from "./join-devcon-page";
import { homeDailyClaim } from "@bibliothecadao/eternum";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { campaignHomeFacts } from "@/lab/game/campaign-scenario";

let host: HTMLDivElement;
let root: Root;
let path = "";
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  setViewportWidth(390);
  localStorage.clear();
  service.session = { status: "signed-out", session: null };
  service.redeemCampaignTicket.mockReset();
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

const Where = () => {
  path = useLocation().pathname;
  return null;
};
const visit = (address: string) =>
  act(async () =>
    root.render(
      <MemoryRouter initialEntries={[address]}>
        <Routes>
          <Route path="/join/devcon" element={<JoinDevconPage />} />
          <Route path="/join/devcon/:code" element={<JoinDevconPage />} />
          <Route path="*" element={null} />
        </Routes>
        <Where />
      </MemoryRouter>,
    ),
  );
const signIn = () => {
  service.session = { status: "signed-in", session: { user: { realmsId: "0xa1" } } };
};
const text = () => host.textContent ?? "";
const press = (label: string) =>
  act(async () => [...host.querySelectorAll("button")].find((button) => button.textContent?.includes(label))!.click());

it("keeps a flyer's code through sign-in, and only the opened ticket says it is golden", async () => {
  await visit("/join/devcon/T9HW3NPB");
  expect(text()).toContain("A Devcon realm is yours");
  expect(text()).toContain("1,000 Labor each day");
  expect(text()).not.toMatch(/golden/i);
  expect(text()).toContain("1,000 Essence each day");
  await press("Claim your realm");
  expect(useConnectStore.getState().request).toEqual({ next: "/join/devcon/T9HW3NPB" });
  expect(service.redeemCampaignTicket).not.toHaveBeenCalled();

  // Signed in, even back on the bare link (Discord finished elsewhere, the home-screen app reloaded): the kept code.
  signIn();
  service.redeemCampaignTicket.mockResolvedValue({ campaign: "devcon-2026", tier: "golden" });
  await visit("/join/devcon");
  expect(text()).toContain("Your ticket");
  expect(text()).toContain("A realm waits for you");
  expect(text()).not.toMatch(/golden/i);
  await press("Open your ticket");
  expect(service.redeemCampaignTicket.mock.calls).toEqual([["devcon-2026", "T9HW3NPB"]]);
  expect(host.querySelector(".app-ticket")?.getAttribute("data-face")).toBe("golden");
  expect(text()).toContain("Golden ticket");
  // The count printed on flyers and the one the landing tells are the campaign's one golden count.
  expect(text()).toContain(`One of ${CAMPAIGNS["devcon-2026"].golden} at Devcon`);
  expect(text()).toContain("2,000 Labor each day");
  expect(text()).toContain("2,000 Essence each day");
  expect(localStorage.getItem("realms:campaign-code:devcon-2026")).toBeNull();
  await press("Continue");
  expect(path).toBe("/");
});

it("opens a regular ticket from a flyer's code: the Devcon realm with its Labor and Essence", async () => {
  signIn();
  service.redeemCampaignTicket.mockResolvedValue({ campaign: "devcon-2026", tier: "regular" });
  await visit("/join/devcon/K7M2QX4R");
  await press("Open your ticket");
  expect(service.redeemCampaignTicket.mock.calls).toEqual([["devcon-2026", "K7M2QX4R"]]);
  expect(host.querySelector(".app-ticket")?.getAttribute("data-face")).toBe("opened");
  expect(text()).toContain("A Devcon realm is yours");
  expect(text()).toContain("1,000 Labor each day");
  expect(text()).not.toMatch(/golden/i);
  expect(text()).toContain("1,000 Essence each day");
});

it("offers Try again when the ticket could not be opened, and Play once the campaign has closed", async () => {
  signIn();
  await visit("/join/devcon/K7M2QX4R");
  service.redeemCampaignTicket.mockRejectedValueOnce(new Error("offline"));
  await press("Open your ticket");
  expect(text()).toContain("Your ticket could not be opened.");
  expect(localStorage.getItem("realms:campaign-code:devcon-2026")).toBe("K7M2QX4R");
  service.redeemCampaignTicket.mockRejectedValueOnce(new IdentityRequestError(410, "campaign_closed"));
  await press("Try again");
  expect(text()).toContain("Devcon tickets have closed.");
  expect(service.redeemCampaignTicket).toHaveBeenLastCalledWith("devcon-2026", "K7M2QX4R");
  expect(text()).not.toContain("Try again");
  await press("Continue");
  expect(path).toBe("/");
});

it.each([
  ["/join/devcon/K7M2QX4R", 410, "ticket_taken", "Another player already opened this ticket."],
  ["/join/devcon/K7M2QX4R", 409, "realm_founded", "Your realm is already founded: give this flyer to a friend."],
  ["/join/devcon", 400, "invalid_redemption", "This link holds no ticket. Scan the QR on your Devcon flyer."],
])("on %s, says why no ticket opens (%i %s) and leads on to Play", async (address, status, code, line) => {
  signIn();
  service.redeemCampaignTicket.mockRejectedValueOnce(new IdentityRequestError(status, code));
  await visit(address);
  await press("Open your ticket");
  expect(text()).toContain(line);
  expect(text()).not.toMatch(/Open your ticket|Try again/);
  // The flyer is not this account's to use: its code is let go, not kept for another try.
  expect(localStorage.getItem("realms:campaign-code:devcon-2026")).toBeNull();
  await press("Continue");
  expect(path).toBe("/");
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
  service.redeemCampaignTicket.mockResolvedValue({ campaign: "devcon-2026", tier });
  await visit("/join/devcon/K7M2QX4R");
  await press("Open your ticket");
  expect(host.querySelector(".app-ticket")?.getAttribute("data-face")).toBe(face);
  expect(text()).toContain(`${claim.labor.toLocaleString("en-US")} Labor each day`);
  expect(text()).toContain(`${claim.essence.toLocaleString("en-US")} Essence each day`);
});
