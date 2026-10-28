// Registered by run-client-playtest.mjs as an init script, so it runs before any page code. It only observes: frame
// times, the scene each frame drew, long animation frames, input-to-paint latency, every input's time, draw calls, the
// GPU work each frame asked for (pipelines and shaders compiled, bytes uploaded), the vertices each frame drew, the GPU
// memory held, what keeps running on its own (frame callbacks, timers, CSS animations, hidden overlays), every download, the scene marks, heap,
// the map labels' DOM size, and each Herald socket message's arrival and handler cost. The runner reads it with `window.__playtest.read()` and reduces it per step.
(() => {
  if (window.__playtest) return;

  const MAX_ENTRIES = 50_000;
  const HEAP_SAMPLE_MS = 500;
  const state = {
    draws: [],
    vertices: [],
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
  };
  let drawsThisFrame = 0;
  let verticesThisFrame = 0;
  const NO_GPU_WORK = { pipelines: 0, shaders: 0, uploadBytes: 0, callMs: 0 };
  let gpuThisFrame = { ...NO_GPU_WORK };

  const push = (list, entry) => {
    if (list.length < MAX_ENTRIES) list.push(entry);
  };
  const usedHeapBytes = () => performance.memory?.usedJSHeapSize ?? null;
  const shortSource = (url) => (url ? url.replace(location.origin, "").split("?")[0] : "");

  // Every backend draw goes through one of these; three.js issues them, so counting here needs no app hook. Each draw's
  // vertices (instances included) are read from its arguments: an indirect draw's live on the GPU and count as none.
  const DRAW_VERTICES = {
    drawArrays: (args) => args[2],
    drawElements: (args) => args[1],
    drawArraysInstanced: (args) => args[2] * args[3],
    drawElementsInstanced: (args) => args[1] * args[4],
    drawRangeElements: (args) => args[3],
    draw: (args) => args[0] * (args[1] ?? 1),
    drawIndexed: (args) => args[0] * (args[1] ?? 1),
    drawIndirect: () => 0,
    drawIndexedIndirect: () => 0,
  };
  const countDraws = (prototype, names) => {
    if (!prototype) return;
    for (const name of names) {
      const draw = prototype[name];
      if (typeof draw !== "function") continue;
      prototype[name] = function (...args) {
        drawsThisFrame += 1;
        verticesThisFrame += DRAW_VERTICES[name](args) || 0;
        return draw.apply(this, args);
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

  // The GPU memory the page holds: every WebGPU texture and buffer from its creation to its destroy() (or its collection),
  // with its size. A texture's bytes are estimated from its format, extent, mip chain and samples; WebGL's are not kept.
  const liveGpu = { textures: new Map(), buffers: new Map() };
  const gpuSizes = new WeakMap();
  const collected = new FinalizationRegistry(({ kind, key }) => liveGpu[kind].delete(key));
  let gpuKey = 0;
  const texelBytes = (format = "") => {
    const astc = /^astc-(\d+)x(\d+)/.exec(format);
    if (astc) return 16 / (Number(astc[1]) * Number(astc[2]));
    if (/^(bc1|bc4|etc2-rgb8|eac-r11)/.test(format)) return 0.5;
    if (/^(bc|etc2|eac)/.test(format)) return 1;
    const channels = format.startsWith("rgba") || format.startsWith("bgra") ? 4 : format.startsWith("rg") ? 2 : 1;
    if (/32(float|uint|sint)/.test(format)) return channels * 4;
    if (/16(float|uint|sint|unorm|snorm)/.test(format)) return channels * 2;
    if (/^(depth24|depth32|rgb10a2|rg11b10|rgb9e5)/.test(format)) return 4;
    if (format === "depth16unorm") return 2;
    return channels;
  };
  const textureBytes = (descriptor) => {
    const size = descriptor?.size ?? {};
    const [width, height = 1, layers = 1] = Array.isArray(size)
      ? size
      : [size.width, size.height ?? 1, size.depthOrArrayLayers ?? 1];
    const mips = (descriptor?.mipLevelCount ?? 1) > 1 ? 4 / 3 : 1;
    return Math.round(width * height * layers * texelBytes(descriptor?.format) * mips * (descriptor?.sampleCount ?? 1));
  };
  const textureShape = (descriptor) => {
    const size = descriptor?.size ?? {};
    const [width, height = 1, layers = 1] = Array.isArray(size)
      ? size
      : [size.width, size.height, size.depthOrArrayLayers];
    return `${width}x${height}${layers > 1 ? `x${layers}` : ""} ${descriptor?.format}${descriptor?.label ? ` ${descriptor.label}` : ""}`;
  };
  const textureShapes = new Map();
  const trackGpu = (prototype, name, kind, bytesOf) => {
    const create = prototype?.[name];
    if (typeof create !== "function") return;
    prototype[name] = function (descriptor) {
      const resource = create.call(this, descriptor);
      const key = (gpuKey += 1);
      liveGpu[kind].set(key, bytesOf(descriptor));
      if (kind === "textures") textureShapes.set(key, textureShape(descriptor));
      gpuSizes.set(resource, { kind, key });
      collected.register(resource, { kind, key });
      return resource;
    };
  };
  const untrackOnDestroy = (prototype) => {
    const destroy = prototype?.destroy;
    if (typeof destroy !== "function") return;
    prototype.destroy = function () {
      const tracked = gpuSizes.get(this);
      if (tracked) liveGpu[tracked.kind].delete(tracked.key);
      return destroy.call(this);
    };
  };
  trackGpu(window.GPUDevice?.prototype, "createTexture", "textures", textureBytes);
  trackGpu(window.GPUDevice?.prototype, "createBuffer", "buffers", (descriptor) => descriptor?.size ?? 0);
  untrackOnDestroy(window.GPUTexture?.prototype);
  untrackOnDestroy(window.GPUBuffer?.prototype);
  const gpuMemory = () => {
    const total = (map) => [...map.values()].reduce((sum, bytes) => sum + bytes, 0);
    return {
      textures: liveGpu.textures.size,
      textureBytes: total(liveGpu.textures),
      buffers: liveGpu.buffers.size,
      bufferBytes: total(liveGpu.buffers),
    };
  };

  // What keeps running on its own: every frame callback, repeating timer and timer of 100 ms or more the page schedules,
  // counted by the code that scheduled it (its first stack frames outside this probe). The counts only grow; a reader
  // takes two and subtracts them. The probe's own loops use the untouched functions and are not counted.
  const raw = {
    requestAnimationFrame: globalThis.requestAnimationFrame.bind(globalThis),
    setInterval: globalThis.setInterval.bind(globalThis),
    setTimeout: globalThis.setTimeout.bind(globalThis),
  };
  const scheduled = { frames: new Map(), timeouts: new Map() };
  const intervals = new Map();
  const callerTags = new WeakMap();
  const callerOf = (callback) => {
    if (typeof callback === "function" && callerTags.has(callback)) return callerTags.get(callback);
    const frames = (new Error().stack ?? "").split("\n").slice(3, 6);
    const tag = frames.map((frame) => frame.trim().replace(/^at /, "").replace(location.origin, "")).join(" < ");
    if (typeof callback === "function") callerTags.set(callback, tag);
    return tag;
  };
  const tally = (map, tag) => map.set(tag, (map.get(tag) ?? 0) + 1);
  globalThis.requestAnimationFrame = function (callback) {
    tally(scheduled.frames, callerOf(callback));
    return raw.requestAnimationFrame(callback);
  };
  globalThis.setInterval = function (callback, delay, ...args) {
    const id = raw.setInterval(callback, delay, ...args);
    intervals.set(id, { caller: callerOf(callback), delayMs: Number(delay) || 0 });
    return id;
  };
  const clearInterval = globalThis.clearInterval.bind(globalThis);
  globalThis.clearInterval = function (id) {
    intervals.delete(id);
    return clearInterval(id);
  };
  globalThis.setTimeout = function (callback, delay, ...args) {
    if (Number(delay) >= 100) tally(scheduled.timeouts, callerOf(callback));
    return raw.setTimeout(callback, delay, ...args);
  };
  // An element a player cannot see that still takes the page's work: running CSS animations, and anything laid over at
  // least half the screen while hidden (an overlay left mounted).
  const describeElement = (element) => {
    if (!(element instanceof Element)) return null;
    const classes = typeof element.className === "string" ? element.className.trim().split(/\s+/).slice(0, 4) : [];
    return [element.tagName.toLowerCase(), element.id && `#${element.id}`, ...classes.map((name) => `.${name}`)]
      .filter(Boolean)
      .join("");
  };
  const isSeen = (element) => {
    if (!element.isConnected || element.getClientRects().length === 0) return false;
    for (let node = element; node instanceof Element; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) return false;
    }
    return true;
  };
  const leftoverDom = () => {
    const screen = innerWidth * innerHeight;
    const overlays = [...document.querySelectorAll("body *")]
      .filter((element) => {
        const position = getComputedStyle(element).position;
        if (position !== "fixed" && position !== "absolute") return false;
        const box = element.getBoundingClientRect();
        return box.width * box.height >= screen / 2;
      })
      .map((element) => ({ element: describeElement(element), seen: isSeen(element) }));
    const bootShell = document.getElementById("boot-shell");
    return {
      nodes: document.getElementsByTagName("*").length,
      canvases: [...document.querySelectorAll("canvas")].map((canvas) => ({
        element: describeElement(canvas),
        width: canvas.width,
        height: canvas.height,
        seen: isSeen(canvas),
      })),
      bootShell: bootShell ? { seen: isSeen(bootShell), bootState: document.documentElement.dataset.bootState } : null,
      fullScreenLayers: overlays,
    };
  };
  // Elements whose inline style or SVG attributes keep changing (a script-driven animation never shows in
  // getAnimations()), counted per element from the first census on, outside the map labels' layer, which moves with the
  // camera by design.
  const restyled = new Map();
  let restyleWatch = null;
  const watchRestyles = () => {
    restyleWatch ??= new MutationObserver((records) => {
      for (const record of records) {
        if (record.target.closest?.("#labelrenderer")) continue;
        tally(restyled, describeElement(record.target));
      }
    });
    restyleWatch.observe(document.body, {
      attributes: true,
      attributeFilter: ["style", "transform", "d", "r", "opacity", "stroke-dashoffset"],
      subtree: true,
    });
  };
  const census = () => ({
    t: performance.now(),
    restyles: (watchRestyles(), Object.fromEntries(restyled)),
    frameCallbacks: Object.fromEntries(scheduled.frames),
    timeouts: Object.fromEntries(scheduled.timeouts),
    intervals: [...intervals.values()],
    animations: document
      .getAnimations()
      .filter((animation) => animation.playState === "running")
      .map((animation) => ({
        name: animation.animationName ?? animation.transitionProperty ?? animation.id ?? null,
        element: describeElement(animation.effect?.target),
        seen: animation.effect?.target instanceof Element ? isSeen(animation.effect.target) : null,
      })),
    dom: leftoverDom(),
    gpuMemory: gpuMemory(),
    largestTextures: [...liveGpu.textures]
      .sort(([, left], [, right]) => right - left)
      .slice(0, 12)
      .map(([key, bytes]) => ({ bytes, shape: textureShapes.get(key) })),
  });

  const onFrame = (timestamp) => {
    push(state.frames, timestamp);
    push(state.draws, drawsThisFrame);
    push(state.vertices, verticesThisFrame);
    push(state.gpu, gpuThisFrame);
    // The scene the renderer drew last; read here, it is the previous frame's, one frame late at a change.
    push(state.scenes, window.__rendererDiagnostics?.sceneName ?? null);
    drawsThisFrame = 0;
    verticesThisFrame = 0;
    gpuThisFrame = { ...NO_GPU_WORK };
    raw.requestAnimationFrame(onFrame);
  };
  raw.requestAnimationFrame(onFrame);

  // Every map label is drawn inside #labelrenderer, whichever renderer draws it; its element count is what they cost the
  // page's layout and style work.
  const labelNodes = () => document.getElementById("labelrenderer")?.getElementsByTagName("*").length ?? null;
  // The selected army's stamina as its plate reads it ("Stamina 84 of 150"), or null while no army plate is selected.
  const selectedPlateStamina = () => {
    const label = document.querySelector('[data-selected="true"] .mp-stamina')?.getAttribute("aria-label");
    const reading = label ? /^Stamina ([\d,]+) of/.exec(label) : null;
    return reading ? Number(reading[1].replaceAll(",", "")) : null;
  };
  raw.setInterval(() => {
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
  const sleep = (ms) => new Promise((resolve) => raw.setTimeout(resolve, ms));
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
    /** What keeps running on its own now (see `census`), for a reader to compare with an earlier reading. */
    census() {
      return JSON.stringify(census());
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
        vertices: state.vertices.slice(fromFrame),
        gpuMemory: gpuMemory(),
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
        timeOrigin: performance.timeOrigin,
        timeline: window.__eternumGameEntryTimeline ?? [],
      });
    },
  };
})();
