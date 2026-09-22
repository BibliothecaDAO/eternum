import { Data, Effect } from "effect";
import { storyEventIdentity, type HeraldStoryHistoryPage } from "@bibliothecadao/eternum/game-sync";
import {
  parseAutomaticPushSource,
  buildStoryNotification,
  storyNotificationCreatedAt,
  includesStoryNotification,
  readNotificationStory,
  storyRecipients,
  type PushEnvelope,
} from "@bibliothecadao/notifications";
import { NotificationOutbox, type NotificationCandidate, type NotificationLease } from "./outbox";
import { WebPushSender } from "../web-push-sender";
import { PushSubscriptionStore } from "../push-subscription-store";
import type { createNotificationSource, NotificationSourceConfig } from "./source";

export function createAutomaticNotifier(input: {
  config: NotificationSourceConfig;
  source: ReturnType<typeof createNotificationSource>;
  ownerOf: (account: string) => Promise<string | null>;
  verifyChain: () => Promise<void>;
  now?: () => number;
}) {
  const now = input.now ?? Date.now;
  const ingest = Effect.gen(function* () {
    const outbox = yield* NotificationOutbox;
    const cursor = yield* outbox.checkpoint(input.source.key);
    const page = yield* Effect.tryPromise({
      try: () => input.source.page(cursor),
      catch: () => new NotificationIngestError({ operation: "history" }),
    });
    if (!cursor) {
      yield* outbox.initialize(input.source.key, page.next_cursor);
      return { read: 0, queued: 0, head: page.complete_through_block, cursor: page.next_cursor };
    }
    yield* Effect.tryPromise({
      try: input.verifyChain,
      catch: () => new NotificationIngestError({ operation: "chain_verification" }),
    });
    const candidates = yield* Effect.tryPromise({
      try: (signal) => resolveCandidates(page, input, now(), signal),
      catch: () => new NotificationIngestError({ operation: "recipient_mapping" }),
    }).pipe(Effect.timeout("15 seconds"));
    const queued = yield* outbox.commit(input.source.key, cursor, page.next_cursor, candidates, now());
    return { read: page.items.length, queued, head: page.complete_through_block, cursor: page.next_cursor };
  });
  return {
    tick: Effect.gen(function* () {
      const outbox = yield* NotificationOutbox;
      const expired = yield* outbox.prune(now());
      // Delivery proceeds even if Herald is temporarily unavailable; source progress remains unchanged on failure.
      const history = yield* ingest.pipe(
        Effect.catch((error) =>
          Effect.succeed({
            unavailable: true as const,
            operation:
              typeof error === "object" && error && "operation" in error ? String(error.operation) : "history_timeout",
          }),
        ),
      );
      const leases = yield* outbox.claim(input.source.key, now());
      const outcomes = yield* Effect.forEach(
        leases,
        (lease) => deliver(lease, now).pipe(Effect.catch(() => Effect.succeed("unavailable"))),
        { concurrency: 8 },
      );
      const queue = yield* outbox.metrics(input.source.key, now());
      return {
        event: "automatic_notifications_tick",
        source: input.source.key,
        history,
        expired,
        queue,
        unavailable: outcomes.filter((x) => x === "unavailable").length,
        accepted: outcomes.filter((x) => x === "accepted").length,
        retry: outcomes.filter((x) => x === "retry").length,
        suppressed: outcomes.filter((x) => x === "suppressed").length,
        failed: outcomes.filter((x) => x === "failed").length,
      };
    }),
  };
}

async function resolveCandidates(
  page: HeraldStoryHistoryPage,
  input: Parameters<typeof createAutomaticNotifier>[0],
  now: number,
  signal: AbortSignal,
): Promise<NotificationCandidate[]> {
  const eligible = page.items.filter((event) => storyNotificationCreatedAt(event.value) + 120000 > now);
  if (!eligible.length) return [];
  const games = await input.source.games();
  // A page-local map bounds RPC calls without assuming a permanent account binding cache is safe.
  const owners = new Map<string, string | null>();
  const candidates = new Map<string, NotificationCandidate>();
  for (const event of eligible) {
    const { story, payload } = readNotificationStory(event.value);
    if (!includesStoryNotification("all", story)) continue;
    const gameId = Number(event.game_id),
      gameName = games.get(gameId);
    if (!gameName) throw new Error("Notification game is missing from Herald directory");
    const sourceId = storyEventIdentity(
      { chainId: input.config.chainId, worldAddress: input.config.worldAddress, gameId },
      event.value,
    );
    for (const account of storyRecipients(story, event.value.owner, payload)) {
      signal.throwIfAborted();
      if (!owners.has(account)) owners.set(account, await input.ownerOf(account));
      const owner = owners.get(account);
      if (!owner) continue;
      const normalized = `0x${BigInt(owner).toString(16)}`;
      const notification = buildStoryNotification({
        sourceId,
        value: event.value,
        owner: normalized,
        gameName,
        target: `/enter/${input.config.chainId}/${gameId}`,
        now,
      });
      if (notification) candidates.set(`${normalized}:${notification.id}`, { story, notification });
    }
  }
  return [...candidates.values()];
}

function deliver(lease: NotificationLease, now: () => number) {
  return Effect.gen(function* () {
    const outbox = yield* NotificationOutbox;
    const eligible = yield* outbox.eligible(lease, now());
    if (!eligible) {
      yield* outbox.finish(lease, "suppressed", now());
      return "suppressed";
    }
    const sender = yield* WebPushSender;
    const envelope: PushEnvelope = {
      version: 1,
      kind: "game",
      source: parseAutomaticPushSource(lease.source),
      subscriptionId: lease.subscriptionId,
      notification: eligible.notification,
    };
    const result = yield* sender
      .send(eligible.subscription, envelope)
      .pipe(
        Effect.catchTag("PushSendError", (error) =>
          Effect.succeed({ retryable: error.retryable, retryAfterSeconds: error.retryAfterSeconds }),
        ),
      );
    if (result === "expired") {
      const subscriptions = yield* PushSubscriptionStore;
      yield* subscriptions.expire(lease.owner, lease.subscriptionId);
      return "suppressed";
    }
    if (result === "accepted") {
      yield* outbox.finish(lease, "accepted", now());
      return "accepted";
    }
    const retryAt =
      now() + Math.max(Math.min(30000, 1000 * 2 ** (lease.attempts - 1)), result.retryAfterSeconds * 1000);
    const retry = result.retryable && lease.attempts < 5 && retryAt < lease.expiresAt;
    yield* outbox.finish(lease, retry ? null : "failed", retryAt);
    return retry ? "retry" : "failed";
  });
}

class NotificationIngestError extends Data.TaggedError("NotificationIngestError")<{ operation: string }> {}
