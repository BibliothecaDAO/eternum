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
vi.mock("@/ui/modules/identity/wallet-actions", () => ({
  WalletPicker: ({ onProof }: { onProof: (proof: typeof PROOF) => void }) => (
    <button type="button" onClick={() => onProof(PROOF)}>
      Pick wallet
    </button>
  ),
}));

import { identityClient } from "@/hooks/context/identity-session";
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
});

it("shows a linked wallet as receiving at once, with no wait, and a player with none the two ways to one", async () => {
  const linked = await mount("0x04a1000000000000000000000000000000000000000000000000000000009c2e");
  expect(linked.textContent).toContain("0x04a1…9c2e");
  expect(linked.textContent).toContain("Prizes go here");
  // Linking is the wallet and the emailed code, and nothing after them: no hold, no time to receive from.
  expect([...linked.querySelectorAll("ol > li")].map((step) => step.textContent)).toEqual(["Wallet", "Email code"]);
  expect(linked.textContent).not.toMatch(/hold|Receives from/i);

  const none = await mount(null);
  expect(none.textContent).toContain("I have a wallet");
  expect(none.textContent).toContain("Ready · Braavos · Controller");
  expect(none.textContent).toContain("I need one");
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

  // Eight digits spend the code; the six of an older code spend nothing.
  await typeCode(panel, "482913");
  expect(unlink).not.toHaveBeenCalled();
  await typeCode(panel, "48291357");
  expect(unlink).toHaveBeenLastCalledWith("48291357");
  expect(panel.textContent).toContain("That code is not right.");
  expect(onChanged).not.toHaveBeenCalled();

  await typeCode(panel, "11111111");
  expect(unlink).toHaveBeenLastCalledWith("11111111");
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
  await typeCode(panel, "12345678");
  expect(link).toHaveBeenCalledWith({ ...PROOF, code: "12345678" });
  expect(onChanged).toHaveBeenCalledOnce();
});

const screenButton = (container: HTMLElement, word: string) => {
  const button = [...container.querySelectorAll("button")].find((candidate) => candidate.textContent === word);
  if (!button) throw new Error(`No ${word} button yet`);
  return button;
};
