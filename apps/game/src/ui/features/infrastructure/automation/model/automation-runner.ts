import { extractErrorMessage } from "@bibliothecadao/provider";
import { getScopedGameId } from "@bibliothecadao/eternum/game-client";
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
  if (cause instanceof Error && cause.name === "TransactionNoAnswerError") {
    return new AutomationPending({ message, cause });
  }
  if (
    /nonce|account validation failed|account balance|duplicate transaction|insufficient (?:max )?fee/i.test(message)
  ) {
    return new AutomationSignerUnavailable({ message, cause });
  }
  return new AutomationRejected({ message, cause });
};

type Submission = {
  signer: string;
  unresolved: boolean;
  result: Promise<unknown>;
  observing: boolean;
};

const submissions = new Map<string, Submission>();

/** A stopped observer leaves its receipt for the next pass; it never cancels a signed transaction. */
export const runAutomationTransaction = async ({
  signer,
  operation,
  submit,
  onConfirmed,
  signal,
}: {
  signer: string;
  operation: string;
  submit: () => Promise<unknown>;
  onConfirmed: () => void;
  signal: AbortSignal;
}): Promise<void> => {
  signal.throwIfAborted();
  const signerKey = `${getScopedGameId()}:${signer.toLowerCase()}`;
  const key = `${signerKey}:${operation}`;
  let submission = submissions.get(key);
  if (
    submission?.observing ||
    [...submissions.values()].some((other) => other !== submission && other.signer === signerKey && other.unresolved)
  ) {
    throw new AutomationSignerUnavailable({ message: "Automation is waiting for the signer's previous action." });
  }
  if (!submission) {
    submission = {
      signer: signerKey,
      unresolved: true,
      observing: false,
      result: Effect.runPromise(Effect.tryPromise({ try: submit, catch: classifySubmissionError })),
    };
    const started = submission;
    started.result = started.result.then(
      (value) => {
        started.unresolved = false;
        return value;
      },
      (error) => {
        started.unresolved = error instanceof AutomationPending;
        throw error;
      },
    );
    submissions.set(key, started);
  }
  const current = submission;
  current.observing = true;
  try {
    try {
      await Effect.runPromise(
        Effect.tryPromise({ try: () => current.result, catch: (error) => error }).pipe(
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
      if (!signal.aborted && !(error instanceof AutomationPending)) submissions.delete(key);
      throw error;
    }
    signal.throwIfAborted();
    onConfirmed();
    submissions.delete(key);
  } finally {
    current.observing = false;
  }
};
