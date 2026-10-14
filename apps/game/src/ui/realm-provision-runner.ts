import * as Cause from "effect/Cause";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Queue from "effect/Queue";
import * as Schedule from "effect/Schedule";
import { AutomationPending } from "@/ui/features/infrastructure/automation/model/automation-runner";

export interface RealmProvisionCandidate {
  entityId: number;
  name: string;
  provisioned: boolean;
}

export interface RealmProvisionPhase {
  mainStartsAt: number | null;
  over: boolean;
  devModeOn: boolean;
}

export interface RealmProvisionRetry {
  attempt: number;
  nextAttemptInHeads: number | null;
}

interface RealmProvisionRunnerDeps {
  readRealms(): RealmProvisionCandidate[];
  readPhase(): RealmProvisionPhase;
  nowSeconds(): number;
  hasSigner(): boolean;
  subscribeHeads(head: () => void): () => void;
  submit(realmId: number, confirmed: () => void, signal: AbortSignal): Promise<void>;
  report: {
    provisioned(realms: RealmProvisionCandidate[]): void;
    failed(realms: RealmProvisionCandidate[], error: unknown, retry: RealmProvisionRetry): void;
  };
}

const PROVISION_RETRY_CAP_HEADS = 8;
const PROVISION_FAILURES_BEFORE_GIVING_UP = 6;

const isMainPhaseOpen = (deps: RealmProvisionRunnerDeps) => {
  const phase = deps.readPhase();
  return !phase.over && (phase.devModeOn || (phase.mainStartsAt !== null && deps.nowSeconds() >= phase.mainStartsAt));
};

/** A retry consumes confirmed heads, never wall-clock time. Disposal releases the listener and observer. */
export const startRealmProvisionRunner = (deps: RealmProvisionRunnerDeps): (() => void) =>
  Effect.runCallback(
    Effect.scoped(
      Effect.gen(function* () {
        const heads = yield* Queue.unbounded<void>();
        const confirmed = new Set<number>();
        const abandoned = new Set<number>();
        let submitting = false;
        const nextHead = Queue.take(heads);
        yield* Effect.acquireRelease(
          Effect.sync(() =>
            deps.subscribeHeads(() => {
              if (!submitting) Queue.offerUnsafe(heads, undefined);
            }),
          ),
          (unsubscribe) => Effect.sync(unsubscribe),
        );

        const candidates = () =>
          deps
            .readRealms()
            .filter((realm) => !realm.provisioned && !confirmed.has(realm.entityId) && !abandoned.has(realm.entityId));
        const provision = Effect.gen(function* () {
          for (const realm of candidates()) {
            if (!deps.hasSigner() || !isMainPhaseOpen(deps)) return;
            submitting = true;
            yield* Effect.tryPromise({
              try: (signal) =>
                deps.submit(
                  realm.entityId,
                  () => {
                    confirmed.add(realm.entityId);
                    deps.report.provisioned([realm]);
                  },
                  signal,
                ),
              catch: (error) => error,
            }).pipe(
              Effect.ensuring(
                Effect.sync(() => {
                  submitting = false;
                }),
              ),
            );
          }
        });
        const retry = Schedule.fromStepWithMetadata(
          Effect.succeed(({ attempt, input }: Schedule.InputMetadata<unknown>) =>
            Effect.gen(function* () {
              const realms = candidates();
              const stop = attempt >= PROVISION_FAILURES_BEFORE_GIVING_UP || input instanceof AutomationPending;
              const skipHeads = Math.min(2 ** (attempt - 1), PROVISION_RETRY_CAP_HEADS);
              deps.report.failed(realms, input, { attempt, nextAttemptInHeads: stop ? null : skipHeads });
              if (stop) {
                realms.forEach((realm) => abandoned.add(realm.entityId));
                return yield* Cause.done(attempt);
              }
              // Skip the advertised heads; the following head can submit again.
              for (let head = 0; head <= skipHeads; head++) yield* nextHead;
              return [attempt, Duration.zero] as [number, Duration.Duration];
            }),
          ),
        );

        while (true) {
          yield* provision.pipe(
            Effect.retry(retry),
            Effect.catch(() => Effect.void),
          );
          yield* nextHead;
        }
      }),
    ),
  );
