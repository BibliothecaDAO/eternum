import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";

const register = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("@/ui/features/factory-v2/api/factory-worker", () => ({ registerPlaytestSlot: register }));
vi.mock("@/hooks/context/identity-session", () => ({
  useIdentitySession: () => ({ status: "signed-in", session: { user: { realmsId: "0x7" } } }),
}));
vi.mock("./sign-in/sign-in-route", () => ({ useRequestSignIn: () => vi.fn() }));

import type { PlaytestSlot } from "@/ui/features/factory-v2/api/factory-worker";

import { useJoinSlot } from "./blitz-slot";

const slot = (name: string, entry: unknown): PlaytestSlot =>
  ({
    entry,
    name,
    closesAt: new Date(0).toISOString(),
    frozenAt: null,
    closed: false,
    registrations: [],
  }) as PlaytestSlot;

it("joins a free slot, and never calls the free join for a paid or broken one", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(console, "error").mockImplementation(() => {});
  let join: ReturnType<typeof useJoinSlot> | undefined;
  const Probe = () => {
    join = useJoinSlot();
    return null;
  };
  const root = createRoot(document.createElement("div"));
  await act(async () =>
    root.render(
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient()}>
          <Probe />
        </QueryClientProvider>
      </MemoryRouter>,
    ),
  );
  const ledger = { address: "0x1ed9e7", chainId: "0x534e5f4d41494e", shard: "0xa", gameId: 1 };
  await act(async () => join!.join(slot("paid", { kind: "paid", ledger })));
  await act(async () => join!.join(slot("broken", { kind: "paid" })));
  expect(register).not.toHaveBeenCalled();
  await act(async () => join!.join(slot("free", { kind: "free" })));
  expect(register).toHaveBeenCalledWith("free", expect.anything());
  await act(async () => root.unmount());
});
