import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";

vi.mock("@/hooks/context/identity-session", () => ({
  identityClient: {},
  useIdentitySession: () => ({ session: { user: { realmsId: "0x1" } } }),
}));
vi.mock("@bibliothecadao/eternum", () => ({
  getOrCreateDeviceKey: () => ({ publicKey: "0x2" }),
  readAccountDevices: async () => ({ devices: new Map(), failures: [] }),
  revokeDeviceEverywhere: vi.fn(),
}));
vi.mock("@/runtime/world/shards", () => ({ openKnownShards: async () => [], listOpenShards: () => [] }));
import { DevicesPanel } from "./devices";

it("shows a failed guardian prerequisite and lets the player retry the device list", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const fetchGuardian = vi
    .fn()
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValueOnce(Response.json({ publicKey: "0x2", accountClassHash: "0x3" }));
  vi.stubGlobal("fetch", fetchGuardian);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <DevicesPanel realmsId="0x1" />
        </QueryClientProvider>,
      ),
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(container.textContent).toContain("Your account could not be read");
    expect(container.textContent).not.toContain("Reading devices");
    await act(async () => container.querySelector("button")!.click());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(fetchGuardian).toHaveBeenCalledTimes(2);
    expect(container.textContent).not.toContain("Your account could not be read");
    expect(container.textContent).not.toContain("Reading devices");
  } finally {
    await act(async () => root.unmount());
    client.clear();
    vi.unstubAllGlobals();
  }
});
