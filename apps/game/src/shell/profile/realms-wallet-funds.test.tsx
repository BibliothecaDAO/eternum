import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const WEI = 10n ** 18n;
const TOKEN = "0x124aeb";
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
}));
const balances = vi.hoisted(() => ({ next: [] as bigint[] }));
vi.mock("../value/ledger", async (actual) => ({
  ...(await actual<typeof import("../value/ledger")>()),
  environmentLedger: () => ({
    lordsToken: async () => TOKEN,
    balanceOf: async () => balances.next.shift() ?? 0n,
  }),
}));

import { RealmsWalletFunds } from "./realms-wallet-funds";

const ADDRESS = "0x6c3d70a2d9197da8e24ee33ec8e26b00faccfaafe0fa9bd0003c0eb11397b4f";
const EXCHANGE = "0x0213c67ed78bc280887234fe5ed5e77272465317978ae86c25a71531d9332a2d";

const mounted: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const unmount of mounted.splice(0)) await unmount();
  signs.length = 0;
});

const mount = async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<RealmsWalletFunds address={ADDRESS} />));
  await act(async () => {});
  mounted.push(async () => {
    await act(async () => root.unmount());
    container.remove();
  });
  return container;
};
const press = (container: HTMLElement, word: string) =>
  act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === word)!.click());
const type = (input: HTMLInputElement, value: string) =>
  act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });

it("shows the wallet's LORDS and sends what the player asks to the address they give, after the passkey", async () => {
  balances.next = [1_700n * WEI + WEI / 2n, 700n * WEI];
  const funds = await mount();
  expect(funds.textContent).toContain("1,700 LORDS");
  await press(funds, "Send");
  const [to, amount] = [...funds.querySelectorAll("input")];
  // The whole balance is offered, every decimal kept.
  expect(amount!.value).toBe("1700.5");
  const review = () => [...funds.querySelectorAll("button")].find((button) => button.textContent === "Review")!;
  await type(to!, "0xnot");
  expect(funds.textContent).toContain("Not a Starknet address");
  expect(review().disabled).toBe(true);
  await type(to!, ADDRESS);
  expect(review().disabled).toBe(true);
  await type(to!, EXCHANGE);
  await type(amount!, "1800");
  expect(funds.textContent).toContain("Enter an amount up to what your wallet holds");
  await type(amount!, "1000");
  await press(funds, "Review");
  expect(funds.textContent).toContain("Send 1000 LORDS to");
  expect(signs.at(-1)).toEqual({
    owner: ADDRESS,
    calls: [{ contractAddress: TOKEN, entrypoint: "transfer", calldata: [EXCHANGE, String(1000n * WEI), "0"] }],
    onLanded: expect.any(Function),
  });
  await press(funds, "Confirm with your passkey");
  await act(async () => {});
  expect(funds.textContent).toContain("Sent");
  expect(funds.textContent).toContain("700 LORDS");
});

it("offers no Send while the wallet is empty", async () => {
  balances.next = [0n];
  const funds = await mount();
  expect([...funds.querySelectorAll("button")].find((button) => button.textContent === "Send")!.disabled).toBe(true);
});
