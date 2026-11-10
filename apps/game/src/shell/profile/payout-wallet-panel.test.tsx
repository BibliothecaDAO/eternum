import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

vi.hoisted(() => vi.stubGlobal("fetch", async () => new Response(null, { status: 401 })));

/** The wallet chunk's picker, standing in for a connected wallet that gives its SIWS proof. */
const PROOF = vi.hoisted(() => ({
  address: "0x4a1",
  chainId: "SN_MAIN" as const,
  domain: "realms.test",
  uri: "https://realms.test",
  signTypedData: async () => ["0x1", "0x2"],
}));
vi.mock("@/shell/value/wallet-actions", () => ({
  WalletPicker: ({ onProof }: { onProof: (proof: typeof PROOF) => void }) => (
    <button type="button" onClick={() => onProof(PROOF)}>
      Pick wallet
    </button>
  ),
}));

/** The app the client runs in; the web unless a test is about the iOS app. */
const app = vi.hoisted(() => ({ channel: "web" as "web" | "play" | "app-store" }));
vi.mock("@/runtime/distribution-channel", () => ({
  distributionChannel: () => app.channel,
  opensThirdPartySignIn: () => app.channel !== "app-store",
}));

import { identityClient, useIdentitySessionStore } from "@/hooks/context/identity-session";
import { IdentityRequestError } from "@realms-world/identity";

import { PayoutWalletPanel } from "./payout-wallet-panel";

const mounted: (() => Promise<void>)[] = [];

const mount = async (wallet: Parameters<typeof PayoutWalletPanel>[0]["wallet"], onChanged = () => {}) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<PayoutWalletPanel wallet={wallet} email="you@mail.test" onChanged={onChanged} />));
  mounted.push(async () => {
    await act(async () => root.unmount());
    container.remove();
  });
  return container;
};

const press = async (container: HTMLElement, word: string) =>
  act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === word)!.click());

const typeCode = async (container: HTMLElement, code: string) => {
  const input = container.querySelector("input")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, code);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

afterEach(async () => {
  for (const unmount of mounted.splice(0)) await unmount();
  vi.restoreAllMocks();
  app.channel = "web";
});

it("shows a linked wallet, the co-signer's hold on a replacement, and a player with none the two ways to one: make or link", async () => {
  const linked = await mount("0x04a1000000000000000000000000000000000000000000000000000000009c2e");
  expect(linked.textContent).toContain("0x04a1…9c2e");
  expect(linked.textContent).toContain("Prizes go here");
  // Linking is the wallet and the emailed code, and nothing after them.
  expect([...linked.querySelectorAll("ol > li")].map((step) => step.textContent)).toEqual(["Wallet", "Email code"]);
  // The hours come from the co-signer's own constant (packages/value-ledger/src/payout-wallet.ts).
  expect(linked.textContent).toContain("Replace or relink: the new wallet's first Frontier payout waits 24 hours");

  // No wallet: make one with a passkey, or link one; the old way out to Ready's sign-up is gone.
  useIdentitySessionStore.setState({
    status: "signed-in",
    session: {
      session: { id: "s", expiresAt: "2099-01-01T00:00:00.000Z", userId: "u" },
      user: { id: "u", realmsId: "0x7", name: "Ysolde", email: "you@mail.test" },
    },
  });
  vi.spyOn(identityClient, "readDefaultWallet").mockResolvedValue(null);
  const none = await mount(null);
  expect(none.textContent).toContain("Create my wallet");
  expect(none.textContent).toContain("I have a wallet");
  expect(none.textContent).toContain("Ready · Braavos · Controller");
  expect(none.textContent).not.toContain("I need one");
});

it("unlinks only with the emailed code, and names a wrong code", async () => {
  const sent = vi.spyOn(identityClient, "sendSignInCode").mockResolvedValue({ success: true, expires_at: 0 });
  const unlink = vi
    .spyOn(identityClient, "unlinkWallet")
    .mockRejectedValueOnce(new IdentityRequestError(400, "INVALID_OTP"))
    .mockResolvedValueOnce(undefined);
  const onChanged = vi.fn();
  const panel = await mount("0x4a1", onChanged);

  await press(panel, "Unlink");
  expect(sent).toHaveBeenCalledWith("you@mail.test");
  expect(panel.textContent).toContain("Code sent to you@mail.test");

  await typeCode(panel, "482913");
  expect(unlink).toHaveBeenLastCalledWith("482913");
  expect(panel.textContent).toContain("That code is not right.");
  expect(onChanged).not.toHaveBeenCalled();

  await typeCode(panel, "111111");
  expect(unlink).toHaveBeenLastCalledWith("111111");
  expect(onChanged).toHaveBeenCalledOnce();
});

it("links a wallet with its SIWS proof and the emailed code, through the services' identity client", async () => {
  vi.spyOn(identityClient, "sendSignInCode").mockResolvedValue({ success: true, expires_at: 0 });
  const link = vi.spyOn(identityClient, "linkWallet").mockResolvedValue("0x4a1");
  const onChanged = vi.fn();
  const panel = await mount(null, onChanged);

  await act(async () =>
    [...panel.querySelectorAll("button")].find((button) => button.textContent?.includes("I have a wallet"))!.click(),
  );
  await act(async () => (await vi.waitFor(() => screenButton(panel, "Pick wallet"))).click());
  expect(panel.textContent).toContain("Code sent to you@mail.test");
  await typeCode(panel, "123456");
  expect(link).toHaveBeenCalledWith({ ...PROOF, code: "123456" });
  expect(onChanged).toHaveBeenCalledOnce();
});

const screenButton = (container: HTMLElement, word: string) => {
  const button = [...container.querySelectorAll("button")].find((candidate) => candidate.textContent === word);
  if (!button) throw new Error(`No ${word} button yet`);
  return button;
};

it("offers no wallet to link inside the iOS app, where none can open: the Realms wallet is the way to one", async () => {
  app.channel = "app-store";
  useIdentitySessionStore.setState({
    status: "signed-in",
    session: {
      session: { id: "s", expiresAt: "2099-01-01T00:00:00.000Z", userId: "u" },
      user: { id: "u", realmsId: "0x7", name: "Ysolde", email: "you@mail.test" },
    },
  });
  vi.spyOn(identityClient, "readDefaultWallet").mockResolvedValue(null);
  const none = await mount(null);
  expect(none.textContent).toContain("Create my wallet");
  expect(none.textContent).not.toContain("I have a wallet");
});
