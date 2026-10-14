import { afterEach, describe, expect, it, vi } from "vitest";
import {
  startRealmProvisionRunner,
  type RealmProvisionCandidate,
  type RealmProvisionPhase,
} from "./realm-provision-runner";
import { AutomationPending } from "@/ui/features/infrastructure/automation/model/automation-runner";

const realm = (entityId: number, provisioned = false): RealmProvisionCandidate => ({
  entityId,
  name: `Realm ${entityId}`,
  provisioned,
});
const disposers: (() => void)[] = [];
afterEach(() => {
  disposers.splice(0).forEach((dispose) => dispose());
});
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const harness = (
  overrides: {
    realms?: RealmProvisionCandidate[];
    phase?: Partial<RealmProvisionPhase>;
    now?: number;
    signer?: boolean;
    submit?: (id: number, signal: AbortSignal) => Promise<void>;
  } = {},
) => {
  const state = {
    realms: overrides.realms ?? [realm(1), realm(2, true), realm(3)],
    phase: { mainStartsAt: 100, over: false, devModeOn: false, ...overrides.phase },
    now: overrides.now ?? 150,
    signer: overrides.signer ?? true,
  };
  let notify!: () => void;
  const unsubscribe = vi.fn();
  const submit = vi.fn(overrides.submit ?? (async () => {}));
  const report = { provisioned: vi.fn(), failed: vi.fn() };
  const stop = startRealmProvisionRunner({
    readRealms: () => state.realms,
    readPhase: () => state.phase,
    nowSeconds: () => state.now,
    hasSigner: () => state.signer,
    subscribeHeads: (head) => {
      notify = head;
      return unsubscribe;
    },
    submit: async (id, confirmed, signal) => {
      await submit(id, signal);
      if (!signal.aborted) confirmed();
    },
    report,
  });
  disposers.push(stop);
  return {
    state,
    submit,
    report,
    stop,
    unsubscribe,
    head: async () => {
      notify();
      await flush();
    },
  };
};

describe("confirmed-head provisioning", () => {
  it("submits each unprovisioned realm and retains each confirmed result before native diffs arrive", async () => {
    const h = harness();
    await vi.waitFor(() => expect(h.report.provisioned.mock.calls.length + h.report.failed.mock.calls.length).toBe(2));
    expect(h.submit.mock.calls.map(([id]) => id)).toEqual([1, 3]);
    expect(h.report.provisioned.mock.calls.map(([realms]) => realms[0].entityId)).toEqual([1, 3]);
    await h.head();
    expect(h.submit).toHaveBeenCalledTimes(2);
    h.state.realms.push(realm(4));
    await h.head();
    await vi.waitFor(() => expect(h.submit.mock.calls.map(([id]) => id)).toEqual([1, 3, 4]));
  });
  it("waits for phase and signer readiness, including dev mode, and respects game end", async () => {
    const h = harness({ now: 50, signer: false });
    await flush();
    h.state.now = 100;
    await h.head();
    expect(h.submit).not.toHaveBeenCalled();
    h.state.signer = true;
    await h.head();
    await vi.waitFor(() => expect(h.report.provisioned).toHaveBeenCalledTimes(2));
    const dev = harness({ now: 0, phase: { devModeOn: true } });
    await vi.waitFor(() => expect(dev.report.provisioned).toHaveBeenCalledTimes(2));
    const over = harness({ phase: { devModeOn: true, over: true } });
    await flush();
    await over.head();
    expect(over.submit).not.toHaveBeenCalled();
  });
  it("skips exactly 1, 2, 4, 8, 8 confirmed heads between failures, then stops after six attempts", async () => {
    const h = harness({
      submit: async () => {
        throw new Error("nonce");
      },
    });
    await vi.waitFor(() => expect(h.report.failed).toHaveBeenCalledTimes(1));
    for (const skipped of [1, 2, 4, 8, 8]) {
      const before = h.submit.mock.calls.length;
      for (let i = 0; i < skipped; i++) await h.head();
      expect(h.submit).toHaveBeenCalledTimes(before);
      await h.head();
      await vi.waitFor(() => expect(h.report.failed).toHaveBeenCalledTimes(before + 1));
    }
    for (let i = 0; i < 10; i++) await h.head();
    expect(h.submit).toHaveBeenCalledTimes(6);
    expect(h.report.failed.mock.calls.map(([, , retry]) => retry)).toEqual(
      [1, 2, 4, 8, 8, null].map((heads, index) => ({ attempt: index + 1, nextAttemptInHeads: heads })),
    );
    h.state.realms.push(realm(9));
    await h.head();
    await vi.waitFor(() => expect(h.report.failed).toHaveBeenCalledTimes(7));
    expect(h.submit.mock.calls.at(-1)?.[0]).toBe(9);
    expect(h.report.failed.mock.calls.at(-1)?.[2]).toEqual({ attempt: 1, nextAttemptInHeads: 1 });
  });
  it("does not repeat a confirmed realm when the next realm in the batch fails", async () => {
    let fail = true;
    const h = harness({
      submit: async (id) => {
        if (id === 3 && fail) throw new Error("rejected");
      },
    });
    await vi.waitFor(() => expect(h.report.provisioned.mock.calls.length + h.report.failed.mock.calls.length).toBe(2));
    expect(h.submit.mock.calls.map(([id]) => id)).toEqual([1, 3]);
    fail = false;
    await h.head();
    await h.head();
    await vi.waitFor(() => expect(h.report.provisioned).toHaveBeenCalledTimes(2));
    expect(h.submit.mock.calls.map(([id]) => id)).toEqual([1, 3, 3]);
    expect(h.report.provisioned.mock.calls.map(([realms]) => realms[0].entityId)).toEqual([1, 3]);
  });
  it("ignores concurrent heads while submission is outstanding", async () => {
    let release!: () => void;
    const h = harness({
      realms: [realm(1)],
      submit: () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    });
    await flush();
    await h.head();
    await h.head();
    expect(h.submit).toHaveBeenCalledTimes(1);
    release();
    await flush();
    await h.head();
    expect(h.submit).toHaveBeenCalledTimes(1);
  });
  it("does not retry an unknown transaction as a rejection", async () => {
    const h = harness({
      submit: async () => {
        throw new AutomationPending({ message: "No answer yet" });
      },
    });
    await vi.waitFor(() => expect(h.report.failed).toHaveBeenCalledTimes(1));
    for (let i = 0; i < 12; i++) await h.head();
    expect(h.submit).toHaveBeenCalledTimes(1);
    expect(h.report.failed.mock.calls[0][2]).toEqual({ attempt: 1, nextAttemptInHeads: null });
  });
  it("releases subscriptions, aborts observation, and sends no next realm after disposal", async () => {
    let release!: () => void;
    const h = harness({
      submit: () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    });
    await vi.waitFor(() => expect(h.submit).toHaveBeenCalledTimes(1));
    const signal = h.submit.mock.calls[0][1];
    h.stop();
    await vi.waitFor(() => expect(h.unsubscribe).toHaveBeenCalledTimes(1));
    expect(signal.aborted).toBe(true);
    release();
    await flush();
    await h.head();
    expect(h.submit).toHaveBeenCalledTimes(1);
    expect(h.report.provisioned).not.toHaveBeenCalled();
    expect(h.report.failed).not.toHaveBeenCalled();
  });
});
