import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import type { Call } from "starknet";
import { afterEach, expect, it, vi } from "vitest";

const signed = vi.hoisted(() => ({ calls: [] as Call[][] }));
vi.mock("@/ui/modules/identity/wallet-actions", () => ({
  WalletSign: ({ calls, onSent }: { calls: Call[]; onSent: (hash: string) => void }) => (
    <button
      type="button"
      onClick={() => {
        signed.calls.push(calls);
        onSent("0xtx");
      }}
    >
      Sign
    </button>
  ),
}));

import type { PayoutWallet } from "@/hooks/context/payout-wallet";

import { type EntryTerms, entryTermsKey, type SlotLedger } from "./entry";
import { PaidEntry } from "./entry-panel";

const WEI = 10n ** 18n;
const LEDGER: SlotLedger = { address: "0x1ed9e7", key: { shard: "0x52", gameId: 7 } };
const WALLET: PayoutWallet = { status: "ready", address: "0x4a1" };
const TERMS: EntryTerms = {
  prices: { seat: 500n * WEI, sword: 500n * WEI, shield: 500n * WEI },
  cancelled: false,
  credits: { swords: 2, shields: 0 },
  registration: { registered: false, sword: false, shield: false, swordCredit: false, shieldCredit: false, paid: 0n },
  lords: 2_140n * WEI,
  strk: 10n ** 17n,
};
const unmounts: (() => Promise<void>)[] = [];

const mount = async (terms: EntryTerms, wallet: PayoutWallet = WALLET) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  client.setQueryData(entryTermsKey(LEDGER, "0x4a1"), terms);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <PaidEntry ledger={LEDGER} wallet={wallet} />
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

afterEach(async () => {
  for (const unmount of unmounts.splice(0)) await unmount();
  signed.calls = [];
});

it("pays the seat and the chosen flags from the payout wallet, a credit paying for the sword", async () => {
  const panel = await mount(TERMS);
  expect(panel.textContent).toContain("Credit ×2");
  await press(panel, "Sword");
  await press(panel, "Shield");
  expect(panel.textContent).toContain("1,000");
  await press(panel, "Pay & join");
  await press(panel, "Sign");
  expect(signed.calls).toEqual([
    [
      expect.objectContaining({ entrypoint: "approve", calldata: ["0x1ed9e7", String(1_000n * WEI), "0"] }),
      expect.objectContaining({
        contractAddress: "0x1ed9e7",
        entrypoint: "register",
        calldata: ["0x52", "7", "1", "1"],
      }),
    ],
  ]);
});

it("names what is short, the missing STRK, the seat, and the refund", async () => {
  expect((await mount({ ...TERMS, lords: 320n * WEI })).textContent).toContain("Need 180 more LORDS");
  const noStrk = await mount({ ...TERMS, strk: 0n });
  expect(noStrk.textContent).toContain("No STRK for the fee");
  expect(noStrk.querySelector("a")?.getAttribute("href")).toBe("https://app.avnu.fi/en");

  const seat = {
    registered: true,
    sword: true,
    shield: false,
    swordCredit: true,
    shieldCredit: false,
    paid: 500n * WEI,
  };
  expect((await mount({ ...TERMS, registration: seat })).textContent).toContain("Seated");
  const refund = await mount({ ...TERMS, registration: seat, cancelled: true });
  expect(refund.textContent).toContain("Sword credit");
  await press(refund, "Take refund");
  await press(refund, "Sign");
  expect(signed.calls).toEqual([[expect.objectContaining({ entrypoint: "refund", calldata: ["0x52", "7"] })]]);

  expect((await mount(TERMS, { status: "no_wallet" })).textContent).toContain("Entry is paid from your payout wallet");
});
