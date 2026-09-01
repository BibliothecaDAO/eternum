import { Effect } from "effect";

export const fanOut = <Recipient>(
  recipients: Iterable<Recipient>,
  deliver: (recipient: Recipient) => void,
): Effect.Effect<void> =>
  Effect.forEach(recipients, (recipient) => Effect.sync(() => deliver(recipient)), {
    concurrency: "unbounded",
    discard: true,
  });
