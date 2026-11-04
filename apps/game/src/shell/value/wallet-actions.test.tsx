import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/hooks/context/starknet-provider", async () => ({
  StarknetProvider: (await import("@/ui/modules/identity/test-wallet")).StandInStarknetProvider,
}));

import { installWallet } from "@/ui/modules/identity/test-wallet";
import { WalletPicker, WalletSign } from "./wallet-actions";
import { rememberOpened } from "@/ui/modules/identity/wallet-holder";

const LINKED = "0x04a1000000000000000000000000000000000000000000000000000000003e9f";
const OTHER = "0x0777000000000000000000000000000000000000000000000000000000000001";
const CALLS = [{ contractAddress: "0x10e5", entrypoint: "mint", calldata: [LINKED, "1000", "0"] }];

const unmounts: (() => Promise<void>)[] = [];

/** The send as a panel opens it once its button is pressed, under the development build's replayed effects. */
const openSend = async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const landed = vi.fn();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <StrictMode>
        <WalletSign owner={LINKED} calls={CALLS} onLanded={landed} />
      </StrictMode>,
    ),
  );
  unmounts.push(async () => {
    await act(async () => root.unmount());
    container.remove();
  });
  return { container, landed };
};

const buttonsOf = (container: HTMLElement) => [...container.querySelectorAll("button")].map((b) => b.textContent);
const press = (container: HTMLElement, word: string) =>
  act(async () => [...container.querySelectorAll("button")].find((b) => b.textContent?.includes(word))!.click());

/** Waits for what the send does on its own once it is opened. */
const settled = (check: () => void) =>
  vi.waitFor(async () => {
    await act(async () => {});
    check();
  });

afterEach(async () => {
  for (const unmount of unmounts.splice(0)) await unmount();
  vi.unstubAllGlobals();
  localStorage.clear();
});

it("prompts the wallet that holds the linked address at once, with one transaction and no wallet to pick", async () => {
  const ready = installWallet("argentX", { account: OTHER });
  const braavos = installWallet("braavos", { account: LINKED });
  const { container, landed } = await openSend();
  await settled(() => expect(landed).toHaveBeenCalledOnce());
  expect(braavos.transactions()).toEqual([
    [{ contract_address: "0x10e5", entry_point: "mint", calldata: [LINKED, "1000", "0"] }],
  ]);
  expect(ready.transactions()).toEqual([]);
  expect(ready.connections()).toEqual([]);
  expect(container.textContent).not.toContain("Ready");
  expect(container.textContent).not.toContain("Braavos");
});

it("refuses a wallet that answers with another account, naming the linked address, and signs nothing", async () => {
  // This browser last opened the linked wallet in Ready's extension, which has since changed account.
  rememberOpened(LINKED, "argentX");
  const ready = installWallet("argentX", { account: OTHER });
  const { container, landed } = await openSend();
  await settled(() => expect(container.textContent).toContain("Only 0x04a1…3e9f can sign this"));
  expect(ready.transactions()).toEqual([]);
  expect(landed).not.toHaveBeenCalled();
  expect(buttonsOf(container)).toEqual(["Try again"]);

  // The other account's visit does not unseat the linked wallet: the next send refuses it again, and offers no wallets.
  const next = await openSend();
  await settled(() => expect(next.container.textContent).toContain("Only 0x04a1…3e9f can sign this"));
  expect(buttonsOf(next.container)).toEqual(["Try again"]);
});

it("opens a locked wallet with one connection prompt and goes on into the transaction with no further click", async () => {
  rememberOpened(LINKED, "argentX");
  const ready = installWallet("argentX", { account: LINKED, locked: true });
  const { landed } = await openSend();
  await settled(() => expect(landed).toHaveBeenCalledOnce());
  expect(ready.connections()).toHaveLength(1);
  expect(ready.transactions()).toHaveLength(1);
});

it("asks which wallet only where this browser never opened it, and opens it unasked from then on", async () => {
  const ready = installWallet("argentX", { account: LINKED, locked: true });
  installWallet("braavos", { account: OTHER, locked: true });
  const first = await openSend();
  await settled(() => expect(first.container.textContent).toContain("Which wallet holds 0x04a1…3e9f?"));
  expect(ready.connections()).toEqual([]);
  await press(first.container, "Ready");
  await settled(() => expect(first.landed).toHaveBeenCalledOnce());

  installWallet("braavos", { account: OTHER, locked: true });
  const again = installWallet("argentX", { account: LINKED, locked: true });
  const second = await openSend();
  await settled(() => expect(second.landed).toHaveBeenCalledOnce());
  expect(again.transactions()).toHaveLength(1);
});

it("leaves one Try again when the wallet declines, which prompts the same wallet once more", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const ready = installWallet("argentX", { account: LINKED, approves: false });
  const { container, landed } = await openSend();
  await settled(() => expect(container.textContent).toContain("The wallet did not confirm it"));
  expect(ready.transactions()).toHaveLength(1);
  await press(container, "Try again");
  await settled(() => expect(ready.transactions()).toHaveLength(2));
  expect(landed).not.toHaveBeenCalled();
});

/** The link's picker as the payout wallet panel shows it, with every wallet this browser has. */
const openPicker = async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const proven = vi.fn();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<WalletPicker onProof={proven} />));
  unmounts.push(async () => {
    await act(async () => root.unmount());
    container.remove();
  });
  return { container, proven };
};

