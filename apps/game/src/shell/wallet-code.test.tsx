import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, it, vi } from "vitest";
import { constants } from "starknet";

const calls = vi.hoisted(() => ({ link: vi.fn(), unlink: vi.fn(), send: vi.fn(), refresh: vi.fn() }));
const session = {
  user: {
    id: "user",
    realmsId: "0x2",
    name: "Player",
    email: "player@realms.test",
    emailVerified: true,
    address: "0x123",
    image: null,
  },
};
vi.mock("@/hooks/context/identity-session", () => ({
  identityClient: {
    linkWallet: calls.link,
    unlinkWallet: calls.unlink,
    sendSignInCode: calls.send,
    listSignInProviders: async () => ["discord"],
  },
  useIdentitySession: () => ({ status: "signed-in", session }),
  useIdentitySessionStore: (select: (state: { refresh: typeof calls.refresh }) => unknown) =>
    select({ refresh: calls.refresh }),
  identityUsername: () => "Player",
  signOutIdentitySession: vi.fn(),
}));
vi.mock("@/audio/hooks/useUISound", () => ({ useUISound: () => () => undefined }));
vi.mock("@/hooks/context/starknet-provider", () => ({
  StarknetProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@starknet-react/core", () => ({
  useProvider: () => ({ provider: { getClassHashAt: async () => "0x456" } }),
  useDisconnect: () => ({ disconnectAsync: vi.fn() }),
  useConnect: () => ({
    connectAsync: vi.fn(),
    connectors: [
      {
        id: "test",
        name: "Test wallet",
        chainId: async () => BigInt(constants.StarknetChainId.SN_MAIN),
        account: async () => ({ address: "0x123", signMessage: async () => ["0x1", "0x2"] }),
      },
    ],
  }),
}));
vi.mock("@/hooks/store/use-account-store", () => ({
  useAccountStore: (select: (state: { account: undefined }) => unknown) => select({ account: undefined }),
}));
vi.mock("@/ui/modules/settings/notification-settings", () => ({ NotificationSettings: () => null }));
vi.mock("@/services/identity/player-portrait", () => ({
  playerPortraitUrl: () => "/portrait",
  portraitUrl: () => "/portrait",
}));
vi.mock("./devices", () => ({ DevicesPanel: () => null }));
vi.mock("./account-state", () => ({ AccountStatePrompt: () => null }));
vi.mock("./name-claim", () => ({ NameClaim: () => null }));
vi.mock("./sign-in/sign-in-route", () => ({ useRequestSignIn: () => vi.fn() }));
import { AccountPage } from "./account";
import { WalletLink } from "@/ui/modules/identity/wallet-actions";

beforeEach(() => {
  vi.clearAllMocks();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  calls.send.mockResolvedValue({ success: true });
  calls.link.mockResolvedValue("0x123");
  calls.unlink.mockResolvedValue(undefined);
});
it("passes the entered email code with the wallet's SIWS proof", async () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () => root.render(<WalletLink code="123456" />));
    await act(async () => container.querySelector<HTMLButtonElement>("button")!.click());
    expect(calls.link).toHaveBeenCalledWith(
      expect.objectContaining({ code: "123456", chainId: "SN_MAIN", signTypedData: expect.any(Function) }),
    );
  } finally {
    await act(async () => root.unmount());
  }
});
it("sends the code to the signed-in email and cannot unlink before six digits are entered", async () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () => root.render(<AccountPage />));
    const buttons = () => [...container.querySelectorAll<HTMLButtonElement>("button")];
    const unlink = buttons().find((button) => button.textContent === "Unlink")!;
    expect(unlink.disabled).toBe(true);
    await act(async () =>
      buttons()
        .find((button) => button.textContent === "Send email code")!
        .click(),
    );
    expect(calls.send).toHaveBeenCalledWith(session.user.email);
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Email code"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "654321");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => unlink.click());
    expect(calls.unlink).toHaveBeenCalledWith("654321");
  } finally {
    await act(async () => root.unmount());
  }
});
