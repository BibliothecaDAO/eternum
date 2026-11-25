import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/hooks/context/identity-session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/context/identity-session")>()),
  useIdentitySession: () => ({ session: null }),
}));
vi.spyOn(console, "error").mockImplementation(() => undefined);

import { identityClient } from "@/hooks/context/identity-session";
import { GUARDIAN_QUERY } from "@/shell/herald";
import { useSeasonCalendar } from "@/shell/season-calendar";
import { ServiceFailure } from "@/ui/design-system/kit/service-failure";

import { API_READ_TIMEOUT_MS, fetchApi, retryTransientRead } from "./app-api";
import { appQueryClient } from "./query-client";
import { SEASON_ERROR } from "../ui/design-system/kit/words";

/** A service that takes the request and never answers; it gives up only when the caller aborts. */
const hangingFetch = vi.fn(
  (_input: unknown, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) =>
      init?.signal?.addEventListener("abort", () => reject(init.signal!.reason)),
    ),
);

const SeasonCalendarRead = () => {
  const calendar = useSeasonCalendar();
  return calendar.isError ? <ServiceFailure service="season" error={calendar.error} /> : null;
};

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
          <SeasonCalendarRead />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  expect(container.textContent).not.toContain(SEASON_ERROR);
  await act(async () => vi.advanceTimersByTime(API_READ_TIMEOUT_MS - 1));
  expect(container.textContent).not.toContain(SEASON_ERROR);
  await act(async () => vi.advanceTimersByTime(1));
  await act(async () => vi.runOnlyPendingTimersAsync());
  expect(container.textContent).toContain(SEASON_ERROR);
  await act(async () => root.unmount());

  void fetchApi("/api/value/chests/finish?tokenId=41", { method: "POST" });
  expect(hangingFetch.mock.lastCall?.[1]?.signal).toBeUndefined();
});

it("never retries TimeoutError or AbortError in retryTransientRead and caps fast transient errors to one retry", () => {
  expect(retryTransientRead(0, new DOMException("timed out", "TimeoutError"))).toBe(false);
  expect(retryTransientRead(0, new DOMException("aborted", "AbortError"))).toBe(false);
  expect(retryTransientRead(0, { cause: new DOMException("timed out", "TimeoutError") })).toBe(false);
  expect(retryTransientRead(0, new Error("503"))).toBe(true);
  expect(retryTransientRead(1, new Error("503"))).toBe(false);
});

it("does not retry a timed-out useSeasonCalendar read under appQueryClient defaults", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout"] });
  vi.stubGlobal("fetch", hangingFetch);
  appQueryClient.clear();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <QueryClientProvider client={appQueryClient}>
        <MemoryRouter>
          <SeasonCalendarRead />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  await act(async () => vi.advanceTimersByTime(API_READ_TIMEOUT_MS));
  await act(async () => vi.runOnlyPendingTimersAsync());
  expect(container.textContent).toContain(SEASON_ERROR);
  expect(hangingFetch).toHaveBeenCalledTimes(1);
  await act(async () => root.unmount());
  appQueryClient.clear();
});

it("applies retryTransientRead by default on appQueryClient so timed-out GUARDIAN_QUERY is never retried", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout"] });
  vi.stubGlobal("fetch", hangingFetch);
  appQueryClient.clear();
  const pending = appQueryClient.fetchQuery(GUARDIAN_QUERY).catch((error) => error);
  await vi.advanceTimersByTimeAsync(API_READ_TIMEOUT_MS);
  const error = await pending;
  expect((error as { name?: string }).name).toBe("TimeoutError");
  expect(hangingFetch).toHaveBeenCalledTimes(1);
  appQueryClient.clear();
});

it("bounds real identityClient.getSession() reads and caller-signal GETs by API_READ_TIMEOUT_MS", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout"] });
  vi.stubGlobal("fetch", hangingFetch);
  const sessionRead = identityClient.getSession().catch((error) => error);
  await vi.advanceTimersByTimeAsync(API_READ_TIMEOUT_MS);
  const sessionError = await sessionRead;
  expect((sessionError as { cause?: { name?: string } }).cause?.name).toBe("TimeoutError");

  const controller = new AbortController();
  const signalRead = fetchApi("/api/directory", { signal: controller.signal }).catch((error) => error);
  await vi.advanceTimersByTimeAsync(API_READ_TIMEOUT_MS);
  const signalError = await signalRead;
  expect((signalError as { name?: string }).name).toBe("TimeoutError");
});
