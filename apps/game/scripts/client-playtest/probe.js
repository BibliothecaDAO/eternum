// Registered by run-client-playtest.mjs as an init script, so it runs before any page code. It only observes: frame
// times, the scene each frame drew, long animation frames, input-to-paint latency, every input's time, draw calls, the
// GPU work each frame asked for (pipelines and shaders compiled, bytes uploaded), every download, the scene marks, heap,
// the map labels' DOM size, and each Herald socket message's arrival and handler cost. The runner reads it with `window.__playtest.read()` and reduces it per step.
(() => {
  if (window.__playtest) return;

  const MAX_ENTRIES = 50_000;
  const HEAP_SAMPLE_MS = 500;
  const state = {
    draws: [],
    events: [],
    frames: [],
    heap: [],
    inputs: [],
    labelNodes: [],
    loafs: [],
    messages: [],
    gpu: [],
    marks: [],
    plateStamina: [],
    resources: [],
    scenes: [],
    steps: [],
    watched: [],
  };
  // Conditions a step waits to see on screen, each checked in the probe's frame callback; `at` is when a check first
  // found one true (a frame's timestamp is when it began, which a busy frame's callbacks run well after).
  let watches = [];
  let drawsThisFrame = 0;
  const NO_GPU_WORK = { pipelines: 0, shaders: 0, uploadBytes: 0, callMs: 0 };
  let gpuThisFrame = { ...NO_GPU_WORK };

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

  // What a frame asks the GPU to build or receive: a pipeline or shader compiled (with the time the page spends in those
  // calls) and bytes uploaded (counted, not timed: uploads run hundreds of times a frame, and a clock read on each would
  // cost the frame-work numbers). Each upload reads its bytes from the call's arguments.
  const byteLength = (data) => data?.byteLength ?? 0;
  // A range of a source buffer: a typed array's offset and count are in its elements, an ArrayBuffer's or DataView's in
  // bytes; an absent count runs to the end.
  const rangeBytes = (data, offset = 0, count) => {
    const unit = data?.BYTES_PER_ELEMENT ?? 1;
    return count === undefined ? byteLength(data) - offset * unit : count * unit;
  };
  const imageBytes = (...args) => {
    const image = args.find((arg) => arg && typeof arg === "object" && "width" in arg && "height" in arg);
    return image ? image.width * image.height * 4 : byteLength(args.find((arg) => ArrayBuffer.isView(arg)));
  };
  const countGpuWork = (prototype, works) => {
    if (!prototype) return;
    for (const [name, kind, bytesOf] of works) {
      const call = prototype[name];
      if (typeof call !== "function") continue;
      prototype[name] =
        kind === "upload"
          ? function (...args) {
              gpuThisFrame.uploadBytes += bytesOf(...args);
              return call.apply(this, args);
            }
          : function (...args) {
              const start = performance.now();
              try {
                return call.apply(this, args);
              } finally {
                gpuThisFrame.callMs += performance.now() - start;
                gpuThisFrame[kind] += 1;
              }
            };
    }
  };
  countGpuWork(window.GPUDevice?.prototype, [
    ["createShaderModule", "shaders"],
    ["createRenderPipeline", "pipelines"],
    ["createRenderPipelineAsync", "pipelines"],
    ["createComputePipeline", "pipelines"],
    ["createComputePipelineAsync", "pipelines"],
  ]);
  countGpuWork(window.GPUQueue?.prototype, [
    ["writeBuffer", "upload", (_buffer, _offset, data, dataOffset, size) => rangeBytes(data, dataOffset, size)],
    ["writeTexture", "upload", (_destination, data) => byteLength(data)],
    [
      "copyExternalImageToTexture",
      "upload",
      (_source, _destination, size) => (size?.width ?? size?.[0] ?? 0) * (size?.height ?? size?.[1] ?? 1) * 4,
    ],
  ]);
  countGpuWork(window.WebGL2RenderingContext?.prototype, [
    ["compileShader", "shaders"],
    ["linkProgram", "pipelines"],
    [
      "bufferData",
      "upload",
      (_target, data, _usage, srcOffset, length) =>
        typeof data === "number" ? data : rangeBytes(data, srcOffset, length || undefined),
    ],
    [
      "bufferSubData",
      "upload",
      (_target, _offset, data, srcOffset, length) => rangeBytes(data, srcOffset, length || undefined),
    ],
    ["texImage2D", "upload", (...args) => imageBytes(...args.slice(1))],
    ["texSubImage2D", "upload", (...args) => imageBytes(...args.slice(2))],
    ["texImage3D", "upload", (...args) => imageBytes(...args.slice(1))],
    ["texSubImage3D", "upload", (...args) => imageBytes(...args.slice(2))],
    ["compressedTexImage2D", "upload", (...args) => byteLength(args.find((arg) => ArrayBuffer.isView(arg)))],
    ["compressedTexSubImage2D", "upload", (...args) => byteLength(args.find((arg) => ArrayBuffer.isView(arg)))],
  ]);

  const checkWatches = (timestamp) => {
    if (watches.length === 0) return;
    watches = watches.filter(({ name, holds }) => {
      let seen = false;
      try {
        seen = Boolean(holds());
      } catch {
        // A condition on an element not drawn yet reads as not seen.
      }
      if (seen) push(state.watched, { name, t: timestamp, at: performance.now() });
      return !seen;
    });
  };

  const onFrame = (timestamp) => {
    checkWatches(timestamp);
    push(state.frames, timestamp);
    push(state.draws, drawsThisFrame);
    push(state.gpu, gpuThisFrame);
    // The scene the renderer drew last; read here, it is the previous frame's, one frame late at a change.
    push(state.scenes, window.__rendererDiagnostics?.sceneName ?? null);
    drawsThisFrame = 0;
    gpuThisFrame = { ...NO_GPU_WORK };
    requestAnimationFrame(onFrame);
  };
  requestAnimationFrame(onFrame);

  // Every map label is drawn inside #labelrenderer, whichever renderer draws it; its element count is what they cost the
  // page's layout and style work.
  const labelNodes = () => document.getElementById("labelrenderer")?.getElementsByTagName("*").length ?? null;
  // The selected army's stamina as its plate reads it ("Stamina 84 of 150"), or null while no army plate is selected.
  const selectedPlateStamina = () => {
    const label = document.querySelector('[data-selected="true"] .mp-stamina')?.getAttribute("aria-label");
    const reading = label ? /^Stamina ([\d,]+) of/.exec(label) : null;
    return reading ? Number(reading[1].replaceAll(",", "")) : null;
  };
  setInterval(() => {
    push(state.heap, [performance.now(), usedHeapBytes()]);
    push(state.labelNodes, [performance.now(), labelNodes()]);
    push(state.plateStamina, [performance.now(), selectedPlateStamina()]);
  }, HEAP_SAMPLE_MS);

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
  // Every download, with what it cost on the wire (0 when the HTTP cache served it) and once unpacked.
  observe("resource", {}, (entry) => {
    const url = new URL(entry.name);
    push(state.resources, {
      url: url.origin === location.origin ? url.pathname : `${url.host}${url.pathname}`,
      bytes: entry.encodedBodySize,
      decodedBytes: entry.decodedBodySize,
      transferBytes: entry.transferSize,
      initiator: entry.initiatorType,
      start: entry.startTime,
      end: entry.responseEnd,
    });
  });
  // The game's own marks: a scene asked for and a scene presentable (scene-manager.ts).
  observe("mark", {}, (entry) => push(state.marks, { name: entry.name, t: entry.startTime }));
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

  // Event Timing only reports inputs slower than 16 ms; every press and tap is kept here with its own time.
  for (const type of ["pointerdown", "keydown"]) {
    addEventListener(
      type,
      (event) => push(state.inputs, { type, key: event.key ?? null, t: event.timeStamp, trusted: event.isTrusted }),
      { capture: true },
    );
  }

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
    /** Waits for `expression` (page JavaScript) to hold on screen; `read` reports the frame it first held in. */
    watch(name, expression) {
      watches.push({ name, holds: new Function(`return (${expression});`) });
    },
    async pan(keys, msPerKey) {
      for (const code of keys) await holdKey(code, msPerKey);
    },
    /** Positive deltaY zooms out, as a mouse wheel turned toward the player does. */
    async wheel(deltaY, notches) {
      await wheel(deltaY, notches);
    },
    /** Everything recorded since `since` (page time), with the page's time origin so a reload shows as a new one. */
    read(since = 0) {
      const after = (list, timeOf) => list.filter((entry) => timeOf(entry) >= since);
      const firstFrame = state.frames.findIndex((frame) => frame >= since);
      const fromFrame = firstFrame === -1 ? state.frames.length : Math.max(0, firstFrame - 1);
      return JSON.stringify({
        draws: state.draws.slice(fromFrame),
        gpu: state.gpu.slice(fromFrame),
        scenes: state.scenes.slice(fromFrame),
        events: after(state.events, (entry) => entry.start),
        frames: state.frames.slice(fromFrame),
        heap: after(state.heap, ([t]) => t),
        inputs: after(state.inputs, (entry) => entry.t),
        labelNodes: after(state.labelNodes, ([t]) => t),
        loafs: after(state.loafs, (entry) => entry.start),
        messages: after(state.messages, (entry) => entry.arrived),
        marks: after(state.marks, (entry) => entry.t),
        now: performance.now(),
        plateStamina: after(state.plateStamina, ([t]) => t),
        resources: state.resources,
        steps: after(state.steps, (entry) => entry.t),
        watched: after(state.watched, (entry) => entry.t),
        timeOrigin: performance.timeOrigin,
        timeline: window.__eternumGameEntryTimeline ?? [],
      });
    },
  };
})();
