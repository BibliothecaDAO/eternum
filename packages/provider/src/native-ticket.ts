import { hash, WebSocketChannel } from "starknet";

export interface SignedNativeIntent {
  intent: string[];
  r: string;
  s: string;
  public_key: string;
}

type RecordedTransaction = { transaction_hash: string; order: bigint };
type PendingAction = {
  signed: SignedNativeIntent;
  action: string;
  promise: Promise<RecordedTransaction>;
  resolve: (value: RecordedTransaction) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

/** One node connection follows concurrent intents to their own recorded outcomes. */
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
      if (message.error) finish(pending, new Error(`Action admission rejected: ${message.error.message}`));
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
        console.warn(`Action ${action} outcome timed out; reconciling the same signed intent once`);
        subscribe(pending);
        pending.timer = setTimeout(
          () => finish(pending, new Error(`Action ${action} outcome timed out; reconnect to reconcile`)),
          60_000,
        );
      }, 60_000),
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
