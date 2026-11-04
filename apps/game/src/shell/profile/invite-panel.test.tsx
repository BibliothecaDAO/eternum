// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

/** The identity service: a signed-in account, and its referral link as the referral route answers it. */
const service = vi.hoisted(() => ({ campaignReferral: vi.fn() }));
vi.mock("@/hooks/context/identity-session", async (original) => ({
  ...(await original<typeof import("@/hooks/context/identity-session")>()),
  identityClient: service,
  useIdentitySession: () => ({ status: "signed-in", session: { user: { realmsId: "0xa1" } } }),
}));
vi.mock("../herald", async (original) => ({
  ...(await original<typeof import("../herald")>()),
  useDirectory: () => ({ data: { games: [] }, isError: false }),
}));

import type { CampaignReferral } from "@realms-world/identity";
import { MemoryRouter } from "react-router-dom";

import { InvitePanel } from "./invite-panel";

let host: HTMLDivElement;
let root: Root;
let client: QueryClient;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  service.campaignReferral.mockReset();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

const answer = (
  home: CampaignReferral["home"],
  friends: [string | null, CampaignReferral["friends"][number]["state"]][],
  earned: Partial<CampaignReferral["earned"]> = {},
): CampaignReferral => ({
  code: "7KQ2MX4D",
  home,
  friends: friends.map(([name, state]) => ({ name, state })),
  earned: { ticket: false, golden: false, ...earned },
});
const show = async (referral: CampaignReferral | Error) => {
  if (referral instanceof Error) service.campaignReferral.mockRejectedValue(referral);
  else service.campaignReferral.mockResolvedValue(referral);
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <InvitePanel />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  await vi.waitFor(() => expect(text()).toContain("Invite friends"));
  expect(service.campaignReferral).toHaveBeenLastCalledWith("devcon-2026");
};
const text = () => document.body.textContent ?? "";
const dialog = () => document.querySelector("[role=dialog]")?.getAttribute("aria-label") ?? null;

it("shows a free home's link, what each friend gets and earns it, and each friend's progress", async () => {
  await show(
    answer("free", [
      ["Corvin", "founded"],
      [null, "signed"],
    ]),
  );
  expect(text()).toContain("Invite friends");
  expect(text()).toContain(`${window.location.host}/join/devcon/r/7KQ2MX4D`);
  expect(text()).toContain("you get a Devcon realm for your home too");
  expect(text()).toContain("Your Devcon realm");
  expect(text()).toContain("CorvinFounded, clearing a first site");
  expect(text()).toContain("A friendSigned up, not founded yet");
  expect(text()).not.toMatch(/to golden/);
  expect(dialog()).toBeNull();

  const writeText = vi.fn(async () => undefined);
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
  await act(async () =>
    [...document.querySelectorAll("button")].find((button) => button.textContent === "Copy")!.click(),
  );
  expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/join/devcon/r/7KQ2MX4D`);
  expect(text()).toContain("Copied");
});

it("counts a Devcon home's friends toward golden, and promises a held Realm's nothing more", async () => {
  await show(
    answer("devcon", [
      ["Corvin", "counted"],
      ["Isolde", "counted"],
      ["Tamsin", "founded"],
    ]),
  );
  expect(text()).toContain("2 of 3 to golden");
  expect(text()).toContain("When 3 friends have founded a realm and cleared a site, your Devcon realm turns golden.");
  expect(text()).toContain("Golden realm");

  await act(async () => root.unmount());
  root = createRoot(host);
  client = new QueryClient();
  await show(answer("held", [["Corvin", "counted"]]));
  expect(text()).toContain("there is nothing more to earn");
  expect(text()).not.toMatch(/to golden|Your Devcon realm/);
});

it("says once what friends earned, and asks again for the account's ticket", async () => {
  client.setQueryData(["campaign-ticket", "0xa1", "devcon-2026"], null);
  await show(
    answer("devcon", [
      ["Corvin", "counted"],
      [null, "signed"],
    ]),
  );
  expect(dialog()).toBeNull();
  expect(client.getQueryState(["campaign-ticket", "0xa1", "devcon-2026"])?.isInvalidated).toBe(false);

  client.clear();
  await act(async () => root.unmount());
  root = createRoot(host);
  client.setQueryData(["campaign-ticket", "0xa1", "devcon-2026"], null);
  await show(answer("devcon", [["Corvin", "counted"]], { ticket: true }));
  expect(dialog()).toBe("Corvin counted: your Devcon realm");
  expect(client.getQueryState(["campaign-ticket", "0xa1", "devcon-2026"])?.isInvalidated).toBe(true);
  await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  expect(dialog()).toBeNull();

  // Golden over the ticket, once; a later visit says neither again.
  await act(async () => root.unmount());
  root = createRoot(host);
  client = new QueryClient();
  await show(answer("golden", [["Corvin", "counted"]], { ticket: true, golden: true }));
  expect(dialog()).toBe("3 friends counted: your realm turns golden");
  await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  await act(async () => root.unmount());
  root = createRoot(host);
  client = new QueryClient();
  await show(answer("golden", [["Corvin", "counted"]], { ticket: true, golden: true }));
  expect(dialog()).toBeNull();
});

it("says when the link could not be loaded", async () => {
  await show(new Error("unavailable"));
  expect(text()).toContain("Your invite link could not be loaded.");
});
