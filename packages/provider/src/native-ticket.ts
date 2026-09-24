import { ec, hash, WebSocketChannel } from "starknet";

/** `signature` goes unchanged to the actor account's SNIP-6 `is_valid_signature`; its layout is the account's. */
export interface SignedNativeIntent {
  intent: string[];
  signature: string[];
}

/** A Realms account device's signature, as `is_valid_signature` reads it: `[device_key, r, s]`. */
export function signGameplayIntent(digest: string, privateKey: string): string[] {
  const { r, s } = ec.starkCurve.sign(digest, privateKey);
  return [ec.starkCurve.getStarkKey(privateKey), `0x${r.toString(16)}`, `0x${s.toString(16)}`];
}

type RecordedTransaction = { transaction_hash: string; order: bigint };
type PendingAction = {
  signed: SignedNativeIntent;
  action: string;
  promise: Promise<RecordedTransaction>;
  resolve: (value: RecordedTransaction) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  busyRetries: number;
};

/** No outcome after the resubmission window. The intent may still be recorded; the store shows it if it is. */
export class ActionOutcomeUnknownError extends Error {
  constructor(action: string) {
    super(
      `Action ${action} has no recorded outcome after ${(2 * OUTCOME_WINDOW_MS) / 1_000}s; it may still be recorded`,
    );
    this.name = "ActionOutcomeUnknownError";
  }
}

/** The sequencer holds a newer nonce for the actor than the intent carries, and recorded nothing for it. */
export class StaleActionNonceError extends Error {
  constructor(action: string) {
    super(`Action ${action} was signed against a nonce the sequencer has moved past; nothing was recorded`);
    this.name = "StaleActionNonceError";
  }
}

/** The game changed releases before admission or execution; its nonce remains available. */
export class StaleGameReleaseError extends Error {
  constructor() {
    super("STALE_RELEASE: reload the game's release before signing again");
    this.name = "StaleGameReleaseError";
  }
}

/**
 * The shard refuses this account before reading its signature or nonce: it is not the canonical account for the
 * shard's guardian and account class, or its class is no longer the shard's. The nonce stays unused.
 */
class AccountNotAdmittedError extends Error {
  constructor(readonly reason: "FOREIGN_GUARDIAN" | "INVALID_ACTOR") {
    super(
      reason === "FOREIGN_GUARDIAN"
        ? "FOREIGN_GUARDIAN: this account is not under the shard's guardian"
        : "INVALID_ACTOR: this account does not run the shard's account class",
    );
    this.name = "AccountNotAdmittedError";
  }
}

/** The refusals the sequencer and the Games contract name, and the error each reaches the caller as. */
const NAMED_REFUSALS: Record<string, () => Error> = {
  STALE_RELEASE: () => new StaleGameReleaseError(),
  FOREIGN_GUARDIAN: () => new AccountNotAdmittedError("FOREIGN_GUARDIAN"),
  INVALID_ACTOR: () => new AccountNotAdmittedError("INVALID_ACTOR"),
};

/** The named refusal a sequencer's reason text carries, if any. */
const refusalIn = (reason: string): Error | undefined =>
  Object.entries(NAMED_REFUSALS).find(([name]) => new RegExp(`\\b${name}\\b`).test(reason))?.[1]();

/** The named refusal a recorded outcome's status class carries, if any: the reason as a Cairo short string. */
const refusalOf = (statusClass: string): Error | undefined =>
  Object.entries(NAMED_REFUSALS).find(
    ([name]) => BigInt(statusClass) === BigInt(`0x${Array.from(name, (c) => c.charCodeAt(0).toString(16)).join("")}`),
  )?.[1]();

/** How long one submission of a signed intent waits for its outcome before the one resubmission, then the failure. */
const OUTCOME_WINDOW_MS = 60_000;
const BUSY_BACKOFF_MS = [500, 1_000, 2_000, 4_000, 8_000];
const isAdmissionBusy = (message: string) => /queue is full|request rate exceeded/i.test(message);
const isStaleNonce = (message: string) => message.includes("actor nonce is not current");

/**
 * One node connection follows concurrent intents to their own recorded outcomes. This is the only timer on the native
 * path: an intent waits one window for its outcome, is sent again once (the sequencer reuses a pending ticket, so this
 * never creates a second action), and fails with ActionOutcomeUnknownError after a second window. A busy admission is
 * retried with backoff inside the window; a reopened socket re-sends every pending intent so its outcome is followed.
 */
