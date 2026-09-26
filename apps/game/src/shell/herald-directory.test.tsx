import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/runtime/world/shards", () => ({
  listPastedShards: () => [],
  openPastedShards: async () => [],
  requireOpenShard: async () => undefined,
}));

// Staging's guardian and account class, and a Realms id whose account they place at `PLAYER`.
const GUARDIAN = {
  publicKey: "0x20b94f1f60aabd0d7538bc5d78b95829603d1c969220385992772be5283ca76",
  accountClassHash: "0x68995feeefffc1647118073e1ff16179f07eb8eed6c8fb03cce73109f5fbacd",
};
const REALMS_ID = "0x4dcca33a9dcd23f3d11f33c2082297968809f3600f2ea26493e52000233bac8";
const PLAYER = "0x5121b91616f6baf21d96ab8a09d92abb155f9c75cad54dd002cc6d082c7bf0";

const requests: string[] = [];
const guardianAnswer = vi.hoisted(() => ({ release: () => {} }));
vi.stubGlobal("fetch", async (input: string) => {
  requests.push(input);
  if (input === "/api/guardian") {
    // The guardian answers late, as it does on a cold load.
    await new Promise<void>((resolve) => (guardianAnswer.release = resolve));
    return Response.json(GUARDIAN);
  }
  if (input.startsWith("/api/directory")) return Response.json({ shards: [] });
  return new Response(null, { status: 401 });
});

import { identityClient, useIdentitySessionStore } from "@/hooks/context/identity-session";
import { useDirectory } from "./herald";

// The app's first session load keeps whatever session a test set.
vi.spyOn(identityClient, "getSession").mockImplementation(async () => useIdentitySessionStore.getState().session);

const seen: { pending: boolean[] } = { pending: [] };
const Probe = () => {
  const directory = useDirectory();
  useEffect(() => {
    seen.pending.push(directory.isPending);
  });
  return null;
};

afterEach(() => {
  requests.splice(0);
  seen.pending = [];
  useIdentitySessionStore.setState({ status: "anonymous", session: null });
});

/** Lets the read settle on real time, a few seconds at most, however loaded the machine running the test is. */
const settled = async () => {
  for (let waited = 0; waited < 5_000 && seen.pending.at(-1); waited += 25) {
    await act(async () => new Promise((resolve) => setTimeout(resolve, 25)));
  }
};

const mount = async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const root = createRoot(document.createElement("div"));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    ),
  );
  return () => act(async () => root.unmount());
};

it("reads a signed-in player's directory only once their account address is known, never the anonymous one first", async () => {
  useIdentitySessionStore.setState({
    status: "signed-in",
    session: {
      session: { id: "s", expiresAt: "2099-01-01T00:00:00.000Z", userId: "u" },
      user: { id: "u", realmsId: REALMS_ID, name: "NightTester", email: "a@example.invalid" },
    },
  });
  const unmount = await mount();
  try {
    await act(async () => {});
    expect(requests.filter((url) => url.startsWith("/api/directory"))).toEqual([]);
    expect(seen.pending.at(-1)).toBe(true);

    await act(async () => guardianAnswer.release());
    await settled();
    expect(requests.filter((url) => url.startsWith("/api/directory"))).toEqual([`/api/directory?player=${PLAYER}`]);
    expect(seen.pending.at(-1)).toBe(false);
  } finally {
    await unmount();
  }
});

it("waits for the session before any read, then reads the anonymous directory for nobody", async () => {
  useIdentitySessionStore.setState({ status: "loading", session: null });
  const unmount = await mount();
  try {
    await act(async () => {});
    expect(requests.filter((url) => url.startsWith("/api/directory"))).toEqual([]);
    await act(async () => useIdentitySessionStore.setState({ status: "anonymous", session: null }));
    await settled();
    expect(requests.filter((url) => url.startsWith("/api/directory"))).toEqual(["/api/directory"]);
  } finally {
    await unmount();
  }
});
