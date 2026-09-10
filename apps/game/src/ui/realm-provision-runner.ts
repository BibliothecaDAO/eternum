/**
 * Provisions every owned realm that the chain still reports unprovisioned, once the main phase has started. The
 * chain's own definition of "provisioned" is a labor building on the realm, so the candidates read that count from
 * RECS; the runner keeps only the realms it has already confirmed, so a slow diff never sends a second call.
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

export interface RealmProvisionRunnerDeps {
  readRealms(): RealmProvisionCandidate[];
  readPhase(): RealmProvisionPhase;
  nowSeconds(): number;
  hasSigner(): boolean;
  /** One batched transaction for every realm; resolves once confirmed, rejects on failure. */
  submit(realmIds: number[]): Promise<void>;
  report: {
    provisioned(realm: RealmProvisionCandidate): void;
    failed(realms: RealmProvisionCandidate[], error: unknown): void;
  };
}

export interface RealmProvisionRunner {
  /** Runs at every confirmed head; a failed batch is retried at the next one. */
  onConfirmedHead(): Promise<void>;
}

export function createRealmProvisionRunner(deps: RealmProvisionRunnerDeps): RealmProvisionRunner {
  const confirmed = new Set<number>();
  let inFlight = false;

  const isMainPhaseOpen = (): boolean => {
    const phase = deps.readPhase();
    if (phase.devModeOn) return true;
    const now = deps.nowSeconds();
    const started = phase.mainStartsAt !== null && now >= phase.mainStartsAt;
    const over = phase.endsAt !== null && now > phase.endsAt;
    return started && !over;
  };

  const selectRealmsToProvision = (): RealmProvisionCandidate[] =>
    deps.readRealms().filter((realm) => !realm.provisioned && !confirmed.has(realm.entityId));

  return {
    async onConfirmedHead() {
      if (inFlight || !deps.hasSigner() || !isMainPhaseOpen()) return;
      const realms = selectRealmsToProvision();
      if (realms.length === 0) return;

      inFlight = true;
      try {
        await deps.submit(realms.map((realm) => realm.entityId));
        realms.forEach((realm) => {
          confirmed.add(realm.entityId);
          deps.report.provisioned(realm);
        });
      } catch (error) {
        deps.report.failed(realms, error);
      } finally {
        inFlight = false;
      }
    },
  };
}