export function createNativeTicketSubmission(baseUrl: string) {
  const url = new URL(baseUrl);
  if (!["http:", "https:", "ws:", "wss:"].includes(url.protocol)) throw new Error("Invalid admission URL");
  url.protocol = ["https:", "wss:"].includes(url.protocol) ? "wss:" : "ws:";
  const actions = new Map<string, PendingAction>();
  const requests = new Map<number, PendingAction>();
  const subscriptions = new Map<string, PendingAction>();
  let channel: WebSocketChannel | undefined;
  let connectedSocket: unknown;
  let disposed = false;

  const finish = (pending: PendingAction, result: RecordedTransaction | Error) => {
    clearTimeout(pending.timer);
    actions.delete(pending.action);
    for (const [id, action] of requests) if (action === pending) requests.delete(id);
    for (const [id, action] of subscriptions) if (action === pending) subscriptions.delete(id);
    if (result instanceof Error) pending.reject(result);
    else pending.resolve(result);
  };

  const subscribe = (pending: PendingAction) => {
    if (!channel?.isConnected()) return;
    requests.set(channel.send("game_subscribeAction", [pending.signed]), pending);
  };

  const receive = (event: MessageEvent) => {
    let message;
    try {
      message = JSON.parse(String(event.data));
    } catch {
      for (const pending of actions.values()) finish(pending, new Error("Malformed node action response"));
      return;
    }
    if (message.id !== undefined) {
      const pending = requests.get(message.id);
      if (!pending) return;
      requests.delete(message.id);
      if (message.error) refuseAdmission(pending, String(message.error.message));
      else if (typeof message.result === "string" || typeof message.result === "number")
        subscriptions.set(String(message.result), pending);
      else finish(pending, new Error("Admission returned an invalid subscription"));
      return;
    }
    if (message.method !== "game_action") return;
    const pending = subscriptions.get(String(message.params?.subscription));
    if (!pending) return;
    try {
      const status = message.params.result;
      if (typeof status.action !== "string" || BigInt(status.action) !== BigInt(pending.action))
        throw new Error("Ticket status identity mismatch");
      if (status.status === "refused")
        throw refusalIn(String(status.reason)) ?? new Error(`Action refused: ${status.reason}`);
      if (["queued", "accepted", "submitted"].includes(status.status)) return;
      if (status.status !== "recorded") throw new Error("Unknown ticket status");
      if (typeof status.transaction_hash !== "string" || !/^0x[0-9a-f]+$/i.test(status.transaction_hash))
        throw new Error("Invalid ticket transaction hash");
      if (typeof status.order !== "number" || !Number.isSafeInteger(status.order) || status.order <= 0)
        throw new Error("Invalid ticket order");
      // A refusal recorded before the nonce was used leaves the intent unexecuted; the caller hears it by name.
      const refusal =
        status.succeeded === false && status.nonce_consumed === false && status.status_class
          ? refusalOf(String(status.status_class))
          : undefined;
      if (refusal) throw refusal;
      finish(pending, { transaction_hash: status.transaction_hash, order: BigInt(status.order) });
    } catch (error) {
      finish(pending, error instanceof Error ? error : new Error(String(error)));
    }
  };

  const refuseAdmission = (pending: PendingAction, reason: string) => {
    const refusal = refusalIn(reason);
    if (isAdmissionBusy(reason)) {
      const delay = BUSY_BACKOFF_MS[Math.min(pending.busyRetries, BUSY_BACKOFF_MS.length - 1)];
      pending.busyRetries += 1;
      setTimeout(() => actions.get(pending.action) === pending && subscribe(pending), delay);
    } else if (refusal) finish(pending, refusal);
    else if (isStaleNonce(reason)) finish(pending, new StaleActionNonceError(pending.action));
    else finish(pending, new Error(`Action admission rejected: ${reason}`));
  };

  const connect = () => {
    if (channel) return;
    channel = new WebSocketChannel({ nodeUrl: url.toString(), autoReconnect: true });
    channel.on("open", () => {
      if (connectedSocket === channel!.websocket) return;
      connectedSocket = channel!.websocket;
      requests.clear();
      subscriptions.clear();
      // A restart can discard unexecuted assignments. Retry the signed intent,
      // allowing the node to recover its recorded outcome or assign a new order.
      for (const pending of actions.values()) subscribe(pending);
    });
    channel.on("message", receive);
  };

  const submit = (signed: SignedNativeIntent): Promise<RecordedTransaction> => {
    if (disposed) return Promise.reject(new Error("Action transport is disposed"));
    const action = hash.computePoseidonHashOnElements(signed.intent);
    const existing = actions.get(action);
    if (existing) return existing.promise;
    let resolve!: PendingAction["resolve"];
    let reject!: PendingAction["reject"];
    const promise = new Promise<RecordedTransaction>((accept, fail) => {
      resolve = accept;
      reject = fail;
    });
    const pending: PendingAction = {
      signed,
      action,
      promise,
      resolve,
      reject,
      timer: setTimeout(() => {
        console.warn(`Action ${action} has no outcome yet; sending the same signed intent once more`);
        subscribe(pending);
        pending.timer = setTimeout(() => finish(pending, new ActionOutcomeUnknownError(action)), OUTCOME_WINDOW_MS);
      }, OUTCOME_WINDOW_MS),
      busyRetries: 0,
    };
    actions.set(action, pending);
    connect();
    subscribe(pending);
    return promise;
  };
  submit.dispose = () => {
    disposed = true;
    for (const pending of actions.values()) finish(pending, new Error("Action transport is disposed"));
    channel?.disconnect();
    channel = undefined;
  };
  return submit;
}
