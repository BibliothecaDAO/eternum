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

import { IdentityRequestError } from "@realms-world/identity";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import { frontierDevconPreset } from "../../../../../config/source/frontier/devcon";
import { setViewportWidth } from "../frame/test-viewport";
import { useConnectStore } from "../sign-in/connect";
import { DEVCON } from "./devcon";
import { JoinDevconPage } from "./join-devcon-page";

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
  expect(text()).not.toMatch(/golden|Essence/i);
  await press("Claim your realm");
  expect(useConnectStore.getState().request).toEqual({ next: "/join/devcon/T9HW3NPB" });
  expect(service.redeemCampaignTicket).not.toHaveBeenCalled();

  // Signed in, even back on the shared link (Discord finished elsewhere, the home-screen app reloaded): the kept code.
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
  expect(text()).toContain("One of 20 at Devcon");
  expect(text()).toContain("1,000 Labor each day");
  expect(text()).toContain("1,000 Essence each day");
  expect(localStorage.getItem("realms:campaign-code:devcon-2026")).toBeNull();
  await press("Continue");
  expect(path).toBe("/");
});

it("opens a regular ticket from the shared link: the Devcon realm and its Labor, no Essence", async () => {
  signIn();
  service.redeemCampaignTicket.mockResolvedValue({ campaign: "devcon-2026", tier: "regular" });
  await visit("/join/devcon");
  await press("Open your ticket");
  expect(service.redeemCampaignTicket.mock.calls).toEqual([["devcon-2026", null]]);
  expect(host.querySelector(".app-ticket")?.getAttribute("data-face")).toBe("opened");
  expect(text()).toContain("A Devcon realm is yours");
  expect(text()).toContain("1,000 Labor each day");
  expect(text()).not.toMatch(/golden|Essence/i);
});

it("says a closed campaign, and offers Try again when the ticket could not be opened", async () => {
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
});

it("promises the Labor, and a golden ticket's Essence, that the Devcon preset grants each day", () => {
  expect(frontierDevconPreset.labor).toEqual({ amount: DEVCON.laborPerDay, goldenEssence: DEVCON.goldenEssencePerDay });
});
