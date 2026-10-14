import { extractErrorMessage } from "@bibliothecadao/provider";
import { gameTaskScope } from "./game-task-scope";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";

export class AutomationSignerUnavailable extends Data.TaggedError("AutomationSignerUnavailable")<{
  message: string;
  cause?: unknown;
}> {}

export class AutomationPending extends Data.TaggedError("AutomationPending")<{
  message: string;
  cause?: unknown;
}> {}

export class AutomationRejected extends Data.TaggedError("AutomationRejected")<{
  message: string;
  cause: unknown;
}> {}

const classifySubmissionError = (cause: unknown) => {
  const message = extractErrorMessage(cause);
  if (
    cause instanceof Error &&
    (cause.name === "TransactionNoAnswerError" ||
      cause.name === "AbortError" ||
      cause.message === "Game client disposed")
  ) {
    return new AutomationPending({ message, cause });
  }
  if (
    /nonce|account validation failed|account balance|duplicate transaction|insufficient (?:max )?fee/i.test(message)
  ) {
    return new AutomationSignerUnavailable({ message, cause });
  }
  return new AutomationRejected({ message, cause });
};

type Submission<Action> = {
  action: Action;
  result: Promise<unknown>;
  unresolved: boolean;
  observing: boolean;
};

type PassObserver<Action> = {
  client: Parameters<typeof gameTaskScope>[0];
  signer: string;
  signal: AbortSignal;
  onConfirmed: (action: Action) => void;
};

type Submit<Action> = (action: Action, execute: (submitted: Action) => Promise<unknown>) => Promise<void>;

const signerSubmissions = new Map<string, Set<Submission<unknown>>>();
const signerIdentity = (client: Parameters<typeof gameTaskScope>[0], signer: string) =>
  `${gameTaskScope(client)}:${BigInt(signer)}`;

/** Each task retains typed action receipts; a new pass reconciles them before it can plan another action. */
export const createAutomationTask = <Action>() => {
  const receipts = new Map<string, Set<Submission<Action>>>();

  return async (
    { client, signer, signal, onConfirmed }: PassObserver<Action>,
    plan: (submit: Submit<Action>) => Promise<void>,
  ): Promise<void> => {
    signal.throwIfAborted();
    const identity = signerIdentity(client, signer);
    const retained = receipts.get(identity);
    const retire = (submission: Submission<Action>) => {
      const taskReceipts = receipts.get(identity);
      taskReceipts?.delete(submission);
      if (taskReceipts?.size === 0) receipts.delete(identity);
      const signerReceipts = signerSubmissions.get(identity);
      signerReceipts?.delete(submission);
      if (signerReceipts?.size === 0) signerSubmissions.delete(identity);
    };
    const observe = (submission: Submission<Action>) => observeSubmission(submission, signal, onConfirmed, retire);

    if (retained?.size) {
      for (const submission of retained) await observe(submission);
      return;
    }

    await plan(async (action, execute) => {
      signal.throwIfAborted();
      const active = signerSubmissions.get(identity) ?? new Set<Submission<unknown>>();
      if ([...active].some((submission) => submission.unresolved || submission.observing)) {
        throw new AutomationSignerUnavailable({ message: "Automation is waiting for the signer's previous action." });
      }
      const submitted = structuredClone(action);
      const submission: Submission<Action> = {
        action: submitted,
        unresolved: true,
        observing: false,
        result: Effect.runPromise(
          Effect.tryPromise({ try: () => execute(structuredClone(submitted)), catch: classifySubmissionError }),
        ),
      };
      submission.result = submission.result.then(
        (value) => {
          submission.unresolved = false;
          return value;
        },
        (error) => {
          submission.unresolved = error instanceof AutomationPending;
          throw error;
        },
      );
      const taskReceipts = receipts.get(identity) ?? new Set<Submission<Action>>();
      taskReceipts.add(submission);
      receipts.set(identity, taskReceipts);
      active.add(submission);
      signerSubmissions.set(identity, active);
      await observe(submission);
    });
  };
};

const observeSubmission = async <Action>(
  submission: Submission<Action>,
  signal: AbortSignal,
  onConfirmed: (action: Action) => void,
  retire: (submission: Submission<Action>) => void,
) => {
  if (submission.observing)
    throw new AutomationSignerUnavailable({ message: "This automation action is already being observed." });
  submission.observing = true;
  try {
    try {
      await Effect.runPromise(
        Effect.tryPromise({ try: () => submission.result, catch: (error) => error }).pipe(
          Effect.timeoutOrElse({
            duration: 30_000,
            orElse: () =>
              Effect.fail(
                new AutomationPending({
                  message: "No answer yet. Automation is waiting for the submitted action.",
                }),
              ),
          }),
        ),
        { signal },
      );
    } catch (error) {
      if (!signal.aborted && !(error instanceof AutomationPending)) retire(submission);
      throw error;
    }
    signal.throwIfAborted();
    onConfirmed(structuredClone(submission.action));
    retire(submission);
  } finally {
    submission.observing = false;
  }
};
