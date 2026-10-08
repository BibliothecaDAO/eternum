import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/hooks/context/identity-session", () => ({ useIdentitySession: () => ({ session: null }) }));
vi.spyOn(console, "error").mockImplementation(() => undefined);

import { BlitzPanel } from "@/shell/season-tab/blitz-rating";

import { API_READ_TIMEOUT_MS, fetchApi } from "./app-api";

/** A service that takes the request and never answers; it gives up only when the caller aborts. */
const hangingFetch = vi.fn(
  (_input: unknown, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) =>
      init?.signal?.addEventListener("abort", () => reject(init.signal!.reason)),
    ),
);

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  hangingFetch.mockClear();
});

it("ends a read that never answers in the screen's failure line, and leaves a write to finish", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout"] });
  vi.stubGlobal("fetch", hangingFetch);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  const root = createRoot(container);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <BlitzPanel games={null} />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  expect(container.textContent).not.toContain("Ratings did not answer.");
  await act(async () => vi.advanceTimersByTime(API_READ_TIMEOUT_MS - 1));
  expect(container.textContent).not.toContain("Ratings did not answer.");
  await act(async () => vi.advanceTimersByTime(1));
  await act(async () => vi.runOnlyPendingTimersAsync());
  expect(container.textContent).toContain("Ratings did not answer.");
  await act(async () => root.unmount());

  void fetchApi("/api/slots/blitz-1630/register", { method: "POST" });
  expect(hangingFetch.mock.lastCall?.[1]?.signal).toBeUndefined();
});
