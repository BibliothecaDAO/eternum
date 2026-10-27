/** How long a frame-driven step waits for a frame before it runs anyway: a hidden tab draws none. */
const FRAME_FALLBACK_MS = 100;

/**
 * Runs `callback` once: on the next animation frame, or after FRAME_FALLBACK_MS when frames stop arriving (a hidden tab,
 * a throttled window). Frame-driven drains that only wait on `requestAnimationFrame` stall in a background tab and
 * never finish booting; the timer keeps them authoritative. Returns a cancel function.
 */
export function requestFrameOrTimeout(callback: () => void): () => void {
  let done = false;
  let frame: number | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const cancel = () => {
    if (frame !== undefined) cancelAnimationFrame(frame);
    if (timeout !== undefined) clearTimeout(timeout);
    frame = undefined;
    timeout = undefined;
  };
  const run = () => {
    if (done) return;
    done = true;
    cancel();
    callback();
  };

  if (typeof requestAnimationFrame === "function") {
    frame = requestAnimationFrame(run);
    timeout = setTimeout(run, FRAME_FALLBACK_MS);
  } else {
    timeout = setTimeout(run, 0);
  }

  return () => {
    done = true;
    cancel();
  };
}

/** The next animation frame, or the fallback when frames stop arriving, as a promise to await. */
export const nextFrameOrTimeout = (): Promise<void> =>
  new Promise((resolve) => {
    requestFrameOrTimeout(resolve);
  });