it("keeps every wallet open to try while one never answers, and says what to do", async () => {
  installWallet("argentX", { account: OTHER, answers: false });
  installWallet("braavos", { account: LINKED });
  const { container, proven } = await openPicker();
  await press(container, "Ready");
  await settled(() => expect(container.textContent).toContain("Opening…"));
  const braavos = [...container.querySelectorAll("button")].find((b) => b.textContent?.includes("Braavos"))!;
  expect(braavos.disabled).toBe(false);
  expect(container.textContent).toContain("Nothing opened? Choose again.");

  await press(container, "Braavos");
  await settled(() => expect(proven).toHaveBeenCalledOnce());
  expect(proven.mock.calls[0]?.[0]).toMatchObject({ address: LINKED });
  expect(container.textContent).not.toContain("Opening…");
});

it("leaves Try again live while the linked wallet never answers, and prompts it once more", async () => {
  rememberOpened(LINKED, "argentX");
  const ready = installWallet("argentX", { account: LINKED, answers: false });
  const { container, landed } = await openSend();
  await settled(() => expect(ready.connections()).toHaveLength(1));
  expect(container.textContent).toContain("Confirm in your wallet");
  const tryAgain = [...container.querySelectorAll("button")].find((b) => b.textContent === "Try again")!;
  expect(tryAgain.disabled).toBe(false);
  await press(container, "Try again");
  await settled(() => expect(ready.connections()).toHaveLength(2));
  expect(ready.transactions()).toEqual([]);
  expect(landed).not.toHaveBeenCalled();
});

it("confirms with the passkey when the paying wallet is the account's Realms wallet, opening no wallet", async () => {
  const { useIdentitySessionStore, identityClient } = await import("@/hooks/context/identity-session");
  const send = await import("@/ui/modules/identity/wallet-send");
  const prepared = { primaryType: "OutsideExecution" } as never;
  const prepare = vi.spyOn(send, "prepareDefaultWalletSend").mockResolvedValue(prepared);
  const sendFromDefault = vi.spyOn(send, "sendFromDefaultWallet").mockResolvedValue({ kind: "landed" });
  const realmsWallet = {
    address: LINKED,
    credentialId: "c",
    publicKeyX: "0x1",
    origin: "https://realms.test",
    rpId: "realms.test",
  };
  vi.spyOn(identityClient, "readDefaultWallet").mockResolvedValue(realmsWallet);
  useIdentitySessionStore.setState({
    status: "signed-in",
    session: {
      session: { id: "s", expiresAt: "2099-01-01T00:00:00.000Z", userId: "u" },
      user: { id: "u", realmsId: "0x9", name: "Ysolde", email: "you@mail.test", address: LINKED },
    },
  });
  const braavos = installWallet("braavos", { account: LINKED });
  try {
    const { container, landed } = await openSend();
    await settled(() => expect(buttonsOf(container)).toEqual(["Confirm with your passkey"]));
    expect(prepare).toHaveBeenCalledWith(CALLS);
    await press(container, "Confirm with your passkey");
    await settled(() => expect(landed).toHaveBeenCalledOnce());
    expect(sendFromDefault).toHaveBeenCalledWith(
      realmsWallet,
      prepared,
      JSON.stringify(CALLS),
      expect.anything(),
      expect.any(Function),
    );
    expect(braavos.connections()).toEqual([]);
  } finally {
    useIdentitySessionStore.setState({ status: "anonymous", session: null });
    vi.restoreAllMocks();
  }
});

it("on re-entry with a send still uncertain, sends nothing new, and ends it once the chain says it landed", async () => {
  const { useIdentitySessionStore, identityClient } = await import("@/hooks/context/identity-session");
  const send = await import("@/ui/modules/identity/wallet-send");
  const uncertain = await import("@/ui/modules/identity/uncertain-sends");
  const realmsWallet = {
    address: LINKED,
    credentialId: "c",
    publicKeyX: "0x1",
    origin: "https://realms.test",
    rpId: "realms.test",
  };
  vi.spyOn(identityClient, "readDefaultWallet").mockResolvedValue(realmsWallet);
  const prepare = vi.spyOn(send, "prepareDefaultWalletSend");
  const execute = vi.spyOn(identityClient, "executeDefaultWalletCall");
  const standing = vi
    .spyOn(uncertain, "standingOf")
    .mockResolvedValueOnce({ kind: "pending" })
    .mockResolvedValueOnce({ kind: "landed" });
  useIdentitySessionStore.setState({
    status: "signed-in",
    session: {
      session: { id: "s", expiresAt: "2099-01-01T00:00:00.000Z", userId: "u" },
      user: { id: "u", realmsId: "0x9", name: "Ysolde", email: "you@mail.test", address: LINKED },
    },
  });
  // The same send as this one was handed to the sponsor before the page closed; its answer was lost.
  uncertain.rememberUncertain({
    via: "passkey",
    owner: LINKED,
    calls: JSON.stringify(CALLS),
    execution: { message: { Nonce: "0x77", "Execute Before": 2_000 } } as never,
    ownerSignature: ["0x4"],
    hash: null,
    at: Date.now(),
  });
  try {
    const { container, landed } = await openSend();
    await settled(() => expect(container.textContent).toContain("Your last send is on its way"));
    expect(buttonsOf(container)).toEqual(["Check again", "Send it again"]);
    expect(prepare).not.toHaveBeenCalled();
    await press(container, "Check again");
    await settled(() => expect(landed).toHaveBeenCalledOnce());
    expect(standing).toHaveBeenCalledTimes(2);
    expect(execute).not.toHaveBeenCalled();
    expect(uncertain.uncertainSendOf(LINKED)).toBeUndefined();
  } finally {
    useIdentitySessionStore.setState({ status: "anonymous", session: null });
    vi.restoreAllMocks();
  }
});
