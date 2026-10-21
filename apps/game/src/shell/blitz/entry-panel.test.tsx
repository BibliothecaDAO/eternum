import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

// The ledger answers nothing here: a refetch after a send stays pending, never reaching a network.
vi.mock("@/runtime/l2-rpc", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/runtime/l2-rpc")>()),
  L2_LEDGER: "0x1ed9e7",
  l2Provider: () => ({ callContract: () => new Promise(() => {}) }),
}));
// The wallet chunk is the real one, over a wallet extension standing in the page: a press of a panel's button is all
// that stands between the player and the wallet's own prompt.
vi.mock("@/hooks/context/starknet-provider", async () => ({
  StarknetProvider: (await import("@/ui/modules/identity/test-wallet")).StandInStarknetProvider,
}));

import { installWallet } from "@/ui/modules/identity/test-wallet";

import type { DirectoryGame } from "../herald";
import { type EnvironmentLedger, environmentLedger, type SlotKey } from "../value/ledger";
import { type EntryTerms, entryTermsKey } from "./entry";
import { PaidEntry } from "./entry-panel";

const WEI = 10n ** 18n;
// The environment's ledger over a provider that never answers: what the panel shows is seeded.
const LEDGER = environmentLedger() as EnvironmentLedger;
const SLOT: SlotKey = { shard: "0x52", slotId: 7 };
const WALLET = "0x4a1";
const TERMS: EntryTerms = {
  prices: { seat: 500n * WEI, sword: 500n * WEI, shield: 500n * WEI },
  split: { protocolCutBps: 1000, chestLordsBps: 1000 },
  cancelled: false,
  close: Math.floor(Date.now() / 1000) + 3600,
  credits: { swords: 2, shields: 0 },
  registration: {
    registered: false,
    sword: false,
    shield: false,
    swordCredit: false,
    shieldCredit: false,
    paid: 0n,
    refundable: false,
    gameId: 0,
    registeredAt: 0,
  },
  lordsToken: "0x10e5",
  lords: 2_140n * WEI,
};
const unmounts: (() => Promise<void>)[] = [];

/** Where the panel's buttons lead. */
const Where = () => <output data-where>{useLocation().pathname}</output>;
const whereOf = (container: HTMLElement) => container.querySelector("[data-where]")!.textContent;

/** The ledger's terms for the wallet 0x4a1, and the wallet the entry is read for (null: none linked). */
const mount = async (terms: EntryTerms, owner: string | null = WALLET, game?: DirectoryGame) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  client.setQueryData(entryTermsKey(SLOT, owner ?? WALLET), terms);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <PaidEntry ledger={LEDGER} slot={SLOT} owner={owner} game={game} />
          <Where />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  unmounts.push(async () => {
    await act(async () => root.unmount());
    container.remove();
  });
  return container;
};

const press = (container: HTMLElement, text: string) =>
  act(async () =>
    [...container.querySelectorAll("button")].find((button) => button.textContent?.includes(text))!.click(),
  );

/** The wallet's own prompts: every transaction it was asked to sign, once the one under way has landed. */
const promptsOf = async (wallet: ReturnType<typeof installWallet>) => {
  await settled(() => expect(wallet.transactions()).toHaveLength(1));
  return wallet.transactions();
};

/** Waits for what the wallet chunk does on its own once a button is pressed. */
const settled = (check: () => void) =>
  vi.waitFor(async () => {
    await act(async () => {});
    check();
  });

const wordsOf = (panel: HTMLElement) => [...panel.querySelectorAll("button")].map((button) => button.textContent);

afterEach(async () => {
  for (const unmount of unmounts.splice(0)) await unmount();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  localStorage.clear();
});

it("pays the seat and the chosen flags from the payout wallet, a credit paying for the sword", async () => {
  const wallet = installWallet("argentX", { account: WALLET });
  const panel = await mount(TERMS);
  expect(panel.textContent).toContain("Credit ×2");
  await press(panel, "Sword");
  await press(panel, "Shield");
  expect(panel.textContent).toContain("1,000");
  // Where the 1,000 goes, as the preset splits it: 800 to the season pool, 100 to its chests, 100 to the treasury.
  const split = panel.querySelector('[aria-label^="Where this entry goes"]')!.textContent;
  expect(split).toBe("800100100");
  await press(panel, "Pay & join");
  // One press, one prompt of the linked wallet, and no wallet offered to pick.
  // register names no account: the ledger registers the one it links to the paying wallet.
  expect(await promptsOf(wallet)).toEqual([
    [
      expect.objectContaining({ entry_point: "approve", calldata: ["0x1ed9e7", String(1_000n * WEI), "0"] }),
      expect.objectContaining({
        contract_address: "0x1ed9e7",
        entry_point: "register",
        calldata: ["0x52", "7", "1", "1"],
      }),
    ],
  ]);
  expect(wordsOf(panel).join()).not.toContain("Ready");
});

