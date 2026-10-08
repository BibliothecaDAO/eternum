import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

import { RatingLine } from "./rating-line";

/** /api/ratings?accounts= as lobby-chat-mmr.txt documents it, keyed by each account as sent. */
const answering = (ratings: Record<string, unknown>) =>
  vi.fn<(input: string | URL) => Promise<Response>>(async () =>
    Response.json({ block_number: 7, block_hash: "0x7", ratings }),
  );

afterEach(() => vi.unstubAllGlobals());

const lineFor = async (account: string, own: boolean) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <RatingLine account={account} own={own} />
      </QueryClientProvider>,
    ),
  );
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  const text = container.textContent;
  await act(async () => root.unmount());
  return text;
};

it("reads a player's rating by their gameplay account and shows it with its tier, never a change", async () => {
  const fetch = answering({ "0xa1": { status: "rated", player: "0xe1", rating: "2410.9" } });
  vi.stubGlobal("fetch", fetch);
  expect(await lineFor("0xa1", false)).toBe("2,410Storm Lord· Blitz rating");
  expect(String(fetch.mock.calls[0][0])).toBe("/api/ratings?accounts=0xa1");
});

it("tells the reader with no linked wallet how to carry a rating, and shows a dash for anyone else without one", async () => {
  vi.stubGlobal("fetch", answering({ "0xa1": { status: "unlinked", player: null, rating: null } }));
  expect(await lineFor("0xa1", true)).toBe("Link a wallet in Account to carry a rating.");
  expect(await lineFor("0xa1", false)).toBe("—· Blitz rating");
});

it("shows a dash for an account no Realms identity owns", async () => {
  vi.stubGlobal("fetch", answering({ "0xb0": { status: "unknown_identity", player: null, rating: null } }));
  expect(await lineFor("0xb0", false)).toBe("—· Blitz rating");
});
