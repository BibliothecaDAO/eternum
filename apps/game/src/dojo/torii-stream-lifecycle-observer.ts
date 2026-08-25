/**
 * Best-effort observer for a Torii subscription's runtime close/error.
 *
 * FINDING (torii-wasm@1.7.0-preview.3): the subscription objects returned by
 * `onEntityUpdated` / `onEventMessageUpdated` / `onIndexerUpdated` expose ONLY a
 * `cancel()` method — there is no runtime error or close event. A silently
 * dropped gRPC/websocket stream therefore produces no callback today; the client
 * can only *infer* it via heartbeat staleness + the HTTP health probe.
 *
 * This helper feature-detects the common emitter shapes so that the moment a
 * future SDK surfaces a close/error, stream death becomes a first-class REMOTE
 * signal with no further wiring. It is intentionally a no-op against the current
 * SDK. Keeping it here (rather than inline) makes the feature-detection unit
 * testable and documents the gap in one place.
 */

interface ToriiStreamCloseInfo {
  reason: string;
}

export type ToriiStreamCloseHandler = (info: ToriiStreamCloseInfo) => void;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : typeof error === "string" ? error : "stream_error";

type EmitterLike = {
  on: (event: string, cb: (...args: unknown[]) => void) => void;
  off?: (event: string, cb: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, cb: (...args: unknown[]) => void) => void;
};

const isEmitterLike = (value: Record<string, unknown>): value is Record<string, unknown> & EmitterLike =>
  typeof value.on === "function";

export function hasToriiStreamLifecycleSignals(subscription: unknown): boolean {
  if (!subscription || typeof subscription !== "object") return false;
  const sub = subscription as Record<string, unknown>;
  return isEmitterLike(sub) || "onerror" in sub || "onclose" in sub;
}

/**
 * Attaches close/error listeners if the subscription supports them. Returns a
 * detach function (always safe to call, even when nothing was attached).
 */
export function observeToriiStreamLifecycle(subscription: unknown, onClose: ToriiStreamCloseHandler): () => void {
  if (!subscription || typeof subscription !== "object") {
    return () => {};
  }

  const sub = subscription as Record<string, unknown>;

  // Shape A: Node-style event emitter — sub.on("error" | "close", cb).
  if (isEmitterLike(sub)) {
    const errorCb = (error: unknown) => onClose({ reason: errorMessage(error) });
    const closeCb = () => onClose({ reason: "close" });
    sub.on("error", errorCb);
    sub.on("close", closeCb);

    const detach = sub.off ?? sub.removeListener;
    return () => {
      if (typeof detach === "function") {
        detach.call(sub, "error", errorCb);
        detach.call(sub, "close", closeCb);
      }
    };
  }

  // Shape B: assignable handler slots — sub.onerror / sub.onclose.
  if ("onerror" in sub || "onclose" in sub) {
    const previousError = sub.onerror;
    const previousClose = sub.onclose;
    sub.onerror = (error: unknown) => onClose({ reason: errorMessage(error) });
    sub.onclose = () => onClose({ reason: "close" });
    return () => {
      sub.onerror = previousError;
      sub.onclose = previousClose;
    };
  }

  return () => {};
}
