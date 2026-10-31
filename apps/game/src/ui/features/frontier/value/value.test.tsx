import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { planRealmLabor, seasonStrip } from "./realm-labor";
import { type WithdrawStep, WithdrawSheet } from "./withdraw-sheet";
import { LordsPurse } from "./lords-purse";
import { SeasonPayoutRow } from "./season-payout";
import { withdrawalRefusal, withdrawalsCloseAt, withdrawStepOf } from "./withdrawal";

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
    expect(host.textContent).toContain("Link a wallet to receive your LORDS");
    act(() => button("Link wallet")!.click());
    expect(ways.onLinkWallet).toHaveBeenCalledTimes(1);
  });

  it("says why nothing can leave, and that a withdrawal recorded in a pause pays when payouts resume", () => {
    render({ refusal: "Payouts paused" });
    expect(host.textContent).toContain("Payouts paused");
    expect(button("Withdraw")!.disabled).toBe(true);
    render({ step: { kind: "waiting", amount: 500 } });
    expect(host.textContent).toContain("Payouts paused: 500 waiting");
  });
});

describe("a withdrawal's rules", () => {
  // A season ending at 10,000 with a 7-day claim window: the shard stops withdrawals one hour before it ends.
  const closesAt = withdrawalsCloseAt(10_000, 7 * 86_400);
  const open = { closesAt, now: closesAt - 1, ledgerReadable: true, paused: false };

  it("closes withdrawals in the claim window's last hour, as the shard does", () => {
    expect(closesAt).toBe(10_000 + 7 * 86_400 - 3_600);
    expect(withdrawalRefusal(open)).toBeNull();
    expect(withdrawalRefusal({ ...open, now: closesAt })).toBe("Withdrawals have closed");
  });

  it("refuses while the ledger cannot be read or its payouts are paused, the season's close first", () => {
    expect(withdrawalRefusal({ ...open, ledgerReadable: false })).toContain("cannot be read");
    expect(withdrawalRefusal({ ...open, paused: true })).toBe("Payouts paused");
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
    expect(host.textContent).toContain("LORDS are paid out automatically at season end");
    expect(host.querySelector("button")).toBeNull();
  });

  it("tells an account with no linked wallet to link one, with Link wallet, never the automatic payout", () => {
    const onLinkWallet = show(1_240, "Link a wallet to receive your LORDS");
    expect(host.textContent).toContain("Link a wallet to receive your LORDS");
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

it("marks a phone's purse while the account has no linked wallet, its name saying why; plain with one", () => {
  const line = "Link a wallet to receive your LORDS";
  act(() => root.render(<LordsPurse lords={1_240} linkWalletLine={line} onOpen={() => undefined} />));
  const purse = host.querySelector("button")!;
  expect(purse.getAttribute("aria-label")).toBe(`LORDS 1,240. ${line}`);
  expect(purse.querySelector('[data-icon="warning"]')).not.toBeNull();
  act(() => root.render(<LordsPurse lords={1_240} onOpen={() => undefined} />));
  expect(host.querySelector("button")!.getAttribute("aria-label")).toBe("LORDS 1,240");
  expect(host.querySelector('[data-icon="warning"]')).toBeNull();
});

describe("the settled Realm's labor", () => {
  it("gives only an unclaimed held home one daily claim, limited by its store", () => {
    expect(
      planRealmLabor({ eligible: true, claimed: false, amount: 1000, essence: 0, held: 17600, limit: 18000 }),
    ).toEqual({
      eligible: true,
      claimed: false,
      total: 1000,
      fits: 400,
      essence: 0,
      claimable: true,
    });
    expect(
      planRealmLabor({ eligible: false, claimed: false, amount: 1000, essence: 0, held: 0, limit: 18000 }).total,
    ).toBe(0);
    expect(
      planRealmLabor({ eligible: true, claimed: true, amount: 1000, essence: 0, held: 0, limit: 18000 }).total,
    ).toBe(0);
  });
  it("shows the days around today on the strip: five before, today and the next, kept inside the season", () => {
    const strip = (today: number, last: number | undefined, founded = 0, claimedToday = false) =>
      seasonStrip({ today, last, founded, claimed: (index) => index % 2 === 0, claimedToday }).map(
        ({ day, state, today: isToday }) => `${day}${isToday ? "*" : ""}:${state}`,
      );
    expect(strip(11, 104)).toEqual([
      "7:claimed",
      "8:missed",
      "9:claimed",
      "10:missed",
      "11:claimed",
      "12*:open",
      "13:ahead",
    ]);
    // Day 1: today first, six days ahead. The last day: the six before it.
    expect(strip(0, 104, 0, true)).toEqual([
      "1*:claimed",
      "2:ahead",
      "3:ahead",
      "4:ahead",
      "5:ahead",
      "6:ahead",
      "7:ahead",
    ]);
    expect(strip(104, 104)).toEqual([
      "99:claimed",
      "100:missed",
      "101:claimed",
      "102:missed",
      "103:claimed",
      "104:missed",
      "105*:open",
    ]);
    // Days before the home was founded are not missed; a season shorter than the strip shows its days only.
    expect(strip(3, 104, 2)).toEqual(["1:before", "2:before", "3:claimed", "4*:open", "5:ahead", "6:ahead", "7:ahead"]);
    expect(strip(1, 2)).toEqual(["1:claimed", "2*:open", "3:ahead"]);
    expect(strip(11, undefined)).toHaveLength(7);
  });
});
