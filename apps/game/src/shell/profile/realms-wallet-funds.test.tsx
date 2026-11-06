import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const WEI = 10n ** 18n;
/** Production's ledger token: Starknet's LORDS, the token a Realms wallet pays its network fee in. */
const LORDS = "0x124aeb495b947201f5fac96fd1138e326ad86195b98df6dec9009158a533b49";
/** Dev's ledger token: a test LORDS, which pays no fee. */
const TEST_LORDS = "0x9e57";
const ledger = vi.hoisted(() => ({ token: "", balances: new Map<string, bigint[]>() }));
const signs = vi.hoisted(() => [] as { owner: string; calls: unknown[] }[]);
/** What the review finds the wallet can send beside the fee of the send it built, when that is less than asked. */
const review = vi.hoisted(() => ({ spendable: null as bigint | null }));
vi.mock("@/shell/value/wallet-actions", () => ({
  WalletSign: (props: {
    owner: string;
    calls: unknown[];
    onLanded: () => void;
    onFeeShort?: (spendable: bigint) => void;
  }) => {
    signs.push(props);
    if (review.spendable !== null && props.onFeeShort) {
      const spendable = review.spendable;
      return (
        <button type="button" onClick={() => props.onFeeShort!(spendable)}>
          Send what fits instead
        </button>
      );
    }
    return (
      <button type="button" onClick={props.onLanded}>
        Confirm with your passkey
      </button>
    );
  },
  FeeLine: ({ fee }: { fee: { max: bigint } }) => <span>{`fee at most ${fee.max}`}</span>,
}));
vi.mock("../value/ledger", async (actual) => ({
  ...(await actual<typeof import("../value/ledger")>()),
  environmentLedger: () => ({
    lordsToken: async () => ledger.token,
    // Each read of a token answers its next balance, the last one standing.
    balanceOf: async (token: string) => {
      const next = ledger.balances.get(BigInt(token).toString(16)) ?? [0n];
      return next.length > 1 ? next.shift()! : next[0]!;
    },
  }),
}));
/** The paymaster's quote of a send, as the identity Worker answers it: its fee, about 7.88 LORDS, at most 9.12. */
const quote = vi.hoisted(() => vi.fn());
const FeeRoomShortError = vi.hoisted(
  () =>
    class FeeRoomShortError extends Error {
      constructor(readonly fee: { estimated: bigint; max: bigint }) {
        super("fee_room_short");
      }
    },
);
vi.mock("@/ui/modules/identity/wallet-send", () => ({ prepareDefaultWalletSend: quote, FeeRoomShortError }));
const FEE = { estimated: 7_880_000_000_000_000_000n, max: 9_120_000_000_000_000_000n };

import { RealmsWalletFunds } from "./realms-wallet-funds";

const ADDRESS = "0x6c3d70a2d9197da8e24ee33ec8e26b00faccfaafe0fa9bd0003c0eb11397b4f";
const EXCHANGE = "0x0213c67ed78bc280887234fe5ed5e77272465317978ae86c25a71531d9332a2d";

const holding = (token: string, balances: Record<string, bigint[]>) => {
  ledger.token = token;
  ledger.balances = new Map(Object.entries(balances).map(([at, held]) => [BigInt(at).toString(16), held]));
  quote.mockReset();
  quote.mockResolvedValue({ execution: {}, fee: FEE });
  review.spendable = null;
};

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

const button = (container: HTMLElement, word: string) =>
  [...container.querySelectorAll("button")].find((each) => each.textContent === word);

