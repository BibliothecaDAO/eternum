import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AlertsAsk } from "@/shell/profile/alerts-ask";
import { planRealmLabor } from "./realm-labor";
import { RealmsSheet } from "./realms-sheet";
import { type WithdrawStep, WithdrawSheet } from "./withdraw-sheet";
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
    expect(host.textContent).toContain("No wallet linked");
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
  const show = (lords: number | undefined) => {
    act(() => root.render(<SeasonPayoutRow lords={lords} />));
  };

  it("shows the remaining LORDS and automatic payout without requiring a withdrawal", () => {
    show(1_240);
    expect(host.textContent).toContain("1,240");
    expect(host.textContent).toContain("LORDS are paid out automatically at season end");
    expect(host.querySelector("button")).toBeNull();
  });

  it("shows nothing after the sweep consumes the balance, or while the balance is unknown", () => {
    show(0);
    expect(host.textContent).toBe("");
    show(undefined);
    expect(host.textContent).toBe("");
  });
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
  it("shows one claim, explains partial storage, and offers no claim for a free home", () => {
    const onClaim = vi.fn(),
      onRealm = vi.fn();
    const show = (eligible: boolean, claimed: boolean, held: number) =>
      act(() =>
        root.render(
          <RealmsSheet
            plan={planRealmLabor({ eligible, claimed, amount: 1000, essence: 0, held, limit: 18000 })}
            dailyAmount={1000}
            dailyEssence={0}
            mark={null}
            secondsLeft={3600}
            nextDay={5}
            ask={null}
            sending={false}
            onClaim={onClaim}
            onRealm={onRealm}
            onClose={() => undefined}
          />,
        ),
      );
    show(true, false, 0);
    expect(host.querySelector('[aria-label="Labor per game day +1K"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="Essence per game day +1K"]')).toBeNull();
    act(() => button("Claim 1,000 Labor")!.click());
    expect(onClaim).toHaveBeenCalledTimes(1);
    expect(host.querySelector("input")).toBeNull();
    show(true, false, 17600);
    expect(host.textContent).toContain("400 of 1,000 fit");
    expect(host.textContent).toContain("remainder lost");
    act(() => button("Realm")!.click());
    expect(onRealm).toHaveBeenCalledTimes(1);
    show(true, true, 0);
    expect(host.textContent).toContain("Claimed today");
    expect(button("Claim 1,000 Labor")).toBeUndefined();
    show(false, false, 0);
    expect(host.textContent).toContain("No daily Labor claim");
    expect(button("Claim 1,000 Labor")).toBeUndefined();
  });
  it("asks for the next day's push once claimed, while this device would not get it", () => {
    const remind = vi.fn(),
      install = vi.fn();
    const show = (claimed: boolean, ask: AlertsAsk, nextDay: number | null = 5) =>
      act(() =>
        root.render(
          <RealmsSheet
            plan={planRealmLabor({ eligible: true, claimed, amount: 1000, essence: 0, held: 0, limit: 18000 })}
            dailyAmount={1000}
            dailyEssence={0}
            mark={null}
            secondsLeft={3600}
            nextDay={nextDay}
            ask={ask}
            sending={false}
            onClaim={() => undefined}
            onRealm={() => undefined}
            onClose={() => undefined}
          />,
        ),
      );
    show(true, { kind: "remind", busy: false, act: remind });
    act(() => button("Remind me when Day 5 opens")!.click());
    expect(remind).toHaveBeenCalledTimes(1);
    show(true, { kind: "remind", busy: true, act: remind });
    expect(button("Turning on")?.disabled).toBe(true);
    show(true, { kind: "install", busy: false, act: install });
    act(() => button("Add to Home Screen for reminders")!.click());
    expect(install).toHaveBeenCalledTimes(1);
    // Alerts already reach this device, the claim is still to take, or no day follows: nothing to ask.
    show(true, null);
    expect(button("Remind me when Day 5 opens")).toBeUndefined();
    expect(button("Add to Home Screen for reminders")).toBeUndefined();
    show(false, { kind: "remind", busy: false, act: remind });
    expect(button("Remind me when Day 5 opens")).toBeUndefined();
    show(true, { kind: "remind", busy: false, act: remind }, null);
    expect(button("Remind me when Day 5 opens")).toBeUndefined();
  });
});
