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

import { setViewportWidth } from "../frame/test-viewport";
import { InvitePanel } from "./invite-panel";

let host: HTMLDivElement;
let root: Root;
let client: QueryClient;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  setViewportWidth(1440);
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

type Listed = [string | null, CampaignReferral["friends"][number]["state"], "golden"?];
const answer = (
  home: CampaignReferral["home"],
  friends: Listed[],
  {
    tier = home === "free" || home === "held" ? null : "regular",
    goldenPending = false,
    linkGolden = false,
    earned = {},
  }: {
    tier?: CampaignReferral["tier"];
    goldenPending?: boolean;
    linkGolden?: boolean;
    earned?: Partial<CampaignReferral["earned"]>;
  } = {},
): CampaignReferral => ({
  code: "7KQ2MX4D",
  home,
  tier,
  goldenPending,
  link: { counted: friends.filter(([, state]) => state === "counted").length, golden: linkGolden },
  friends: friends.map(([name, state, golden]) => ({ name, state, golden: golden === "golden" })),
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
      [null, "signed", "golden"],
    ]),
  );
  expect(text()).toContain("Invite friends");
  expect(text()).toContain(`${window.location.host}/join/devcon/r/7KQ2MX4D`);
  expect(text()).toContain("1 in 10 of them golden");
  expect(text()).toContain("you get a Devcon realm too");
  expect(text()).toContain("0 of 10 friends");
  expect(text()).toContain("CorvinFounded, clearing a first site");
  expect(text()).toContain("A friendSigned up, not founded yetGolden");
  expect(dialog()).toBeNull();

  const writeText = vi.fn(async () => undefined);
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
  await act(async () =>
    [...document.querySelectorAll("button")].find((button) => button.textContent === "Copy")!.click(),
  );
  expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/join/devcon/r/7KQ2MX4D`);
  expect(text()).toContain("Copied");
});

it("shows a Devcon home both ways to golden, a friend who is not counted, and promises a held Realm nothing", async () => {
  await show(
    answer("devcon", [
      ["Corvin", "counted"],
      ["Isolde", "excluded"],
      ["Tamsin", "founded"],
    ]),
  );
  expect(text()).toContain("A golden friend who founds a realm and clears a site turns your realm golden.");
  expect(text()).toContain("A golden friend1 in 10 tickets, once that friend counts");
  expect(text()).toContain("A golden linkat 10 friends: you and every friend · 1 of 10 friends");
  expect(text()).toContain("IsoldeSame email or device as another player, so not countedNot counted");

  await act(async () => root.unmount());
  root = createRoot(host);
  client = new QueryClient();
  await show(answer("held", [["Corvin", "counted", "golden"]]));
  expect(text()).toContain("it earns nothing more");
  expect(text()).not.toMatch(/A golden friend1 in|Your Devcon realm/);
});

it("says golden earned but not confirmed honestly, and says golden once only once the game shows it", async () => {
  const pending = answer("devcon", [["Corvin", "counted", "golden"]], {
    tier: "golden",
    goldenPending: true,
    earned: { ticket: true, golden: true },
  });
  await show(pending);
  expect(text()).toContain("Golden earned. Your realm turns golden once the game confirms it");
  expect(text()).not.toContain("Your realm is golden");
  expect(dialog()).toBeNull();

  // Pending said nothing, so the golden moment is still owed once the board shows the realm golden.
  await act(async () => root.unmount());
  root = createRoot(host);
  client = new QueryClient();
  await show({ ...pending, home: "golden", goldenPending: false });
  expect(text()).toContain("Your realm is golden.");
  expect(dialog()).toBe("A golden friend counted");
  expect(text()).toContain("Your Devcon realm is golden from your next daily claim.");
  await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  await act(async () => root.unmount());
  root = createRoot(host);
  client = new QueryClient();
  await show({ ...pending, home: "golden", goldenPending: false });
  expect(dialog()).toBeNull();
});

it("says once a ticket friends earned, golden when the link went golden, and asks again for the account's ticket", async () => {
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
  await show(answer("ticket", [["Corvin", "counted"]], { earned: { ticket: true } }));
  expect(dialog()).toBe("Corvin counted: your Devcon realm");
  expect(client.getQueryState(["campaign-ticket", "0xa1", "devcon-2026"])?.isInvalidated).toBe(true);
  await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  expect(dialog()).toBeNull();

  // A golden ticket still to add says golden, with the link's own title.
  await act(async () => root.unmount());
  root = createRoot(host);
  client = new QueryClient();
  await show(
    answer("ticket", [["Corvin", "counted", "golden"]], {
      tier: "golden",
      linkGolden: true,
      earned: { ticket: true, golden: true },
    }),
  );
  expect(dialog()).toBe("Your link went golden");
  expect(text()).toContain("Golden link");
  expect(text()).toContain("Your Devcon ticket is golden. Add it to your home from its daily claim.");
});

it("draws a phone's panel compact: the link and its icon Copy on one row, the link's slots, one row per friend", async () => {
  setViewportWidth(390);
  await show(
    answer("devcon", [
      ["Corvin", "counted"],
      ["Isolde", "counted", "golden"],
      ["Tamsin", "excluded"],
      [null, "founded"],
    ]),
  );
  expect(text()).toContain("Each friend gets a Devcon realm, 1 in 10 golden. A golden friend makes yours golden.");
  // No milestone boxes, no worded Copy: an icon button named Copy beside the address.
  expect(text()).not.toContain("A golden friend1 in 10");
  const copy = document.querySelector<HTMLButtonElement>('button[aria-label="Copy"]')!;
  expect(copy.textContent).toBe("");
  expect(copy.parentElement!.textContent).toContain(`${window.location.host}/join/devcon/r/7KQ2MX4D`);
  // Ten slots, two filled, the golden link's mark at the end and its rule in one line.
  const slots = document.querySelector('[role="img"][aria-label="2 of 10 friends"]')!;
  expect(slots.querySelectorAll(":scope > span.rounded")).toHaveLength(10);
  expect(text()).toContain("At 10, your link turns golden for everyone.");
  // One row per friend: a second line only for the friend not counted.
  const rows = [...document.querySelectorAll("li")];
  expect(rows.map((row) => row.textContent)).toEqual([
    "CorvinCounted",
    "IsoldeGoldenCounted",
    "TamsinNot countedSame email or device as another player",
    "A friendFounded",
  ]);
  expect(rows[0]!.getAttribute("title")).toBe("Founded and cleared a site");

  const writeText = vi.fn(async () => undefined);
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
  await act(async () => copy.click());
  expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/join/devcon/r/7KQ2MX4D`);
  expect(document.querySelector('button[aria-label="Copied"]')).not.toBeNull();
});

it("says when the link could not be loaded", async () => {
  await show(new Error("unavailable"));
  expect(text()).toContain("Your invite link could not be loaded.");
});
