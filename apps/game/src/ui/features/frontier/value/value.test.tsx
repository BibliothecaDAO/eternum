import { formatMoment } from "@bibliothecadao/types";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { planRealmLabor } from "./realm-labor";
import { RealmsSheet } from "./realms-sheet";
import { type WithdrawStep, WithdrawSheet } from "./withdraw-sheet";
import { SeasonWithdrawRow } from "./season-withdraw";
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

  it("sends a player with no wallet to link one", () => {
    const ways = render({ wallet: null });
    expect(button("Withdraw")).toBeUndefined();
    act(() => button("Link wallet")!.click());
    expect(ways.onLinkWallet).toHaveBeenCalledTimes(1);
  });

  it("says why nothing can leave, and that a withdrawal recorded in a pause pays when payouts resume", () => {
    render({ refusal: "Payouts paused. Your LORDS stay here." });
    expect(host.textContent).toContain("Payouts paused. Your LORDS stay here.");
    expect(button("Withdraw")!.disabled).toBe(true);
    render({ step: { kind: "waiting", amount: 500 } });
    expect(host.textContent).toContain("These 500 pay when they resume.");
  });
});

describe("a withdrawal's rules", () => {
  // A season ending at 10,000 with a 7-day claim window: the shard stops withdrawals one hour before it ends.
  const closesAt = withdrawalsCloseAt(10_000, 7 * 86_400);
  const open = { closesAt, now: closesAt - 1, ledgerReadable: true, paused: false };

  it("closes withdrawals in the claim window's last hour, as the shard does", () => {
    expect(closesAt).toBe(10_000 + 7 * 86_400 - 3_600);
    expect(withdrawalRefusal(open)).toBeNull();
    expect(withdrawalRefusal({ ...open, now: closesAt })).toBe("Withdrawals have closed for this season.");
  });

  it("refuses while the ledger cannot be read or its payouts are paused, the season's close first", () => {
    expect(withdrawalRefusal({ ...open, ledgerReadable: false })).toContain("cannot be read");
    expect(withdrawalRefusal({ ...open, paused: true })).toBe("Payouts paused. Your LORDS stay here.");
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
  // The season's withdrawals close at 10,000.
  const show = (lords: number | undefined, now: number, onOpen = vi.fn()) => {
    act(() => root.render(<SeasonWithdrawRow lords={lords} closesAt={10_000} now={now} onOpen={onOpen} />));
    return onOpen;
  };

  it("offers Withdraw, with the moment withdrawals close, while the season's claim window is open", () => {
    const onOpen = show(1_240, 9_999);
    expect(host.textContent).toContain("1,240");
    expect(host.textContent).toContain(`Withdraw until ${formatMoment(10_000, 9_999)}`);
    act(() => button("Withdraw")!.click());
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("says withdrawals have closed from that moment, and offers nothing to press", () => {
    show(1_240, 10_000);
    expect(host.textContent).toContain("Withdrawals have closed for this season.");
    expect(host.querySelector("button")).toBeNull();
  });

  it("shows nothing for a realm that holds no LORDS, or whose count is not known yet", () => {
    show(0, 9_999);
    expect(host.textContent).toBe("");
    show(undefined, 9_999);
    expect(host.textContent).toBe("");
  });
});

describe("the settled Realm's labor", () => {
  it("gives only an unclaimed held home one daily claim, limited by its store", () => {
    expect(planRealmLabor({ eligible: true, claimed: false, amount: 1000, held: 17600, limit: 18000 })).toEqual({
      eligible: true,
      claimed: false,
      total: 1000,
      fits: 400,
    });
    expect(planRealmLabor({ eligible: false, claimed: false, amount: 1000, held: 0, limit: 18000 }).total).toBe(0);
    expect(planRealmLabor({ eligible: true, claimed: true, amount: 1000, held: 0, limit: 18000 }).total).toBe(0);
  });
  it("shows one claim, explains partial storage, and offers no claim for a free home", () => {
    const onClaim = vi.fn(),
      onRealm = vi.fn();
    const show = (eligible: boolean, claimed: boolean, held: number) =>
      act(() =>
        root.render(
          <RealmsSheet
            plan={planRealmLabor({ eligible, claimed, amount: 1000, held, limit: 18000 })}
            dailyAmount={1000}
            secondsLeft={3600}
            sending={false}
            onClaim={onClaim}
            onRealm={onRealm}
            onClose={() => undefined}
          />,
        ),
      );
    show(true, false, 0);
    act(() => button("Claim 1,000 Labor")!.click());
    expect(onClaim).toHaveBeenCalledTimes(1);
    expect(host.querySelector("input")).toBeNull();
    show(true, false, 17600);
    expect(host.textContent).toContain("400 of 1,000 fit");
    expect(host.textContent).toContain("Claiming uses today's claim");
    act(() => button("Realm")!.click());
    expect(onRealm).toHaveBeenCalledTimes(1);
    show(true, true, 0);
    expect(host.textContent).toContain("Claimed today");
    expect(button("Claim 1,000 Labor")).toBeUndefined();
    show(false, false, 0);
    expect(host.textContent).toContain("no daily Labor claim");
    expect(button("Claim 1,000 Labor")).toBeUndefined();
  });
});
