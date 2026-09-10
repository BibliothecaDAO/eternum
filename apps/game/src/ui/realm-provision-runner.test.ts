import { describe, expect, it, vi } from "vitest";
import {
  createRealmProvisionRunner,
  PROVISION_FAILURES_BEFORE_GIVING_UP,
  PROVISION_RETRY_CAP_HEADS,
  type RealmProvisionCandidate,
  type RealmProvisionPhase,
} from "./realm-provision-runner";

const realm = (entityId: number, provisioned = false): RealmProvisionCandidate => ({
  entityId,
  name: `Realm ${entityId}`,
  provisioned,
});

const harness = (
  overrides: {
    realms?: RealmProvisionCandidate[];
    phase?: Partial<RealmProvisionPhase>;
    now?: number;
    signer?: boolean;
    submit?: (ids: number[]) => Promise<void>;
  } = {},
) => {
  const store = {
    realms: overrides.realms ?? [realm(1), realm(2, true), realm(3)],
    phase: { mainStartsAt: 100, endsAt: 1_000, devModeOn: false, ...overrides.phase },
    now: overrides.now ?? 150,
    signer: overrides.signer ?? true,
  };
  const submit = vi.fn(overrides.submit ?? (async () => {}));
  const report = { provisioned: vi.fn(), failed: vi.fn() };
  const runner = createRealmProvisionRunner({
    readRealms: () => store.realms,
    readPhase: () => store.phase,
    nowSeconds: () => store.now,
    hasSigner: () => store.signer,
    submit,
    report,
  });
  return { store, submit, report, runner };
};

describe("realm provision runner", () => {
  it("sends one batch for every unprovisioned realm and reports each one", async () => {
    const { runner, submit, report } = harness();
    await runner.onConfirmedHead();
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith([1, 3]);
    expect(report.provisioned.mock.calls[0][0].map((entry: RealmProvisionCandidate) => entry.entityId)).toEqual([1, 3]);
    expect(report.failed).not.toHaveBeenCalled();
  });

  it("waits for the main phase on the chain clock and stops after the season ends", async () => {
    const { runner, submit, store } = harness({ now: 50 });
    await runner.onConfirmedHead();
    expect(submit).not.toHaveBeenCalled();
    store.now = 100;
    await runner.onConfirmedHead();
    expect(submit).toHaveBeenCalledTimes(1);
    const late = harness({ now: 1_001 });
    await late.runner.onConfirmedHead();
    expect(late.submit).not.toHaveBeenCalled();
  });

  it("treats dev mode as an open main phase and waits for the gameplay signer", async () => {
    const { runner, submit, store } = harness({ now: 0, phase: { devModeOn: true }, signer: false });
    await runner.onConfirmedHead();
    expect(submit).not.toHaveBeenCalled();
    store.signer = true;
    await runner.onConfirmedHead();
    expect(submit).toHaveBeenCalledWith([1, 3]);
  });

  it("does not resend a confirmed realm before RECS catches up", async () => {
    const { runner, submit, store } = harness();
    await runner.onConfirmedHead();
    // The diff has not landed yet: the realms still read unprovisioned, but nothing is sent again.
    await runner.onConfirmedHead();
    expect(submit).toHaveBeenCalledTimes(1);
    store.realms = [realm(1, true), realm(3, true), realm(4)];
    await runner.onConfirmedHead();
    expect(submit).toHaveBeenLastCalledWith([4]);
  });

  it("backs off a failing batch by doubling heads up to the cap, then gives up after six failures until reload", async () => {
    expect(PROVISION_RETRY_CAP_HEADS).toBe(8);
    expect(PROVISION_FAILURES_BEFORE_GIVING_UP).toBe(6);
    const { runner, submit, report, store } = harness({
      submit: async () => {
        throw new Error("nonce");
      },
    });
    const headsBetweenAttempts: number[] = [];
    let sinceLastAttempt = 0;
    for (let head = 0; head < 80; head += 1) {
      const attemptsBefore = submit.mock.calls.length;
      await runner.onConfirmedHead();
      if (submit.mock.calls.length > attemptsBefore) {
        if (attemptsBefore > 0) headsBetweenAttempts.push(sinceLastAttempt);
        sinceLastAttempt = 0;
      } else {
        sinceLastAttempt += 1;
      }
    }
    expect(submit).toHaveBeenCalledTimes(6);
    expect(headsBetweenAttempts).toEqual([1, 2, 4, 8, 8]);
    expect(report.failed.mock.calls.map(([, , retry]) => retry)).toEqual([
      { attempt: 1, nextAttemptInHeads: 1 },
      { attempt: 2, nextAttemptInHeads: 2 },
      { attempt: 3, nextAttemptInHeads: 4 },
      { attempt: 4, nextAttemptInHeads: 8 },
      { attempt: 5, nextAttemptInHeads: 8 },
      { attempt: 6, nextAttemptInHeads: null },
    ]);
    // Given up: a new head sends nothing for those realms, but a new realm still gets its own batch.
    store.realms = [realm(1), realm(3), realm(9)];
    await runner.onConfirmedHead();
    expect(submit).toHaveBeenLastCalledWith([9]);
  });

  it("resets the backoff after a success", async () => {
    let fail = true;
    const { runner, submit, report } = harness({
      submit: async () => {
        if (fail) throw new Error("nonce");
      },
    });
    await runner.onConfirmedHead();
    fail = false;
    await runner.onConfirmedHead();
    await runner.onConfirmedHead();
    expect(submit).toHaveBeenCalledTimes(2);
    expect(report.provisioned).toHaveBeenCalledTimes(1);
    expect(report.failed).toHaveBeenCalledTimes(1);
  });

  it("lets one batch finish before the next head sends another", async () => {
    let release!: () => void;
    const { runner, submit } = harness({ submit: () => new Promise<void>((resolve) => (release = resolve)) });
    const first = runner.onConfirmedHead();
    await runner.onConfirmedHead();
    expect(submit).toHaveBeenCalledTimes(1);
    release();
    await first;
  });
});
