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

/** The account's Realms wallet as the paying wallet, signed in: its passkey signs, and its fee is paid in LORDS. */
const withRealmsWallet = async () => {
  const { useIdentitySessionStore, identityClient } = await import("@/hooks/context/identity-session");
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
  return {
    realmsWallet,
    signOut: () => useIdentitySessionStore.setState({ status: "anonymous", session: null }),
  };
};
const LORDS = 10n ** 18n;
/** A prepared send paying its own fee: about 7.88 LORDS, at most `max`. */
const preparedPaying = (max: bigint, id = "first") => ({
  execution: { primaryType: "OutsideExecution", id } as never,
  fee: { estimated: 7_880_650_978_512_778_123n, max },
});

it("shows the Realms wallet's fee in LORDS before its passkey confirms, and opens no wallet", async () => {
  const send = await import("@/ui/modules/identity/wallet-send");
  const prepared = preparedPaying(9_120_000_000_000_000_000n);
  const prepare = vi.spyOn(send, "prepareDefaultWalletSend").mockResolvedValue(prepared);
  const sendFromDefault = vi.spyOn(send, "sendFromDefaultWallet").mockResolvedValue({ kind: "landed" });
  const { realmsWallet, signOut } = await withRealmsWallet();
  const braavos = installWallet("braavos", { account: LINKED });
  try {
    const { container, landed } = await openSend();
    await settled(() => expect(buttonsOf(container)).toEqual(["Confirm with your passkey"]));
    expect(container.textContent).toContain("Network fee about 7.89 LORDS, at most 9.12");
    expect(prepare).toHaveBeenCalledWith(CALLS);
    await press(container, "Confirm with your passkey");
    await settled(() => expect(landed).toHaveBeenCalledOnce());
    expect(sendFromDefault).toHaveBeenCalledWith(
      realmsWallet,
      prepared.execution,
      JSON.stringify(CALLS),
      expect.anything(),
      expect.any(Function),
    );
    expect(braavos.connections()).toEqual([]);
  } finally {
    signOut();
    vi.restoreAllMocks();
  }
});

it("signs nothing whose fee rose past the one shown: a stale send is priced again and its new fee shown first", async () => {
  const send = await import("@/ui/modules/identity/wallet-send");
  const shown = preparedPaying(9n * LORDS, "shown");
  const higher = preparedPaying(10n * LORDS, "higher");
  const now = Date.now();
  // Priced at 9 LORDS now; past the minute a prepared send keeps, the network asks 10.
  vi.spyOn(send, "prepareDefaultWalletSend").mockImplementation(async () =>
    Date.now() > now + 60_000 ? higher : shown,
  );
  const sendFromDefault = vi.spyOn(send, "sendFromDefaultWallet").mockResolvedValue({ kind: "landed" });
  const { signOut } = await withRealmsWallet();
  try {
    const { container, landed } = await openSend();
    await settled(() => expect(container.textContent).toContain("at most 9.00"));
    // The player comes back two minutes later: the prepared send is stale, and the network fee went up meanwhile.
    vi.spyOn(Date, "now").mockReturnValue(now + 120_000);
    await press(container, "Confirm with your passkey");
    await settled(() =>
      expect(container.textContent).toContain("The network fee went up. Check it and confirm again."),
    );
    expect(container.textContent).toContain("at most 10.00");
    expect(sendFromDefault).not.toHaveBeenCalled();
    // Confirmed again, the fee now shown: it sends the execution priced at that fee.
    await press(container, "Confirm with your passkey");
    await settled(() => expect(landed).toHaveBeenCalledOnce());
    expect(sendFromDefault).toHaveBeenCalledWith(
      expect.anything(),
      higher.execution,
      JSON.stringify(CALLS),
      expect.anything(),
      expect.any(Function),
    );
  } finally {
    signOut();
    vi.restoreAllMocks();
  }
});

it("shows why a send could not be prepared (too little LORDS for its fee), and prices it again on Try again", async () => {
  const send = await import("@/ui/modules/identity/wallet-send");
  const { IdentityRequestError } = await import("@realms-world/identity");
  // Refused while the wallet is short of LORDS for the fee; priced once the player has added some.
  let short = true;
  vi.spyOn(send, "prepareDefaultWalletSend").mockImplementation(async () => {
    if (short) throw new IdentityRequestError(502, "PAYMASTER_REFUSED");
    return preparedPaying(9n * LORDS);
  });
  const sendFromDefault = vi.spyOn(send, "sendFromDefaultWallet");
  const { signOut } = await withRealmsWallet();
  try {
    const { container } = await openSend();
    await settled(() => expect(buttonsOf(container)).toEqual(["Try again"]));
    expect(container.textContent).toContain("Check your wallet holds enough LORDS for it and its fee.");
    short = false;
    await press(container, "Try again");
    await settled(() => expect(buttonsOf(container)).toEqual(["Confirm with your passkey"]));
    expect(container.textContent).toContain("at most 9.00");
    expect(sendFromDefault).not.toHaveBeenCalled();
  } finally {
    signOut();
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
  // The same send as this one was handed to the paymaster before the page closed; its answer was lost.
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

it("on re-entry with a passkey still asked when its panel closed, offers only Check again: nothing signed to send again", async () => {
  const send = await import("@/ui/modules/identity/wallet-send");
  const uncertain = await import("@/ui/modules/identity/uncertain-sends");
  const { signOut } = await withRealmsWallet();
  const prepare = vi.spyOn(send, "prepareDefaultWalletSend");
  vi.spyOn(uncertain, "standingOf").mockResolvedValue({ kind: "pending" });
  uncertain.rememberUncertain({
    via: "passkey",
    owner: LINKED,
    calls: JSON.stringify(CALLS),
    execution: { message: { Nonce: "0x77", "Execute Before": 2_000 } } as never,
    ownerSignature: null,
    hash: null,
    at: Date.now(),
  });
  try {
    const { container, landed } = await openSend();
    await settled(() => expect(container.textContent).toContain("Your last send is on its way"));
    expect(buttonsOf(container)).toEqual(["Check again"]);
    expect(prepare).not.toHaveBeenCalled();
    expect(landed).not.toHaveBeenCalled();
  } finally {
    signOut();
    vi.restoreAllMocks();
  }
});

it("on re-entry with a connected wallet's send it never heard back from, opens no wallet and offers no new transfer", async () => {
  const uncertain = await import("@/ui/modules/identity/uncertain-sends");
  vi.spyOn(uncertain, "standingOf").mockResolvedValue({ kind: "pending" });
  const braavos = installWallet("braavos", { account: LINKED });
  // Accepted by the wallet a day ago, the page closed before its hash was kept.
  uncertain.rememberUncertain({
    via: "wallet",
    owner: LINKED,
    calls: JSON.stringify(CALLS),
    hash: null,
    at: Date.now() - 86_400_000,
  });
  try {
    const { container, landed } = await openSend();
    await settled(() => expect(container.textContent).toContain("Your last send is on its way"));
    // Only asking the chain again: no release, no wallet, nothing new sent while the record stands.
    expect(buttonsOf(container)).toEqual(["Check again"]);
    await press(container, "Check again");
    await settled(() => expect(buttonsOf(container)).toEqual(["Check again"]));
    expect(braavos.connections()).toEqual([]);
    expect(braavos.transactions()).toEqual([]);
    expect(landed).not.toHaveBeenCalled();
    expect(uncertain.uncertainSendOf(LINKED)).toBeDefined();
  } finally {
    uncertain.forgetUncertain(LINKED);
    vi.restoreAllMocks();
  }
});
