import { IdentityRequestError } from "@realms-world/identity";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

const { identity, joinRealmsAccount } = vi.hoisted(() => ({
  identity: { session: { user: { realmsId: "0xabc" } } as { user: { realmsId: string } } | null },
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
  useIdentitySession: () => identity,
}));
vi.mock("@/runtime/world/shards", () => ({
  requireOpenShard: async (chainId: string) => ({ chainId, rpcUrl: "https://rpc.test", accountClassHash: "0x3" }),
}));
vi.mock("@/utils/cached-rpc-provider", () => ({ getCachedRpcProvider: () => ({}) }));

import { useAccountStore } from "@/hooks/store/use-account-store";

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
  identity.session = { user: { realmsId: "0xabc" } };
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

it("clears the gameplay signer when the identity session is absent", async () => {
  await openAt("/g/0xa1/1");
  expect(useAccountStore.getState().account).not.toBeNull();
  identity.session = null;
  await openAt("/");
  expect(useAccountStore.getState()).toMatchObject({ account: null, owner: null });
});

it.each([
  ["device_revoked", "device_removed"],
  ["account_not_secured", "Secure your account by signing in with Discord or an email code."],
  ["not_your_account", "This game account does not belong to your sign-in. Sign in to the account that owns it."],
  ["device_limit", "Your account has reached its device limit. Remove an old device from Account > Devices."],
])("shows the recovery for guardian refusal %s", async (code, expected) => {
  joinRealmsAccount.mockRejectedValueOnce(new IdentityRequestError(403, code));
  await openAt("/g/0xa1/1");
  expect(useAccountStore.getState().provisioningError).toBe(expected);
});
