import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

vi.hoisted(() => vi.stubGlobal("fetch", async () => new Response(null, { status: 401 })));
const chain = vi.hoisted(() => ({ answers: [] as string[][], wait: vi.fn(async () => ({})) }));
vi.mock("@/runtime/l2-rpc", async (actual) => ({
  ...(await actual<typeof import("@/runtime/l2-rpc")>()),
  l2Provider: () => ({
    // The wallet's escape from the queue a test sets; every other read (the ledger's token, a balance) is zero.
    callContract: async ({ entrypoint }: { entrypoint: string }) =>
      entrypoint === "get_escape_and_status" ? (chain.answers.shift() ?? ["0x0", "0x0", "0x1", "0x0"]) : ["0x0", "0x0"],
    waitForTransaction: chain.wait,
  }),
}));
const signs = vi.hoisted(() => [] as { owner: string; calls: unknown[] }[]);
vi.mock("@/shell/value/wallet-actions", () => ({
  WalletSign: (props: { owner: string; calls: unknown[]; onLanded: () => void }) => {
    signs.push(props);
    return (
      <button type="button" onClick={props.onLanded}>
        Confirm with your passkey
      </button>
    );
  },
  WalletPicker: () => null,
}));
const passkeys = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/ui/modules/identity/passkey", () => ({
  createPasskey: passkeys.create,
  signWithPasskey: vi.fn(),
  PasskeyUnavailableError: class PasskeyUnavailableError extends Error {},
}));

import { identityClient, useIdentitySessionStore } from "@/hooks/context/identity-session";

import { PayoutWalletPanel } from "./payout-wallet-panel";
import { RealmsWalletRecovery } from "./realms-wallet-recovery";

const WALLET = {
  address: "0x6c3d70a2d9197da8e24ee33ec8e26b00faccfaafe0fa9bd0003c0eb11397b4f",
  credentialId: "old-passkey",
  publicKeyX: "0x1",
  origin: "https://realms.test",
  rpId: "realms.test",
};
/** get_escape_and_status's answer: ready_at, escape type (2: owner), new signer (some), then the status. */
const escapeAnswer = (status: number, readyAt = 1_900_000_000) => [
  `0x${readyAt.toString(16)}`,
  "0x2",
  "0x0",
  "0x4",
  "0x99",
  `0x${status.toString(16)}`,
];
const NO_ESCAPE = ["0x0", "0x0", "0x1", "0x0"];

const mounted: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const unmount of mounted.splice(0)) await unmount();
  signs.length = 0;
  chain.answers = [];
  vi.restoreAllMocks();
  useIdentitySessionStore.setState({ status: "anonymous", session: null });
});
const render = async (node: React.ReactNode) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(node));
  await act(async () => {});
  mounted.push(async () => {
    await act(async () => root.unmount());
    container.remove();
  });
  return container;
};
const press = (container: HTMLElement, word: string) =>
  act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === word)!.click());
const signedIn = (realmsId: string) =>
  useIdentitySessionStore.setState({
    status: "signed-in",
    session: {
      session: { id: "s", expiresAt: "2099-01-01T00:00:00.000Z", userId: "u" },
      user: { id: "u", realmsId, name: "Ysolde", email: "you@mail.test", address: WALLET.address },
    },
  });

it("offers the way in for a lost passkey while no recovery stands", async () => {
  chain.answers = [NO_ESCAPE];
  const onRecover = vi.fn();
  const view = await render(<RealmsWalletRecovery address={WALLET.address} onRecover={onRecover} />);
  await press(view, "Lost your passkey?");
  expect(onRecover).toHaveBeenCalledOnce();
});

it("shows a recovery under way with its day, and the owner's passkey cancels it", async () => {
  chain.answers = [escapeAnswer(1), NO_ESCAPE];
  const view = await render(<RealmsWalletRecovery address={WALLET.address} onRecover={vi.fn()} />);
  expect(view.textContent).toContain("Recovery under way: a new passkey takes over this wallet on");
  expect(view.textContent).not.toContain("Lost your passkey?");
  await press(view, "Not you? Cancel it");
  expect(signs.at(-1)).toMatchObject({
    owner: WALLET.address,
    calls: [{ contractAddress: WALLET.address, entrypoint: "cancel_escape", calldata: [] }],
  });
  await press(view, "Confirm with your passkey");
  await act(async () => {});
  // Read again from the chain: canceled, so the way in shows again.
  expect(view.textContent).toContain("Lost your passkey?");
});

it("recovers from the payout panel: a new passkey on this device, then the emailed code, then under way", async () => {
  signedIn("0x21");
  vi.spyOn(identityClient, "readDefaultWallet").mockResolvedValue(WALLET);
  vi.spyOn(identityClient, "sendSignInCode").mockResolvedValue({ success: true, expires_at: 0 });
  const start = vi.spyOn(identityClient, "startWalletRecovery").mockResolvedValue("0xescape");
  passkeys.create.mockResolvedValue({ credentialId: "new-passkey", publicKey: "spki" });
  chain.answers = [NO_ESCAPE];
  const changed = vi.fn();
  const panel = await render(<PayoutWalletPanel wallet={WALLET.address} email="you@mail.test" onChanged={changed} />);
  await press(panel, "Lost your passkey?");
  expect(panel.textContent).toContain("In 7 days it takes over your Realms wallet");
  await press(panel, "Make a new passkey");
  // The passkey that owns the wallet is excluded: a device still holding it is told, not overwritten.
  expect(passkeys.create).toHaveBeenCalledWith(
    { realmsId: "0x21", email: "you@mail.test", name: "Ysolde" },
    "old-passkey",
  );
  expect(panel.textContent).toContain("Code sent to you@mail.test");
  chain.answers = [escapeAnswer(1)];
  const input = panel.querySelector("input")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "123456");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {});
  expect(start).toHaveBeenCalledWith({ passkey: { credentialId: "new-passkey", publicKey: "spki" }, code: "123456" });
  expect(chain.wait).toHaveBeenCalledWith("0xescape", expect.anything());
  expect(changed).toHaveBeenCalledOnce();
  expect(panel.textContent).toContain("Recovery under way");
});

it("tells a device that still holds the passkey that there is nothing to recover", async () => {
  signedIn("0x22");
  vi.spyOn(identityClient, "readDefaultWallet").mockResolvedValue(WALLET);
  passkeys.create.mockRejectedValue(new DOMException("exists", "InvalidStateError"));
  chain.answers = [NO_ESCAPE];
  const panel = await render(<PayoutWalletPanel wallet={WALLET.address} email="you@mail.test" onChanged={vi.fn()} />);
  await press(panel, "Lost your passkey?");
  await press(panel, "Make a new passkey");
  expect(panel.textContent).toContain("This device still has your passkey: nothing to recover.");
});
