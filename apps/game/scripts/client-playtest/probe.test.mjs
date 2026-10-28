// @vitest-environment node
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { expect, it } from "vitest";

const PROBE = readFileSync(new URL("./probe.js", import.meta.url), "utf8");

/**
 * The probe installed on a page whose GPU device, queue, render pass and WebGL2 context do nothing; `frame()` ends a
 * frame and reads what the probe recorded for it.
 */
function probedPage() {
  let now = 0;
  const gpuDone = [];
  class GPUQueue {
    writeBuffer() {}
    submit() {}
    onSubmittedWorkDone() {
      return new Promise((resolve) => gpuDone.push(resolve));
    }
  }
  class GPUTexture {
    destroy() {}
  }
  class GPUBuffer {
    destroy() {}
  }
  class GPUDevice {
    createTexture() {
      return new GPUTexture();
    }
    createBuffer() {
      return new GPUBuffer();
    }
  }
  class GPURenderPassEncoder {
    draw() {}
    drawIndexed() {}
  }
  class WebGL2RenderingContext {
    bufferData() {}
    bufferSubData() {}
    drawArrays() {}
    drawElementsInstanced() {}
  }
  let pending = [];
  let frames = 0;
  const window = { GPUBuffer, GPUDevice, GPUQueue, GPURenderPassEncoder, GPUTexture, WebGL2RenderingContext };
  const page = {
    window,
    WebSocket: class {},
    performance: { now: () => now, timeOrigin: 0 },
    location: { origin: "https://probe.test" },
    setInterval: () => 0,
    clearInterval: () => {},
    setTimeout: () => 0,
    requestAnimationFrame: (callback) => pending.push(callback),
    addEventListener: () => {},
    URL,
  };
  vm.runInNewContext(PROBE, page);
  // Every frame callback due runs, the probe's own and the page's, each scheduling its next.
  const lastFrame = () => {
    frames += 1;
    const due = pending;
    pending = [];
    due.forEach((callback) => callback(frames * 16));
    return JSON.parse(window.__playtest.read());
  };
  return {
    /** The page's own frame loop: each frame's callback runs for `ms`. */
    animate(ms) {
      const loop = () => {
        now += ms;
        page.requestAnimationFrame(loop);
      };
      page.requestAnimationFrame(loop);
    },
    /** One submit whose work the GPU reports done `ms` later. */
    async submitTakingGpu(ms) {
      this.queue.submit([]);
      now += ms;
      gpuDone.shift()();
      await Promise.resolve();
    },
    callbackMs: () => lastFrame().callbackMs.at(-1),
    gpuDoneMs: () => lastFrame().gpuDoneMs.at(-1),
    device: new GPUDevice(),
    pass: new GPURenderPassEncoder(),
    queue: new GPUQueue(),
    gl: new WebGL2RenderingContext(),
    frame: () => lastFrame().gpu.at(-1).uploadBytes,
    vertices: () => lastFrame().vertices.at(-1),
    gpuMemory: () => lastFrame().gpuMemory,
  };
}

it("counts a WebGPU upload's bytes, a typed array's offset and size being its elements and an ArrayBuffer's bytes", () => {
  const page = probedPage();
  const floats = new Float32Array(8);

  page.queue.writeBuffer({}, 0, floats, 2, 4);
  expect(page.frame()).toBe(16);
  page.queue.writeBuffer({}, 0, floats, 2);
  expect(page.frame()).toBe(24);
  page.queue.writeBuffer({}, 0, floats);
  expect(page.frame()).toBe(32);
  page.queue.writeBuffer({}, 0, floats.buffer, 8, 12);
  expect(page.frame()).toBe(12);
  page.queue.writeBuffer({}, 0, floats.buffer, 8);
  expect(page.frame()).toBe(24);
});

it("counts a WebGL2 upload's bytes the same way, a zero length running to the end", () => {
  const page = probedPage();
  const shorts = new Uint16Array(10);

  page.gl.bufferData(0, shorts, 0, 4, 3);
  expect(page.frame()).toBe(6);
  page.gl.bufferData(0, shorts, 0, 4, 0);
  expect(page.frame()).toBe(12);
  page.gl.bufferData(0, 64, 0);
  expect(page.frame()).toBe(64);
  page.gl.bufferSubData(0, 0, shorts, 6);
  expect(page.frame()).toBe(8);
  page.gl.bufferSubData(0, 0, shorts.buffer);
  expect(page.frame()).toBe(20);
});

it("counts the vertices a frame drew, instances included, WebGPU's and WebGL2's", () => {
  const page = probedPage();

  page.pass.drawIndexed(300, 4);
  page.pass.draw(6);
  page.gl.drawElementsInstanced(4, 36, 0, 0, 10);
  page.gl.drawArrays(4, 0, 3);
  expect(page.vertices()).toBe(1200 + 6 + 360 + 3);
  expect(page.vertices()).toBe(0);
});

it("holds each WebGPU texture's and buffer's size from its creation until it is destroyed", () => {
  const page = probedPage();

  const colour = page.device.createTexture({ size: [1024, 1024], format: "rgba8unorm", mipLevelCount: 11 });
  page.device.createTexture({ size: { width: 512, height: 512, depthOrArrayLayers: 4 }, format: "astc-4x4-unorm" });
  const vertices = page.device.createBuffer({ size: 4096 });
  expect(page.gpuMemory()).toEqual({
    textures: 2,
    textureBytes: Math.round((1024 * 1024 * 4 * 4) / 3) + 512 * 512 * 4,
    buffers: 1,
    bufferBytes: 4096,
  });

  colour.destroy();
  vertices.destroy();
  expect(page.gpuMemory()).toEqual({ textures: 1, textureBytes: 512 * 512 * 4, buffers: 0, bufferBytes: 0 });
});

it("times the page's frame callbacks per frame: the script time a 60 Hz interval hides", () => {
  const page = probedPage();

  page.animate(5);
  page.callbackMs();
  expect(page.callbackMs()).toBe(5);
});

it("times a frame's GPU work from its first submit to the GPU reporting it done", async () => {
  const page = probedPage();

  await page.submitTakingGpu(3);
  await page.submitTakingGpu(4);
  expect(page.gpuDoneMs()).toBe(7);
  expect(page.gpuDoneMs()).toBe(null);
});
