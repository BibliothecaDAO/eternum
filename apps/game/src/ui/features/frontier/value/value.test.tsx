import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PayoutWallet } from "@realms-world/identity";
import { type HeldRealm, planRealmLabor } from "./realm-labor";
import { RealmsSheet } from "./realms-sheet";
import { type WithdrawStep, WithdrawSheet } from "./withdraw-sheet";
import { formatMoment } from "@/ui/design-system/kit/time";
import { withdrawalRefusal, withdrawStepOf } from "./withdrawal";

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
const READY: PayoutWallet = { status: "ready", address: ADDRESS };
const NOW = 1_800_000_000_000;
const button = (word: string) =>
  [...host.querySelectorAll<HTMLButtonElement>("button")].find((each) => each.textContent?.startsWith(word));

describe("Withdraw", () => {
  const render = (
    over: Partial<{ wallet: PayoutWallet; refusal: string; step: WithdrawStep; amount: number }>,
    ways = { onAmount: vi.fn(), onWithdraw: vi.fn(), onLinkWallet: vi.fn() },
  ) => {
    act(() =>
      root.render(
        <WithdrawSheet
          held={1_240}
          wallet={over.wallet ?? READY}
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

  it("sends the chosen amount, or all of it, to the linked wallet it shows", () => {
    const ways = render({});
    expect(host.textContent).toContain("0x04a1…9f3c");
    act(() => button("All")!.click());
    expect(ways.onAmount).toHaveBeenCalledWith(1_240);
    act(() => button("Withdraw")!.click());
    expect(ways.onWithdraw).toHaveBeenCalledTimes(1);
  });

  it("sends a player with no wallet to link one, and lets nothing leave before a new wallet's hold ends", () => {
    const ways = render({ wallet: { status: "no_wallet" } });
    expect(button("Withdraw")).toBeUndefined();
    act(() => button("Link wallet")!.click());
    expect(ways.onLinkWallet).toHaveBeenCalledTimes(1);
    const until = NOW + (18 * 60 + 40) * 60_000;
    render({ wallet: { status: "on_hold", address: ADDRESS, until } });
    // The hold shows as the moment the new wallet can receive, its day included, nothing more.
    expect(host.querySelector(`[aria-label="Receives from ${formatMoment(until / 1000)}"]`)).not.toBeNull();
    expect(button("Withdraw")!.disabled).toBe(true);
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
  const open = { ledgerReadable: true, paused: false };

  it("refuses while the ledger cannot be read or its payouts are paused", () => {
    expect(withdrawalRefusal(open)).toBeNull();
    expect(withdrawalRefusal({ ...open, ledgerReadable: false })).toContain("cannot be read");
    expect(withdrawalRefusal({ ...open, paused: true })).toBe("Payouts paused. Your LORDS stay here.");
    // A pause not read yet refuses nothing.
    expect(withdrawalRefusal({ ...open, paused: undefined })).toBeNull();
  });

  it("follows a withdrawal from the shard to its payment on Starknet", () => {
    const sent = { amount: 500, claimId: "0x7f3a", fromBlock: 812_000 };
    const none = { sending: null, sent: null, paidIn: undefined, paused: false };
    expect(withdrawStepOf(none)).toEqual({ kind: "pick" });
    expect(withdrawStepOf({ ...none, sending: 500 })).toEqual({ kind: "sending", amount: 500 });
    expect(withdrawStepOf({ ...none, sent })).toEqual({ kind: "sending", amount: 500 });
    expect(withdrawStepOf({ ...none, sent, paused: true })).toEqual({ kind: "waiting", amount: 500 });
    expect(withdrawStepOf({ ...none, sent, paused: true, paidIn: "https://x/tx/0x1" })).toEqual({
      kind: "paid",
      amount: 500,
      transactionUrl: "https://x/tx/0x1",
    });
  });
});

describe("the Realm holder's labor", () => {
  const realm = (realmId: number, claimedToday = false): HeldRealm => ({
    realmId,
    name: `Realm ${realmId}`,
    order: 1,
    claimedToday,
  });

  it("gives each Realm's labor once a day, at most the day's cap of Realms, and pays what fits", () => {
    const realms = [realm(1, true), realm(2), realm(3), realm(4)];
    const plan = planRealmLabor({ realms, perRealm: 1_000, cap: 3, labor: { held: 17_600, limit: 18_000 } });
    expect(plan.rows.map((row) => row.state)).toEqual(["claimed", "ready", "ready", "locked"]);
    expect(plan.total).toBe(2_000);
    expect(plan.fits).toBe(400);
    expect(planRealmLabor({ realms, perRealm: 1_000, cap: 0, labor: { held: 0, limit: 18_000 } }).total).toBe(3_000);
  });

  it("claims all in one tap, and with labor full leads to the realm and claims only what fits", () => {
    const onClaim = vi.fn();
    const onRealm = vi.fn();
    const show = (held: number) =>
      act(() =>
        root.render(
          <RealmsSheet
            wallet={READY}
            plan={planRealmLabor({
              realms: [realm(1, true), realm(2), realm(3)],
              perRealm: 1_000,
              cap: 5,
              labor: { held, limit: 18_000 },
            })}
            perRealm={1_000}
            cap={5}
            labor={held}
            secondsLeft={3_600}
            sending={false}
            onClaim={onClaim}
            onRealm={onRealm}
            onLinkWallet={() => undefined}
            onClose={() => undefined}
          />,
        ),
      );
    show(9_640);
    act(() => button("Claim all")!.click());
    expect(onClaim).toHaveBeenCalledTimes(1);
    show(17_600);
    expect(host.textContent).toContain("400 of 2,000 fit");
    act(() => button("Claim 400")!.click());
    act(() => button("Realm")!.click());
    expect([onClaim.mock.calls.length, onRealm.mock.calls.length]).toEqual([2, 1]);
  });
});
