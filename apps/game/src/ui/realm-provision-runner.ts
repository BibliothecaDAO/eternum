import { hasGameEnded } from "@bibliothecadao/eternum/game-sync";
/**
 * Provisions every owned realm that the chain still reports unprovisioned, once the main phase has started. The
 * chain's own definition of "provisioned" is a labor building on the realm, so the candidates read that count from
 * RECS; the runner keeps only the realms it has already confirmed, so a slow diff never sends a second call.
 *
 * A failed batch waits a growing number of heads before the next attempt (doubling, capped) and, after enough
 * failures, leaves its realms alone until the next reload.
 */
export interface RealmProvisionCandidate {
  entityId: number;
  name: string;
  provisioned: boolean;
}

export interface RealmProvisionPhase {
  mainStartsAt: number | null;
  endsAt: number | null;
  devModeOn: boolean;
}

/** How a failed batch will be retried: heads until the next attempt, or null once the runner has given up. */
export interface RealmProvisionRetry {
  attempt: number;
  nextAttemptInHeads: number | null;
}

export interface RealmProvisionRunnerDeps {
  readRealms(): RealmProvisionCandidate[];
  readPhase(): RealmProvisionPhase;
  nowSeconds(): number;
  hasSigner(): boolean;
  /** One batched transaction for every realm; resolves once confirmed, rejects on failure. */
  submit(realmIds: number[]): Promise<void>;
  report: {
    /** The whole confirmed batch, so the reporter can retire that batch's failure row. */
    provisioned(realms: RealmProvisionCandidate[]): void;
    failed(realms: RealmProvisionCandidate[], error: unknown, retry: RealmProvisionRetry): void;
  };
}

export interface RealmProvisionRunner {
  /** Runs at every confirmed head. */
  onConfirmedHead(): Promise<void>;
}

/** Waits of 1, 2, 4, 8, 8 heads between attempts, then the sixth failure gives the batch up until reload. */
export const PROVISION_RETRY_CAP_HEADS = 8;
export const PROVISION_FAILURES_BEFORE_GIVING_UP = 6;

export function createRealmProvisionRunner(deps: RealmProvisionRunnerDeps): RealmProvisionRunner {
  const confirmed = new Set<number>();
  const abandoned = new Set<number>();
  let inFlight = false;
  let failures = 0;
  let headsUntilRetry = 0;

  const isMainPhaseOpen = (): boolean => {
    const phase = deps.readPhase();
    const now = deps.nowSeconds();
    const started = phase.devModeOn || (phase.mainStartsAt !== null && now >= phase.mainStartsAt);
    const over = hasGameEnded("Live", phase.endsAt ?? 0, now);
    return started && !over;
  };

  const selectRealmsToProvision = (): RealmProvisionCandidate[] =>
    deps
      .readRealms()
      .filter((realm) => !realm.provisioned && !confirmed.has(realm.entityId) && !abandoned.has(realm.entityId));

  const scheduleRetry = (realms: RealmProvisionCandidate[]): RealmProvisionRetry => {
    failures += 1;
    if (failures >= PROVISION_FAILURES_BEFORE_GIVING_UP) {
      realms.forEach((realm) => abandoned.add(realm.entityId));
      return { attempt: failures, nextAttemptInHeads: null };
    }
    headsUntilRetry = Math.min(2 ** (failures - 1), PROVISION_RETRY_CAP_HEADS);
    return { attempt: failures, nextAttemptInHeads: headsUntilRetry };
  };

  return {
    async onConfirmedHead() {
      if (headsUntilRetry > 0) {
        headsUntilRetry -= 1;
        return;
      }
      if (inFlight || !deps.hasSigner() || !isMainPhaseOpen()) return;
      const realms = selectRealmsToProvision();
      if (realms.length === 0) return;

      inFlight = true;
      try {
        await deps.submit(realms.map((realm) => realm.entityId));
        failures = 0;
        realms.forEach((realm) => confirmed.add(realm.entityId));
        deps.report.provisioned(realms);
      } catch (error) {
        deps.report.failed(realms, error, scheduleRetry(realms));
      } finally {
        inFlight = false;
      }
    },
  };
}
