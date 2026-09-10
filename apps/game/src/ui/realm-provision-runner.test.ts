import { describe, expect, it, vi } from "vitest";
import {
  createRealmProvisionRunner,
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
    expect(report.provisioned.mock.calls.map(([entry]) => entry.entityId)).toEqual([1, 3]);
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

  it("does not resend a confirmed realm before RECS catches up, and retries a failed batch at the next head", async () => {
    let fail = true;
    const { runner, submit, report, store } = harness({
      submit: async () => {
        if (fail) throw new Error("nonce");
      },
    });
    await runner.onConfirmedHead();
    expect(report.failed).toHaveBeenCalledTimes(1);
    expect(report.failed.mock.calls[0][0].map((entry: RealmProvisionCandidate) => entry.entityId)).toEqual([1, 3]);
    fail = false;
    await runner.onConfirmedHead();
    expect(submit).toHaveBeenCalledTimes(2);
    expect(report.provisioned).toHaveBeenCalledTimes(2);
    // The diff has not landed yet: the realms still read unprovisioned, but nothing is sent again.
    await runner.onConfirmedHead();
    expect(submit).toHaveBeenCalledTimes(2);
    store.realms = [realm(1, true), realm(3, true), realm(4)];
    await runner.onConfirmedHead();
    expect(submit).toHaveBeenLastCalledWith([4]);
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
