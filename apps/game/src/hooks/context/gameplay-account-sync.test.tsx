import { IdentityRequestError } from "@realms-world/identity";
import { act, useState } from "react";
import { Account, RpcError, hash, num } from "starknet";
import { createRoot } from "react-dom/client";
import { BrowserRouter, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const { identity, joinRealmsAccount, approveDeviceChange, provider } = vi.hoisted(() => ({
  identity: { session: { user: { realmsId: "0xabc" } } as { user: { realmsId: string } } | null },
  joinRealmsAccount: vi.fn(),
  approveDeviceChange: vi.fn(),
  provider: {
    getClassHashAt: vi.fn(async () => "0x3"),
    callContract: vi.fn(async () => ["0x1"]),
    getEvents: vi.fn(async () => ({ events: [] as { keys: string[] }[] })),
    waitForTransaction: vi.fn(async () => ({})),
  },
}));
vi.mock("@bibliothecadao/eternum", async () => {
  const account = await import("../../../../../packages/core/src/account/realms-account");
  joinRealmsAccount.mockImplementation(account.joinRealmsAccount);
  return { ...account, getOrCreateDeviceKey: () => ({ privateKey: "0x1", publicKey: "0x2" }), joinRealmsAccount };
});
vi.mock("@bibliothecadao/eternum/game-client", () => ({
  configureGameplayAccountSubmits: (account: unknown) => account,
}));
vi.mock("@/hooks/context/identity-session", () => ({
  identityClient: { approveDeviceChange },
  useIdentitySession: () => identity,
}));
vi.mock("@/runtime/world/shards", () => ({
  requireOpenShard: async (chainId: string) => ({
    chainId,
    rpcUrl: "https://rpc.test",
    accountClassHash: "0x3",
    guardianPublicKey: "0x9",
    l2GasBound: "0x47868c00",
  }),
}));
vi.mock("@/utils/shard-rpc-provider", () => ({ getShardRpcProvider: () => provider }));

import { useAccountStore } from "@/hooks/store/use-account-store";

import { isExplicitSpectateSession, resolveSpectateIntent } from "@/utils/spectator-session";

import { GameplayAccountSync } from "./gameplay-account-sync";
import { DoorwayScreen } from "@/ui/features/game-entry/doorway/doorway-screen";
import { doorwayView } from "@/ui/features/game-entry/doorway/doorway-view";

beforeEach(async () => {
  const account = await import("../../../../../packages/core/src/account/realms-account");
  joinRealmsAccount.mockImplementation(account.joinRealmsAccount);
  // A device change is numbered by the account's gameplay queue, which reads the nonce and sees inclusion through the
  // account itself.
  vi.spyOn(Account.prototype, "getNonce").mockResolvedValue("0x7");
  vi.spyOn(Account.prototype, "getTransactionStatus").mockResolvedValue({ finality_status: "PRE_CONFIRMED" } as never);
});

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
  vi.restoreAllMocks();
  provider.callContract.mockReset().mockResolvedValue(["0x1"]);
  provider.getEvents.mockReset().mockResolvedValue({ events: [] });
  joinRealmsAccount.mockClear();
  approveDeviceChange.mockReset();
  provider.getClassHashAt.mockReset().mockResolvedValue("0x3");
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
  ["account_not_secured", "Sign in with Discord or a code."],
  ["not_your_account", "This game account is not yours."],
  ["device_limit", "Signed in on 8 devices already."],
])("shows the recovery for guardian refusal %s", async (code, expected) => {
  provider.getClassHashAt.mockRejectedValueOnce({ code: 20 });
  approveDeviceChange.mockRejectedValueOnce(new IdentityRequestError(403, code));
  await openAt("/g/0xa1/1");
  expect(useAccountStore.getState().provisioningError).toBe(expected);
});

it("joins the account the moment a spectator presses Play, though the spectated map latched the intent", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.history.pushState({}, "", "/g/0xa1/1/map?spectate=true");
  const navigation: { to: ((path: string) => void) | null } = { to: null };
  const Navigator = () => {
    navigation.to = useNavigate();
    return null;
  };
  const root = createRoot(document.createElement("div"));
  await act(async () =>
    root.render(
      <BrowserRouter>
        <GameplayAccountSync>
          <Navigator />
        </GameplayAccountSync>
      </BrowserRouter>,
    ),
  );
  // The spectated map's boot latches the intent, as it does in the game.
  resolveSpectateIntent(window.location);
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  expect(joinRealmsAccount).not.toHaveBeenCalled();

  // The identity chip's Play leads to the doorway's play entry, in-app: no reload clears the latch.
  await act(async () => navigation.to!("/g/0xa1/1"));
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  expect(isExplicitSpectateSession()).toBe(false);
  expect(joinRealmsAccount).toHaveBeenCalledOnce();
  expect(joinRealmsAccount.mock.calls[0][0]).toMatchObject({ shard: { chainId: "0xa1" }, realmsId: "0xabc" });
  await act(async () => root.unmount());
});

it.each(["entry", "boot"] as const)(
  "shows recovery from the real refused join on the %s doorway and retries",
  async (source) => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    window.history.pushState({}, "", "/g/0xa1/1");
    provider.callContract.mockImplementation(async () => ["0x0"]);
    provider.getEvents.mockResolvedValue({
      events: Array.from({ length: 8 }, (_, i) => ({
        keys: [num.toHex(hash.starknetKeccak("DeviceAdded")), num.toHex(i + 100)],
      })),
    });
    approveDeviceChange.mockResolvedValue(["0x5", "0x6"]);
    const execute = vi
      .spyOn(Account.prototype, "execute")
      .mockRejectedValueOnce(
        new RpcError({ code: -32010, message: "Transaction refused" } as never, "starknet_addInvokeTransaction", {}),
      )
      .mockResolvedValue({ transaction_hash: "0x8" });
    const Recovery = ({ retry }: { retry: () => void }) => {
      const { account, provisioningError: accountError } = useAccountStore();
      if (account) return <p>Joined game</p>;
      const view =
        source === "entry"
          ? doorwayView({ source, phase: "account", audience: "player", signedIn: true, accountError })
          : doorwayView({ source, phase: "reconnect_required", audience: "player", accountError });
      return <DoorwayScreen view={view} realm={null} onRetry={retry} onSignIn={() => {}} />;
    };
    const Entry = () => {
      const [attempt, retry] = useState(0);
      return (
        <GameplayAccountSync key={attempt}>
          <Recovery retry={() => retry(attempt + 1)} />
        </GameplayAccountSync>
      );
    };
    const container = document.createElement("div");
    const root = createRoot(container);
    try {
      await act(async () =>
        root.render(
          <BrowserRouter>
            <Entry />
          </BrowserRouter>,
        ),
      );
      expect(container.textContent).toContain("Signed in on 8 devices already.");
      const link = container.querySelector<HTMLAnchorElement>('a[href="/profile/settings#devices"]');
      expect(link?.textContent).toBe("Remove a device");
      expect(link?.target).toBe("_blank");
      expect(container.textContent).not.toContain("Transaction refused");
      expect(execute).toHaveBeenCalledOnce();
      const retry = [...container.querySelectorAll("button")].find((b) => b.textContent === "Try again")!;
      expect(retry).toBeTruthy();
      provider.getEvents.mockResolvedValue({ events: [] });
      await act(async () => retry.click());
      expect(execute).toHaveBeenCalledTimes(2);
      expect(container.textContent).toBe("Joined game");
    } finally {
      await act(async () => root.unmount());
    }
  },
);
