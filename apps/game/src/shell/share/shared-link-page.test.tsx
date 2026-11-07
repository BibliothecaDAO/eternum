// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

/** The identity service: a shared link's visit, as its route answers it. */
const service = vi.hoisted(() => ({ openShare: vi.fn() }));
vi.mock("@/hooks/context/identity-session", async (original) => ({
  ...(await original<typeof import("@/hooks/context/identity-session")>()),
  identityClient: service,
  useIdentitySession: () => ({ status: "signed-out", session: null }),
}));

import { IdentityRequestError } from "@realms-world/identity";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { setViewportWidth } from "../frame/test-viewport";
import { SharedLinkPage } from "./shared-link-page";

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  setViewportWidth(390);
  service.openShare.mockReset();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

/** A friend opens the link a player posted. */
const open = async (path: string) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/s/:code" element={<SharedLinkPage />} />
            <Route path="/" element={<p>Play page</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
};
const play = () =>
  [...host.querySelectorAll("a, button")].find((each) => each.textContent?.includes("Start your adventure"));

it("records the visit and says who shared which day, with the way into Frontier", async () => {
  service.openShare.mockResolvedValue({ kind: "frontier-day", moment: 12, name: "Ashwalker" });
  await open("/s/ABCD2345");
  expect(service.openShare).toHaveBeenCalledWith("ABCD2345", null);
  expect(host.textContent).toContain("Ashwalker shared Day 12 of Frontier");
  await act(async () => (play() as HTMLElement).click());
  expect(host.textContent).toBe("Play page");
});

it("tells identity the channel the link was posted from, and nothing for one no player's link carries", async () => {
  service.openShare.mockResolvedValue({ kind: "frontier-day", moment: 12, name: "Ashwalker" });
  await open("/s/ABCD2345?via=system");
  expect(service.openShare).toHaveBeenLastCalledWith("ABCD2345", "system");
  // Another link opened afresh, as a new tab would.
  await act(async () => root.unmount());
  root = createRoot(host);
  await open("/s/ABCD2346?via=fax");
  expect(service.openShare).toHaveBeenLastCalledWith("ABCD2346", null);
});

it("still leads into the game from a link that leads to no shared day, and asks identity nothing for a malformed one", async () => {
  service.openShare.mockRejectedValue(new IdentityRequestError(404, "share_unknown"));
  await open("/s/ABCD2345");
  expect(host.textContent).toContain("This link leads to no shared day.");
  expect(play()).toBeDefined();

  service.openShare.mockClear();
  await open("/s/not-a-code");
  expect(service.openShare).not.toHaveBeenCalled();
  expect(host.textContent).toContain("This link leads to no shared day.");
});
