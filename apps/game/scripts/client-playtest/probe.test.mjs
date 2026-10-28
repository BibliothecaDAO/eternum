// @vitest-environment node
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { expect, it } from "vitest";

const PROBE = readFileSync(new URL("./probe.js", import.meta.url), "utf8");

/** The probe installed on a page whose GPU queue and WebGL2 context do nothing; `frame()` ends a frame and reads its uploads. */
function probedPage() {
  class GPUQueue {
    writeBuffer() {}
  }
  class WebGL2RenderingContext {
    bufferData() {}
    bufferSubData() {}
  }
  let onFrame;
  let frames = 0;
  const window = { GPUQueue, WebGL2RenderingContext };
  vm.runInNewContext(PROBE, {
    window,
    WebSocket: class {},
    performance: { now: () => 0, timeOrigin: 0 },
    location: { origin: "https://probe.test" },
    setInterval: () => 0,
    requestAnimationFrame: (callback) => {
      onFrame = callback;
    },
    addEventListener: () => {},
    URL,
  });
  return {
    window,
    queue: new GPUQueue(),
    gl: new WebGL2RenderingContext(),
    frame() {
      frames += 1;
      onFrame(frames * 16);
      return JSON.parse(window.__playtest.read()).gpu.at(-1).uploadBytes;
    },
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

it("reports the first frame a watched condition holds in, once", () => {
  const page = probedPage();
  page.window.level = "Settlement";
  page.window.__playtest.watch("raised", 'window.level === "City"');

  page.frame();
  page.window.level = "City";
  page.frame();
  page.frame();

  expect(JSON.parse(page.window.__playtest.read()).watched).toEqual([{ name: "raised", t: 32, at: 0 }]);
});
