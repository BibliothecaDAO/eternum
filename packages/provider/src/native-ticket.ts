import { ec, hash, WebSocketChannel } from "starknet";

/** `signature` goes unchanged to the actor account's SNIP-6 `is_valid_signature`; its layout is the account's. */
export interface SignedNativeIntent {
  intent: string[];
  signature: string[];
}

/** The signature layout of the shard's current gameplay account class: a bare `[r, s]` from its one key. */
export function signGameplayIntent(digest: string, privateKey: string): string[] {
  const { r, s } = ec.starkCurve.sign(digest, privateKey);
  return [`0x${r.toString(16)}`, `0x${s.toString(16)}`];
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
      if (status.status === "refused") throw new Error(`Action refused: ${status.reason}`);
      if (["queued", "accepted", "submitted"].includes(status.status)) return;
      if (status.status !== "recorded") throw new Error("Unknown ticket status");
      if (typeof status.transaction_hash !== "string" || !/^0x[0-9a-f]+$/i.test(status.transaction_hash))
        throw new Error("Invalid ticket transaction hash");
      if (typeof status.order !== "number" || !Number.isSafeInteger(status.order) || status.order <= 0)
        throw new Error("Invalid ticket order");
      finish(pending, { transaction_hash: status.transaction_hash, order: BigInt(status.order) });
    } catch (error) {
      finish(pending, error instanceof Error ? error : new Error(String(error)));
    }
  };

  const refuseAdmission = (pending: PendingAction, reason: string) => {
    if (isAdmissionBusy(reason)) {
      const delay = BUSY_BACKOFF_MS[Math.min(pending.busyRetries, BUSY_BACKOFF_MS.length - 1)];
      pending.busyRetries += 1;
      setTimeout(() => actions.get(pending.action) === pending && subscribe(pending), delay);
    } else if (isStaleNonce(reason)) finish(pending, new StaleActionNonceError(pending.action));
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
