import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type WithdrawStep, WithdrawSheet } from "./withdraw-sheet";
import { SeasonPayoutRow } from "./season-payout";
import { withdrawalRefusal, withdrawalsCloseAt, withdrawStepOf } from "./withdrawal";
import {
  AUTOMATIC_LORDS_PAYOUT,
  LINK_WALLET_FOR_LORDS,
  PAYOUTS_PAUSED,
  WITHDRAWALS_CLOSED,
  paidWhenResumed,
} from "@/ui/design-system/kit/words";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const ADDRESS = "0x04a1d2c3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f99f3c";
const button = (word: string) =>
  [...host.querySelectorAll<HTMLButtonElement>("button")].find((each) => each.textContent?.startsWith(word));

describe("Withdraw", () => {
  const render = (
    over: Partial<{ wallet: string | null; refusal: string; step: WithdrawStep; amount: number }>,
    ways = { onAmount: vi.fn(), onWithdraw: vi.fn(), onLinkWallet: vi.fn() },
  ) => {
    act(() =>
      root.render(
        <WithdrawSheet
          held={1_240}
          wallet={over.wallet === undefined ? ADDRESS : over.wallet}
          linkWalletLine={LINK_WALLET_FOR_LORDS}
          refusal={over.refusal ?? null}
          step={over.step ?? { kind: "pick" }}
          amount={over.amount ?? 500}
          onClose={() => undefined}
          {...ways}
        />,
      ),
    );
    return ways;
  };

  it("sends the chosen amount, or all of it, to the linked wallet it shows, with no wait on the wallet", () => {
    const ways = render({});
    expect(host.textContent).toContain("0x04a1…9f3c");
    expect(host.innerHTML).not.toContain("Receives from");
    // The slider's Maximum takes all of it.
    act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Maximum 1,240"]')!.click());
    expect(ways.onAmount).toHaveBeenCalledWith(1_240);
    act(() => button("Withdraw")!.click());
    expect(ways.onWithdraw).toHaveBeenCalledTimes(1);
  });

  it("takes an amount typed where it shows, at most what the realm holds, and withdraws it from the keyboard", () => {
    const ways = render({});
    const amount = host.querySelector<HTMLInputElement>('input[aria-label="LORDS"]')!;
    expect(amount.value).toBe("500");
    expect(amount.inputMode).toBe("numeric");
    const type = (text: string) =>
      act(() => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(amount, text);
        amount.dispatchEvent(new Event("input", { bubbles: true }));
      });
    type("320");
    expect(ways.onAmount).toHaveBeenLastCalledWith(320);
    type("5000");
    expect(ways.onAmount).toHaveBeenLastCalledWith(1_240);
    // Enter in a form's field submits it: the amount's form withdraws.
    act(() => amount.form!.requestSubmit());
    expect(ways.onWithdraw).toHaveBeenCalledTimes(1);
  });

  it("sends a player with no wallet to link one", () => {
    const ways = render({ wallet: null });
    expect(button("Withdraw")).toBeUndefined();
    expect(host.textContent).toContain(LINK_WALLET_FOR_LORDS);
    act(() => button("Link wallet")!.click());
    expect(ways.onLinkWallet).toHaveBeenCalledTimes(1);
  });

  it("says why nothing can leave, and that a withdrawal recorded in a pause pays when payouts resume", () => {
    render({ refusal: "Payouts paused" });
    expect(host.textContent).toContain(PAYOUTS_PAUSED);
    expect(button("Withdraw")!.disabled).toBe(true);
    render({ step: { kind: "waiting", amount: 500 } });
    expect(host.textContent).toContain(paidWhenResumed("500"));
  });
});

describe("a withdrawal's rules", () => {
  // A season ending at 10,000 with a 7-day claim window: the shard stops withdrawals one hour before it ends.
  const closesAt = withdrawalsCloseAt(10_000, 7 * 86_400);
  const open = { closesAt, now: closesAt - 1, ledgerReadable: true, paused: false };

  it("closes withdrawals in the claim window's last hour, as the shard does", () => {
    expect(closesAt).toBe(10_000 + 7 * 86_400 - 3_600);
    expect(withdrawalRefusal(open)).toBeNull();
    expect(withdrawalRefusal({ ...open, now: closesAt })).toBe(WITHDRAWALS_CLOSED);
  });

  it("refuses while the ledger cannot be read or its payouts are paused, the season's close first", () => {
    expect(withdrawalRefusal({ ...open, ledgerReadable: false })).toContain("Could not load");
    expect(withdrawalRefusal({ ...open, paused: true })).toBe(PAYOUTS_PAUSED);
    expect(withdrawalRefusal({ ...open, now: closesAt, paused: true })).toContain("closed");
    // Facts not read yet refuse nothing.
    expect(withdrawalRefusal({ ...open, closesAt: undefined, paused: undefined })).toBeNull();
  });

  it("follows a withdrawal from the shard's outcome to its payment on Starknet", () => {
    const applied = { kind: "applied", amount: 500, claimId: "0x7f3a", fromBlock: 812_000 } as const;
    const none = { sending: null, outcome: null, paidIn: undefined, paused: false };
    expect(withdrawStepOf(none)).toEqual({ kind: "pick" });
    expect(withdrawStepOf({ ...none, sending: 500 })).toEqual({ kind: "sending", amount: 500 });
    expect(withdrawStepOf({ ...none, outcome: applied })).toEqual({ kind: "sending", amount: 500 });
    expect(withdrawStepOf({ ...none, outcome: applied, paused: true })).toEqual({ kind: "waiting", amount: 500 });
    expect(withdrawStepOf({ ...none, outcome: applied, paused: true, paidIn: "https://x/tx/0x1" })).toEqual({
      kind: "paid",
      amount: 500,
      transactionUrl: "https://x/tx/0x1",
    });
    // Not applied: back to the choice, with the game's reason. No answer: said so, with nothing to send again.
    expect(withdrawStepOf({ ...none, outcome: { kind: "not-applied", reason: "Insufficient LORDS" } })).toEqual({
      kind: "pick",
      notApplied: "Insufficient LORDS",
    });
    expect(withdrawStepOf({ ...none, outcome: { kind: "unknown", amount: 500 } })).toEqual({
      kind: "unknown",
      amount: 500,
    });
  });
});

describe("the realm's LORDS on the season-over card", () => {
  const show = (lords: number | undefined, linkWalletLine: string | null = null, onLinkWallet = vi.fn()) => {
    act(() =>
      root.render(<SeasonPayoutRow lords={lords} linkWalletLine={linkWalletLine} onLinkWallet={onLinkWallet} />),
    );
    return onLinkWallet;
  };

  it("shows the remaining LORDS and automatic payout without requiring a withdrawal", () => {
    show(1_240);
    expect(host.textContent).toContain("1,240");
    expect(host.textContent).toContain(AUTOMATIC_LORDS_PAYOUT);
    expect(host.querySelector("button")).toBeNull();
  });

  it("tells an account with no linked wallet to link one, with Link wallet, never the automatic payout", () => {
    const onLinkWallet = show(1_240, LINK_WALLET_FOR_LORDS);
    expect(host.textContent).toContain(LINK_WALLET_FOR_LORDS);
    expect(host.textContent).not.toContain("paid out automatically");
    act(() => button("Link wallet")!.click());
    expect(onLinkWallet).toHaveBeenCalledTimes(1);
  });

  it("shows nothing after the sweep consumes the balance, or while the balance is unknown", () => {
    show(0);
    expect(host.textContent).toBe("");
    show(undefined);
    expect(host.textContent).toBe("");
  });
});
