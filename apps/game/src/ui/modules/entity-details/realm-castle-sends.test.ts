import type { UpgradeRealmProps } from "@bibliothecadao/types";
import { afterEach, describe, expect, it, vi } from "vitest";

const waitForAction = vi.fn();
vi.mock("@/sync/active-game-client", () => ({ requireActiveGameClient: () => ({ waitForAction }) }));

import { inFlight } from "@/hooks/store/use-actions-in-flight";
import { startRealmProvisionRunner, type RealmProvisionCandidate } from "@/ui/realm-provision-runner";
import { sendAutomaticProvision, sendRealmProvision } from "./realm-castle-sends";

const signer = { address: "0x1" } as never;
const APPLIED = { status: "SUCCEEDED" };

/**
 * The automatic provisioning and the player's Provision over realms 7 and 8, on the real runner, sends and castle lock.
 * Only the game is faked: each send's outcome waits until the test applies it, and applying it provisions the realm in
 * the facts, as the real outcome resolves once its facts are in the store.
 */
const match = () => {
  const facts = new Map([
    [7, false],
    [8, false],
  ]);
  const outcomes = new Map<string, () => void>();
  waitForAction.mockImplementation(
    (hash: string) => new Promise((resolve) => outcomes.set(hash, () => resolve(APPLIED))),
  );
  const calls = {
    provision_realm: vi.fn((props: UpgradeRealmProps & { upgrade?: boolean }) =>
      Promise.resolve({ transaction_hash: `0x${props.realm_entity_id}${props.upgrade ? "u" : ""}` } as never),
    ),
    upgrade_realm: vi.fn(() => Promise.resolve({ transaction_hash: "0xlevel" } as never)),
  };
  const report = { provisioned: vi.fn(), failed: vi.fn() };
  const start = () => {
    stops.push(
      startRealmProvisionRunner({
        readRealms: () =>
          [...facts].map(
            ([entityId, provisioned]): RealmProvisionCandidate => ({
              entityId,
              name: `Realm ${entityId}`,
              provisioned,
            }),
          ),
        isHeld: (realmId) => inFlight("castle", realmId) !== undefined,
        readPhase: () => ({ mainStartsAt: 0, over: false, devModeOn: false }),
        nowSeconds: () => 10,
        hasSigner: () => true,
        subscribeHeads: () => () => {},
        submit: async (realm, confirmed) => {
          await sendAutomaticProvision(calls, signer, realm.entityId);
          confirmed(realm);
        },
        report,
      }),
    );
  };
  const apply = async (hash: string, realmId: number) => {
    await vi.waitFor(() => expect(outcomes.has(hash)).toBe(true));
    facts.set(realmId, true);
    outcomes.get(hash)?.();
  };
  const sentRealms = () => calls.provision_realm.mock.calls.map(([props]) => props.realm_entity_id);
  const provisionedReports = () =>
    report.provisioned.mock.calls.flatMap((call) =>
      (call[0] as RealmProvisionCandidate[]).map((realm) => realm.entityId),
    );
  return { calls, report, start, apply, sentRealms, provisionedReports };
};

const stops: (() => void)[] = [];
afterEach(() => {
  stops.splice(0).forEach((stop) => stop());
  waitForAction.mockReset();
});

describe("a realm's provisioning, automatic and by hand", () => {
  it("automatic first: the player's Provision sends nothing while the automatic one is in flight", async () => {
    const m = match();
    m.start();
    await vi.waitFor(() => expect(inFlight("castle", 7)).toBe(true));

    expect(await sendRealmProvision(m.calls, signer, 7, true)).toBeNull();
    expect(m.sentRealms()).toEqual([7]);

    await m.apply("0x7", 7);
    await m.apply("0x8", 8);
    await vi.waitFor(() => expect(m.provisionedReports()).toEqual([7, 8]));
    expect(m.sentRealms()).toEqual([7, 8]);
    expect(m.report.failed).not.toHaveBeenCalled();
    expect(inFlight("castle", 7)).toBeUndefined();
  });

  it("by hand first: the automatic provisioning leaves that realm to the player's send and provisions the other", async () => {
    const m = match();
    const manual = sendRealmProvision(m.calls, signer, 7, true);
    m.start();
    await m.apply("0x8", 8);
    await vi.waitFor(() => expect(m.provisionedReports()).toEqual([8]));

    await m.apply("0x7u", 7);
    expect(await manual).toBe("0x7u");
    expect(m.sentRealms()).toEqual([7, 8]);
    expect(m.report.failed).not.toHaveBeenCalled();
  });

  it("does not send a queued realm the player provisioned while an earlier automatic send was in flight", async () => {
    const m = match();
    m.start();
    await vi.waitFor(() => expect(inFlight("castle", 7)).toBe(true));

    // The player provisions realm 8 while the automatic send for 7 is pending; it is applied first.
    const manual = sendRealmProvision(m.calls, signer, 8, false);
    await m.apply("0x8", 8);
    expect(await manual).toBe("0x8");
    await m.apply("0x7", 7);

    await vi.waitFor(() => expect(m.provisionedReports()).toEqual([7]));
    expect(m.sentRealms()).toEqual([7, 8]);
    expect(m.report.failed).not.toHaveBeenCalled();
  });
});
