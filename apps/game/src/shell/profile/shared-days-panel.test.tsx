// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

/** Identity's tally of the player's shared days, as GET /api/shares answers it, and the account signed in. */
const service = vi.hoisted(() => ({ shareTally: vi.fn() }));
const identity = vi.hoisted(() => ({
  session: { user: { realmsId: "0xa" } } as { user: { realmsId: string } } | null,
}));
vi.mock("@/hooks/context/identity-session", async (original) => ({
  ...(await original<typeof import("@/hooks/context/identity-session")>()),
  useIdentitySession: () => identity,
  identityClient: service,
}));

import { SharedDaysPanel } from "./shared-days-panel";

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  service.shareTally.mockReset();
  identity.session = { user: { realmsId: "0xa" } };
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

/** Opens the player's page afresh (a new mount), on its own app or on the app `client` already serves. */
const draw = async (client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) => {
  await act(async () => root.unmount());
  root = createRoot(host);
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <SharedDaysPanel />
      </QueryClientProvider>,
    ),
  );
  await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
};
const figures = () =>
  [...host.querySelectorAll(".app-figure")].map((figure) => [
    figure.querySelector(".app-figure__value")?.textContent,
    figure.querySelector(".app-figure__label")?.textContent,
  ]);

it("counts each step a friend took through the player's shared days", async () => {
  service.shareTally.mockResolvedValue({ links: 6, posted: 5, visits: 1_240, joined: 31, activated: 12 });
  await draw();
  expect(host.querySelector("section")?.getAttribute("aria-label")).toBe("Your shared days");
  expect(figures()).toEqual([
    ["5", "Days posted"],
    ["1.2K", "Opened by friends"],
    ["31", "Friends who joined"],
    ["12", "Cleared a site"],
  ]);
});

it("stands only once the player has posted a day, and says nothing when identity cannot tell", async () => {
  service.shareTally.mockResolvedValue({ links: 0, posted: 0, visits: 0, joined: 0, activated: 0 });
  await draw();
  expect(host.textContent).toBe("");
  // A sheet opened and closed without a post made a link, but shared no day.
  service.shareTally.mockResolvedValue({ links: 1, posted: 0, visits: 0, joined: 0, activated: 0 });
  await draw();
  expect(host.textContent).toBe("");
  service.shareTally.mockRejectedValue(new Error("identity unavailable"));
  await draw();
  expect(host.textContent).toBe("");
});

it("never shows the account before's counts to the next account on the same app, while its own are read or refused", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  service.shareTally.mockResolvedValue({ links: 6, posted: 5, visits: 1_240, joined: 31, activated: 12 });
  await draw(client);
  expect(figures()).toHaveLength(4);

  // A signs out, then B signs in; B's read is slow, then refused.
  identity.session = null;
  await draw(client);
  expect(host.textContent).toBe("");
  let refuse!: (error: Error) => void;
  service.shareTally.mockReturnValue(new Promise((_, reject) => (refuse = reject)));
  identity.session = { user: { realmsId: "0xb" } };
  await draw(client);
  expect(host.textContent).toBe("");
  await act(async () => refuse(new Error("identity unavailable")));
  expect(host.textContent).toBe("");
  expect(client.getQueryCache().findAll({ queryKey: ["own-shares", "0xa"] })).toEqual([]);
});
