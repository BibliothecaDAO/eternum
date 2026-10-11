import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

import { RatingLine } from "./rating-line";

/** /api/ratings?players= as the identity service answers it, keyed by each wallet as sent. */
const answering = (ratings: Record<string, unknown>) =>
  vi.fn<(input: string | URL) => Promise<Response>>(async () =>
    Response.json({ block_number: 7, block_hash: "0x7", ratings }),
  );

afterEach(() => vi.unstubAllGlobals());

const lineFor = async (wallet: string | null) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <RatingLine wallet={wallet} />
      </QueryClientProvider>,
    ),
  );
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  const text = container.textContent;
  await act(async () => root.unmount());
  return text;
};

it("reads a rating by the wallet that played and shows it with its tier, never a change", async () => {
  const fetch = answering({ "0xe1": { status: "rated", player: "0xe1", rating: "2410.9" } });
  vi.stubGlobal("fetch", fetch);
  expect(await lineFor("0xe1")).toBe("2,410Storm Lord· Blitz rating");
  expect(String(fetch.mock.calls[0][0])).toBe("/api/ratings?players=0xe1");
});

it("tells a reader with no wallet how to carry a rating, and shows a dash for an unanswered read", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 503 })),
  );
  expect(await lineFor(null)).toBe("Link a wallet in Account to carry a rating.");
  expect(await lineFor("0xe1")).toBe("—· Blitz rating");
});
