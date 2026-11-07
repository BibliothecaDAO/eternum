// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

/** Identity's tally of the player's shared days, as GET /api/shares answers it. */
const service = vi.hoisted(() => ({ shareTally: vi.fn() }));
vi.mock("@/hooks/context/identity-session", async (original) => ({
  ...(await original<typeof import("@/hooks/context/identity-session")>()),
  identityClient: service,
}));

import { SharedDaysPanel } from "./shared-days-panel";

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  service.shareTally.mockReset();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

const draw = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <SharedDaysPanel />
      </QueryClientProvider>,
    ),
  );
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
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

it("stands only once the player has shared a day, and says nothing when identity cannot tell", async () => {
  service.shareTally.mockResolvedValue({ links: 0, posted: 0, visits: 0, joined: 0, activated: 0 });
  await draw();
  expect(host.textContent).toBe("");
  service.shareTally.mockRejectedValue(new Error("identity unavailable"));
  await draw();
  expect(host.textContent).toBe("");
});