it("names what is short, the registration, and the refund", async () => {
  expect((await mount({ ...TERMS, lords: 320n * WEI })).textContent).toContain("Need 180 more LORDS");
  // 0.1 LORDS short of the 500 seat is one more to find, never "Need 0 more".
  expect((await mount({ ...TERMS, lords: 500n * WEI - WEI / 10n })).textContent).toContain("Need 1 more LORDS");

  const seat = {
    registered: true,
    sword: true,
    shield: false,
    swordCredit: true,
    shieldCredit: false,
    paid: 500n * WEI,
    refundable: false,
    gameId: 0,
    registeredAt: 0,
  };
  const registered = (await mount({ ...TERMS, registration: seat })).textContent;
  expect(registered).toContain("Registered");
  expect(registered).toContain("Your seat is drawn when entry closes.");
  expect(registered).not.toContain("Seated");
  expect((await mount({ ...TERMS, registration: { ...seat, refundable: true } })).textContent).toContain("Not seated");
  const wallet = installWallet("argentX", { account: WALLET });
  const refund = await mount({ ...TERMS, registration: seat, cancelled: true });
  expect(refund.textContent).toContain("Sword credit");
  await press(refund, "Take refund");
  expect(await promptsOf(wallet)).toEqual([
    [expect.objectContaining({ entry_point: "refund", calldata: ["0x52", "7"] })],
  ]);

  expect((await mount(TERMS, null)).textContent).toContain("Entry is paid from your payout wallet");
});

it("reads Seated for the whole game, from the roster the shard froze, with the way to that game", async () => {
  // As the ledger holds it while the game runs: registered, no game bound yet (that comes with the game's result).
  const during = { ...TERMS.registration, registered: true, paid: 500n * WEI, gameId: 0 };
  const closed = { ...TERMS, close: Math.floor(Date.now() / 1000) - 600, registration: during };
  const game = { chainId: "0x52", game_id: 9, slotId: 7, status: "Live" } as DirectoryGame;

  const seated = await mount(closed, WALLET, game);
  expect(seated.textContent).toContain("Seated");
  expect(seated.textContent).not.toContain("Your seat is");
  await press(seated, "Your game");
  expect(whereOf(seated)).toBe("/blitz/game-0x52-9");

  // Between the close and the roster: registered, and no longer promising a draw "when entry closes".
  const drawing = (await mount(closed)).textContent;
  expect(drawing).toContain("Registered");
  expect(drawing).toContain("Entry has closed. Your seat is being drawn.");

  // Settled: the ledger names the game, which the lobby reads among the player's finished games: its own Results.
  const settled = await mount({ ...closed, registration: { ...during, gameId: 9 } }, WALLET, {
    ...game,
    status: "Settled",
  });
  expect(settled.textContent).toContain("Seated");
  await press(settled, "Results");
  expect(whereOf(settled)).toBe("/results/0x52-9");

  // A settled game the lobby could not read leaves no way to a game that is not this one.
  const unread = await mount({ ...closed, registration: { ...during, gameId: 9 } });
  expect([...unread.querySelectorAll("button")].map((button) => button.textContent)).toEqual([]);
});

it("lets a linked payout wallet pay at once: nothing waits on a link", async () => {
  const panel = await mount(TERMS);
  expect(panel.textContent).toContain("Pay & join");
  expect(panel.textContent).not.toContain("Linking");
});

it("reads a slot's entry and refund with the payout wallet that pays, signed by it", async () => {
  const seat = {
    registered: true,
    sword: false,
    shield: false,
    swordCredit: false,
    shieldCredit: false,
    paid: 500n * WEI,
    refundable: false,
    gameId: 0,
    registeredAt: 0,
  };
  const payout = installWallet("argentX", { account: WALLET });
  const refund = await mount({ ...TERMS, registration: seat, cancelled: true });
  await press(refund, "Take refund");
  expect(await promptsOf(payout)).toHaveLength(1);

  // A refund owed to a wallet the player has since replaced is read for that wallet, named on the plate, signed by it:
  // the payout wallet, still the one this browser's extension shares, is not prompted for it.
  const former = installWallet("braavos", { account: "0xb0b", locked: true });
  const replaced = await mount({ ...TERMS, registration: seat, cancelled: true }, "0xb0b");
  expect(replaced.textContent).toContain("0xb0b");
  await press(replaced, "Take refund");
  await settled(() => expect(replaced.textContent).toContain("Which wallet holds 0xb0b?"));
  expect(payout.transactions()).toHaveLength(1);
  await press(replaced, "Braavos");
  expect(await promptsOf(former)).toHaveLength(1);
});

it.each(["staging", "production"])(
  "mints the test token to the paying wallet in a %s build, from the token the ledger names",
  async (environment) => {
    vi.stubEnv("VITE_PUBLIC_ENVIRONMENT", environment);
    const short = await mount({ ...TERMS, lords: 320n * WEI });
    expect(short.textContent).toContain("Need 180 more LORDS");
    // The button names a test token: it never says LORDS.
    const mint = [...short.querySelectorAll("button")].find((button) => button.textContent?.startsWith("Mint"))!;
    expect(mint.textContent).toBe("Mint 1,000 test tokens");
    const wallet = installWallet("argentX", { account: WALLET });
    await press(short, "Mint 1,000 test tokens");
    // The test token's own public mint, on the token the ledger names, to the wallet that pays: 1,000 of it, asked of
    // that wallet by the one press.
    expect(await promptsOf(wallet)).toEqual([
      [{ contract_address: "0x10e5", entry_point: "mint", calldata: ["0x4a1", String(1_000n * WEI), "0"] }],
    ]);
  },
);