it("prices the send's fee as the form opens, offers the balance less its most as Max, and sends after the passkey", async () => {
  holding(LORDS, { [LORDS]: [1_700n * WEI + WEI / 2n, 700n * WEI] });
  const funds = await mount();
  expect(funds.textContent).toContain("1,700 LORDS");
  await press(funds, "Send");
  // Priced on a send of one wei to another address: nothing is signed.
  expect(quote).toHaveBeenCalledWith(
    ADDRESS,
    [{ contractAddress: LORDS, entrypoint: "transfer", calldata: ["0x1", "1", "0"] }],
    expect.anything(),
  );
  expect(funds.textContent).toContain(`fee at most ${FEE.max}`);
  const [to, amount] = [...funds.querySelectorAll("input")];
  expect(amount!.value).toBe("");
  await press(funds, "Max");
  // The balance less the most the fee may take, every decimal kept.
  expect(amount!.value).toBe("1691.38");
  await type(to!, "0xnot");
  expect(funds.textContent).toContain("Not a Starknet address");
  expect(button(funds, "Review")!.disabled).toBe(true);
  await type(to!, ADDRESS);
  expect(button(funds, "Review")!.disabled).toBe(true);
  await type(to!, EXCHANGE);
  // The whole balance leaves nothing for the fee.
  await type(amount!, "1700.5");
  expect(funds.textContent).toContain("Enter an amount up to what your wallet holds, less the fee");
  expect(button(funds, "Review")!.disabled).toBe(true);
  await type(amount!, "1000");
  await press(funds, "Review");
  expect(funds.textContent).toContain("Send 1000 LORDS to");
  expect(signs.at(-1)).toEqual({
    owner: ADDRESS,
    calls: [{ contractAddress: LORDS, entrypoint: "transfer", calldata: [EXCHANGE, String(1000n * WEI), "0"] }],
    onLanded: expect.any(Function),
    onFeeShort: expect.any(Function),
  });
  await press(funds, "Confirm with your passkey");
  await act(async () => {});
  expect(funds.textContent).toContain("Sent");
  expect(funds.textContent).toContain("700 LORDS");
});

it("sends what the wallet holds less the fee its review built when Max, taken on the form's quote, leaves too little", async () => {
  // Production, 2026-11-06: a first send of Max from 100 LORDS; the form's quote (with the deploy) asked at most
  // 35.09, the send built at review 35.15, so Max left 0.05 LORDS short of the fee.
  holding(LORDS, { [LORDS]: [100n * WEI] });
  quote.mockResolvedValue({ execution: {}, fee: { estimated: 0n, max: 35_087_893_000_000_000_000n } });
  const funds = await mount();
  await press(funds, "Send");
  const [to, amount] = [...funds.querySelectorAll("input")];
  await press(funds, "Max");
  expect(amount!.value).toBe("64.912107");
  await type(to!, EXCHANGE);
  review.spendable = 64_850_000_000_000_000_000n;
  await press(funds, "Review");
  await press(funds, "Send what fits instead");
  // The same send for what fits, prepared afresh; the review now confirms it.
  expect(funds.textContent).toContain("Send 64.85 LORDS to");
  expect(signs.at(-1)).toMatchObject({
    calls: [
      { contractAddress: LORDS, entrypoint: "transfer", calldata: [EXCHANGE, String((64_850n * WEI) / 1000n), "0"] },
    ],
  });
});

it("reads a wallet short of its quoted fee as priced, saying how much the fee needs", async () => {
  holding(LORDS, { [LORDS]: [5n * WEI] });
  quote.mockRejectedValue(new FeeRoomShortError(FEE));
  const funds = await mount();
  await press(funds, "Send");
  expect(funds.textContent).toContain("The network fee needs up to 9.12 LORDS. Your wallet holds 5.00.");
});

it("says how much the fee needs when the balance cannot cover it, and offers no Max or Review", async () => {
  holding(LORDS, { [LORDS]: [5n * WEI] });
  const funds = await mount();
  await press(funds, "Send");
  expect(funds.textContent).toContain("The network fee needs up to 9.12 LORDS. Your wallet holds 5.00.");
  expect(button(funds, "Max")).toBeUndefined();
  const [to, amount] = [...funds.querySelectorAll("input")];
  await type(to!, EXCHANGE);
  await type(amount!, "1");
  expect(button(funds, "Review")!.disabled).toBe(true);
});

it("on dev pays the fee in real LORDS beside the test LORDS it sends: Max is the whole test balance", async () => {
  holding(TEST_LORDS, { [TEST_LORDS]: [1_000n * WEI], [LORDS]: [20n * WEI] });
  const funds = await mount();
  await press(funds, "Send");
  const [, amount] = [...funds.querySelectorAll("input")];
  await press(funds, "Max");
  expect(amount!.value).toBe("1000");
});

it("on dev with no real LORDS says the fee needs some, without asking the paymaster", async () => {
  holding(TEST_LORDS, { [TEST_LORDS]: [1_000n * WEI], [LORDS]: [0n] });
  const funds = await mount();
  await press(funds, "Send");
  expect(funds.textContent).toContain("Sending pays a network fee in LORDS, and your wallet holds none.");
  expect(quote).not.toHaveBeenCalled();
  expect(button(funds, "Max")).toBeUndefined();
});

it("offers no Send while the wallet is empty", async () => {
  holding(LORDS, { [LORDS]: [0n] });
  const funds = await mount();
  expect(button(funds, "Send")!.disabled).toBe(true);
});
