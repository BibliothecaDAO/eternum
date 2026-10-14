// Registered by run-client-playtest.mjs as an init script, so it runs before any page code. It only observes: frame
// times, long animation frames, input-to-paint latency, draw calls, heap, and each Herald socket message's arrival and
// handler cost. The runner reads it with `window.__playtest.read()` and reduces it per playtest step.
(() => {
  if (window.__playtest) return;

  const MAX_ENTRIES = 50_000;
  const HEAP_SAMPLE_MS = 500;
  const state = {
    draws: [],
    events: [],
    frames: [],
    heap: [],
    loafs: [],
    messages: [],
    steps: [],
  };
  let drawsThisFrame = 0;

  const push = (list, entry) => {
    if (list.length < MAX_ENTRIES) list.push(entry);
  };
  const usedHeapBytes = () => performance.memory?.usedJSHeapSize ?? null;
  const shortSource = (url) => (url ? url.replace(location.origin, "").split("?")[0] : "");

  // Every backend draw goes through one of these; three.js issues them, so counting here needs no app hook.
  const countDraws = (prototype, names) => {
    if (!prototype) return;
    for (const name of names) {
      const draw = prototype[name];
      if (typeof draw !== "function") continue;
      prototype[name] = function (a, b, c, d, e, f) {
        drawsThisFrame += 1;
        return draw.call(this, a, b, c, d, e, f);
      };
    }
  };
  countDraws(window.WebGL2RenderingContext?.prototype, [
    "drawArrays",
    "drawElements",
    "drawArraysInstanced",
    "drawElementsInstanced",
    "drawRangeElements",
  ]);
  countDraws(window.GPURenderPassEncoder?.prototype, ["draw", "drawIndexed", "drawIndirect", "drawIndexedIndirect"]);

  const onFrame = (timestamp) => {
    push(state.frames, timestamp);
    push(state.draws, drawsThisFrame);
    drawsThisFrame = 0;
    requestAnimationFrame(onFrame);
  };
  requestAnimationFrame(onFrame);

  setInterval(() => push(state.heap, [performance.now(), usedHeapBytes()]), HEAP_SAMPLE_MS);

  const observe = (type, options, record) => {
    try {
      new PerformanceObserver((list) => list.getEntries().forEach(record)).observe({
        type,
        buffered: true,
        ...options,
      });
    } catch {
      // An entry type this browser does not ship is reported as absent, not as zero.
    }
  };
  observe("long-animation-frame", {}, (entry) =>
    push(state.loafs, {
      blockingMs: entry.blockingDuration,
      durationMs: entry.duration,
      scripts: entry.scripts
        .map((script) => ({
          durationMs: script.duration,
          fn: script.sourceFunctionName,
          invoker: script.invoker,
          source: shortSource(script.sourceURL),
        }))
        .sort((left, right) => right.durationMs - left.durationMs)
        .slice(0, 3),
      start: entry.startTime,
    }),
  );
  observe("event", { durationThreshold: 16 }, (entry) =>
    push(state.events, {
      durationMs: entry.duration,
      inputDelayMs: entry.processingStart - entry.startTime,
      name: entry.name,
      processingMs: entry.processingEnd - entry.processingStart,
      start: entry.startTime,
      target: entry.target?.getAttribute?.("aria-label") ?? entry.target?.textContent?.trim().slice(0, 24) ?? null,
    }),
  );

  // Herald assigns `socket.onmessage`; wrapping the setter times each message without touching the transport.
  const onmessage = Object.getOwnPropertyDescriptor(WebSocket.prototype, "onmessage");
  Object.defineProperty(WebSocket.prototype, "onmessage", {
    configurable: true,
    enumerable: true,
    get() {
      return onmessage.get.call(this);
    },
    set(handler) {
      if (typeof handler !== "function") return onmessage.set.call(this, handler);
      const host = new URL(this.url).host;
      onmessage.set.call(this, function (event) {
        const start = performance.now();
        try {
          return handler.call(this, event);
        } finally {
          const data = typeof event.data === "string" ? event.data : "";
          push(state.messages, {
            arrived: event.timeStamp,
            bytes: data.length,
            end: performance.now(),
            host,
            start,
            type: /"type":"([a-z_]+)"/.exec(data.slice(0, 256))?.[1] ?? null,
          });
        }
      });
    },
  });

  // Synthetic input for camera moves: MapControls reads key codes on the body and wheel events on its surface.
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const holdKey = async (code, ms, repeatMs = 33) => {
    const until = performance.now() + ms;
    while (performance.now() < until) {
      document.body.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, code, key: code.replace("Key", "") }));
      await sleep(repeatMs);
    }
    document.body.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, code, key: code.replace("Key", "") }));
  };
  const wheel = async (deltaY, notches, intervalMs = 120) => {
    const canvas = document.getElementById("main-canvas");
    const box = canvas.getBoundingClientRect();
    for (let notch = 0; notch < notches; notch += 1) {
      canvas.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          clientX: box.left + box.width / 2,
          clientY: box.top + box.height / 2,
          deltaMode: 0,
          deltaY,
        }),
      );
      await sleep(intervalMs);
    }
  };

  window.__playtest = {
    /** A step boundary; the heap is read after a forced collection when the browser exposes gc. */
    step(name) {
      window.gc?.();
      const step = { heapBytes: usedHeapBytes(), name, t: performance.now() };
      push(state.steps, step);
      return JSON.stringify({ ...step, timeOrigin: performance.timeOrigin });
    },
    async pan(keys, msPerKey) {
      for (const code of keys) await holdKey(code, msPerKey);
    },
    async zoom(notches) {
      await wheel(100, notches);
      await wheel(-100, notches);
    },
    /** Everything recorded since `since` (page time), with the page's time origin so a reload shows as a new one. */
    read(since = 0) {
      const after = (list, timeOf) => list.filter((entry) => timeOf(entry) >= since);
      const firstFrame = state.frames.findIndex((frame) => frame >= since);
      const fromFrame = firstFrame === -1 ? state.frames.length : Math.max(0, firstFrame - 1);
      return JSON.stringify({
        draws: state.draws.slice(fromFrame),
        events: after(state.events, (entry) => entry.start),
        frames: state.frames.slice(fromFrame),
        heap: after(state.heap, ([t]) => t),
        loafs: after(state.loafs, (entry) => entry.start),
        messages: after(state.messages, (entry) => entry.arrived),
        now: performance.now(),
        steps: after(state.steps, (entry) => entry.t),
        timeOrigin: performance.timeOrigin,
        timeline: window.__eternumGameEntryTimeline ?? [],
      });
    },
  };
})();
