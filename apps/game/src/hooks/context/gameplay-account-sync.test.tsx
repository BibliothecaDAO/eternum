import { act } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

const { joinRealmsAccount } = vi.hoisted(() => ({
  joinRealmsAccount: vi.fn(async (_input: { shard: { chainId: string }; realmsId: string }) => ({ address: "0xacc" })),
}));
vi.mock("@bibliothecadao/eternum", () => ({
  DeviceRemovedError: class extends Error {},
  getOrCreateDeviceKey: () => ({ privateKey: "0x1", publicKey: "0x2" }),
  joinRealmsAccount,
}));
vi.mock("@bibliothecadao/eternum/game-client", () => ({
  configureGameplayAccountSubmits: (account: unknown) => account,
}));
vi.mock("@/hooks/context/identity-session", () => ({
  identityClient: { approveDeviceChange: vi.fn() },
  useIdentitySession: () => ({ session: { user: { realmsId: "0xabc" } } }),
}));
vi.mock("@/runtime/world/shards", () => ({
  requireOpenShard: async (chainId: string) => ({ chainId, rpcUrl: "https://rpc.test", accountClassHash: "0x3" }),
}));
vi.mock("@/utils/cached-rpc-provider", () => ({ getCachedRpcProvider: () => ({}) }));

import { GameplayAccountSync } from "./gameplay-account-sync";

async function openAt(path: string) {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.history.pushState({}, "", path);
  const root = createRoot(document.createElement("div"));
  await act(async () =>
    root.render(
      <BrowserRouter>
        <GameplayAccountSync>{null}</GameplayAccountSync>
      </BrowserRouter>,
    ),
  );
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  await act(async () => root.unmount());
}

afterEach(() => {
  joinRealmsAccount.mockClear();
  window.history.pushState({}, "", "/");
});

it("joins no account for a game the player only spectates, or on the landing", async () => {
  await openAt("/g/0xa1/1?spectate=true");
  await openAt("/");
  expect(joinRealmsAccount).not.toHaveBeenCalled();
});

it("joins the game's shard when the player enters it to play", async () => {
  await openAt("/g/0xa1/1");
  expect(joinRealmsAccount).toHaveBeenCalledOnce();
  expect(joinRealmsAccount.mock.calls[0][0]).toMatchObject({ shard: { chainId: "0xa1" }, realmsId: "0xabc" });
});
