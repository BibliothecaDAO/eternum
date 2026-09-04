/**
 * Runs `callback` once: on the next animation frame, or after `fallbackMs` when frames stop arriving (a hidden tab,
 * a throttled window). Frame-driven drains that only wait on `requestAnimationFrame` stall in a background tab and
 * never finish booting; the timer keeps them authoritative. Returns a cancel function.
 */
export function requestFrameOrTimeout(callback: () => void, fallbackMs: number): () => void {
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
    timeout = setTimeout(run, fallbackMs);
  } else {
    timeout = setTimeout(run, 0);
  }

  return () => {
    done = true;
    cancel();
  };
}
