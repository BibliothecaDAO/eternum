#!/usr/bin/env node
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const OUT = join(here, "../../game/public/docs-media");
const MEDIA = JSON.parse(readFileSync(join(here, "../media.json"), "utf8"));
// A page's size, its pixel density, the width a screenshot is published at, and a video's size. `game` is the live
// client at the size its playtest measures tiles in, published as a desktop capture.
const FRAMES = {
  desktop: { width: 1280, height: 720, scale: 1.25, shot: 1600, video: [1280, 720] },
  game: { width: 1920, height: 1080, scale: 1, shot: 1600, video: [1280, 720] },
  phone: { width: 405, height: 720, scale: 2, shot: 780, video: [720, 1280] },
  // A panel cropped out of a desktop page (`crop`), kept at its own shape.
  panel: { width: 1280, height: 720, scale: 2, shot: 900, video: [1280, 720] },
};
const VIDEO_BUDGET = 2.5 * 1024 * 1024;
const SHOT_BUDGET = 250 * 1024;
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, index, all) => {
    if (arg.startsWith("--")) pairs.push([arg.slice(2), all[index + 1]]);
    return pairs;
  }, []),
);
if (!args.base) throw new Error("--base <running dev client> is required");
const only = args.only ? new Set(args.only.split(",")) : null;

/** A headless Chromium of our own, on the GPU, its DevTools on a free port; `close` ends it and its profile. */
async function launchBrowser(executable) {
  const profile = mkdtempSync(join(tmpdir(), "docs-media-"));
  const child = spawn(
    executable,
    [
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "--ignore-certificate-errors",
      "--ignore-gpu-blocklist",
      "--enable-gpu",
      "--use-angle=vulkan",
      "--enable-features=Vulkan",
      "--enable-unsafe-webgpu",
      "--hide-scrollbars",
      "--mute-audio",
      "--no-first-run",
      "about:blank",
    ],
    { detached: true, stdio: ["ignore", "ignore", "pipe"] },
  );
  const ws = await new Promise((resolve, reject) => {
    let log = "";
    child.stderr.on("data", (chunk) => {
      log += chunk;
      const match = log.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) resolve(match[1]);
    });
    child.once("exit", () => reject(new Error(`browser exited: ${log}`)));
  });
  const exited = new Promise((done) => child.once("exit", done));
  return {
    ws,
    close: async () => {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {}
      await exited;
      // The browser's helper processes let go of the profile a moment after it exits.
      rmSync(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
    },
  };
}

/** The DevTools protocol over one WebSocket, with one page attached as a flat session. */
async function openPage(wsUrl) {
  const socket = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });
  let id = 0;
  const pending = new Map();
  const listeners = new Set();
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);
    } else if (message.method) for (const listener of listeners) listener(message);
  };
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      pending.set(++id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params, sessionId }));
    });
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const page = (method, params) => send(method, params, sessionId);
  await page("Page.enable");
  await page("Runtime.enable");
  return {
    send: page,
    on: (listener) => listeners.add(listener),
    off: (listener) => listeners.delete(listener),
    close: () => socket.close(),
  };
}

const evaluate = async (page, expression) => {
  const { result, exceptionDetails } = await page.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (exceptionDetails) throw new Error(`${expression.slice(0, 80)}: ${exceptionDetails.exception?.description}`);
  return result.value;
};

const urlOf = (path) => new URL(path, args.base).href;

/** Waits until `expression` is truthy in the page, up to `ms`. */
async function waitUntil(page, expression, ms = 30_000) {
  const deadline = Date.now() + ms;
  while (!(await evaluate(page, `Boolean(${expression})`))) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${expression}`);
    await sleep(250);
  }
}

const centerOf = (selector) =>
  `(() => { const el = ${selector}; if (!el) return null; el.scrollIntoView({ block: "center" });
     const r = el.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`;
const byText = (text) =>
  `[...document.querySelectorAll("button, a, [role=button], [role=tab]")].find((el) => el.textContent.trim() === ${JSON.stringify(text)})`;

async function pointer(page, [x, y], button = "left") {
  await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button, clickCount: 1 });
  await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button, clickCount: 1 });
}

async function tapUntil(page, { offsets, waitFor, dismiss = "Escape", button = "left", around = "center" }) {
  const origin = await evaluate(
    page,
    around === "army"
      ? `(() => {
          const slot = [...document.querySelectorAll('.mp-at[data-key^="army:"]')].find((el) => el.firstElementChild && getComputedStyle(el).display !== "none");
          if (!slot) return [innerWidth / 2, innerHeight / 2];
          const r = slot.firstElementChild.getBoundingClientRect();
          return [r.left + r.width / 2, r.top + r.height / 2 + 100];
        })()`
      : "[innerWidth / 2, innerHeight / 2]",
  );
  for (const [dx, dy] of offsets) {
    await pointer(page, [origin[0] + dx, origin[1] + dy], button);
    await sleep(900);
    if (await evaluate(page, `Boolean(document.querySelector(${JSON.stringify(waitFor)}))`)) return;
    if (dismiss) {
      for (const type of ["keyDown", "keyUp"]) await page.send("Input.dispatchKeyEvent", { type, key: dismiss });
      await sleep(300);
    }
  }
  throw new Error(`tapUntil did not open ${waitFor}`);
}

async function step(page, action) {
  if (action.optional) {
    try {
      return await step(page, { ...action, optional: false });
    } catch {
      return;
    }
  }
  if (action.tapUntil) await tapUntil(page, action.tapUntil);
  else if (action.open) {
    await page.send("Page.navigate", { url: urlOf(action.open) });
    await sleep(500);
    await waitUntil(page, 'document.readyState === "complete"', 90_000);
  } else if (action.wait) await sleep(action.wait);
  else if (action.waitFor)
    await waitUntil(page, `document.querySelector(${JSON.stringify(action.waitFor)})`, action.ms);
  else if (action.until) await waitUntil(page, action.until, action.ms);
  else if (action.click || action.clickText) {
    const target = action.click ? `document.querySelector(${JSON.stringify(action.click)})` : byText(action.clickText);
    const at = await evaluate(page, centerOf(target));
    if (!at) throw new Error(`nothing to click: ${action.click ?? action.clickText}`);
    await pointer(page, at, action.button);
  } else if (action.key)
    for (const type of ["keyDown", "keyUp"]) await page.send("Input.dispatchKeyEvent", { type, key: action.key });
  else if (action.eval) await evaluate(page, action.eval);
  else throw new Error(`unknown step ${JSON.stringify(action)}`);
}

async function setFrame(page, frame) {
  const { width, height, scale } = FRAMES[frame];
  await page.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: scale,
    mobile: frame === "phone",
    screenWidth: width,
    screenHeight: height,
  });
  await page.send("Emulation.setTouchEmulationEnabled", { enabled: frame === "phone", maxTouchPoints: 5 });
}

const kib = (file) => Math.round(statSync(file).size / 1024);

/** The part of the page a cropped screenshot keeps: `crop`'s element, with a margin. */
async function cropOf(page, expression) {
  const rect = await evaluate(
    page,
    `(() => { const el = ${expression}; if (!el) return null; const r = el.getBoundingClientRect();
       return { x: Math.max(0, r.x - 8), y: Math.max(0, r.y - 8), width: r.width + 16, height: r.height + 16, scale: 1 }; })()`,
  );
  if (!rect || rect.width < 40 || rect.height < 40) throw new Error(`nothing visible to crop to: ${expression}`);
  return rect;
}

async function shot(page, item) {
  const clip = item.crop ? await cropOf(page, item.crop) : undefined;
  const { data } = await page.send("Page.captureScreenshot", { format: "png", ...(clip ? { clip } : {}) });
  const png = join(tmpdir(), `docs-media-${process.pid}.png`);
  writeFileSync(png, Buffer.from(data, "base64"));
  const file = join(OUT, `${item.name}.webp`);
  mkdirSync(dirname(file), { recursive: true });
  for (const quality of [82, 72, 60]) {
    execFileSync("ffmpeg", [
      "-y",
      "-loglevel",
      "error",
      "-i",
      png,
      "-vf",
      `scale='min(iw,${FRAMES[item.frame].shot})':-2:flags=lanczos`,
      "-c:v",
      "libwebp",
      "-quality",
      String(quality),
      file,
    ]);
    if (statSync(file).size <= SHOT_BUDGET) break;
  }
  rmSync(png);
  if (statSync(file).size > SHOT_BUDGET) throw new Error(`${item.name}.webp is ${kib(file)} KiB`);
  if (statSync(file).size < 2048) throw new Error(`${item.name}.webp is empty`);
  return [`${item.name}.webp ${kib(file)} KiB`];
}

/** A video, its frames held in a folder of their own that goes whatever happens. */
async function clip(page, item) {
  const frames = mkdtempSync(join(tmpdir(), "docs-media-frames-"));
  try {
    return await recordClip(page, item, frames);
  } finally {
    rmSync(frames, { recursive: true, force: true });
  }
}

async function recordClip(page, item, frames) {
  const times = [];
  const onFrame = ({ method, params }) => {
    if (method !== "Page.screencastFrame") return;
    writeFileSync(join(frames, `${String(times.length).padStart(6, "0")}.jpg`), Buffer.from(params.data, "base64"));
    times.push(params.metadata.timestamp);
    page.send("Page.screencastFrameAck", { sessionId: params.sessionId }).catch(() => {});
  };
  const [width, height] = FRAMES[item.frame].video;
  const frame = FRAMES[item.frame];
  // The screencast's frames are the page scaled to the video's width; a crop is given in the page's own pixels.
  const toFrame = width / frame.width;
  const [cx, cy, cw, ch] = (item.cropRect ?? [0, 0, frame.width, frame.height]).map((v) => Math.round(v * toFrame));
  const even = (v) => v - (v % 2);
  const size = item.cropRect ? `scale=${width}:-2` : `scale=${width}:${height}`;
  page.on(onFrame);
  await page.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: width, maxHeight: height });
  const started = Date.now();
  try {
    for (const action of item.record) await step(page, action);
    await sleep(Math.max(0, started + item.seconds * 1000 - Date.now()));
  } finally {
    await page.send("Page.stopScreencast");
    page.off(onFrame);
  }
  if (times.length < 2) throw new Error(`${item.name}: only ${times.length} frames`);
  // Each frame is held until the next came, the compositor's own timing, then resampled to a constant 30 fps.
  const list = times.map(
    (t, i) =>
      `file '${join(frames, `${String(i).padStart(6, "0")}.jpg`)}'\nduration ${((times[i + 1] ?? t + 1 / 30) - t).toFixed(4)}`,
  );
  writeFileSync(join(frames, "list.txt"), `${list.join("\n")}\n`);
  const file = join(OUT, `${item.name}.mp4`);
  mkdirSync(dirname(file), { recursive: true });
  for (const crf of [26, 30, 34]) {
    execFileSync("ffmpeg", [
      "-y",
      "-loglevel",
      "error",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      join(frames, "list.txt"),
      "-vf",
      `fps=30,crop=${even(cw)}:${even(ch)}:${cx}:${cy},${size}:flags=lanczos,format=yuv420p`,
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-crf",
      String(crf),
      "-an",
      "-movflags",
      "+faststart",
      "-threads",
      "4",
      file,
    ]);
    if (statSync(file).size <= VIDEO_BUDGET) break;
  }
  const poster = join(OUT, `${item.name}.webp`);
  execFileSync("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-i",
    file,
    "-frames:v",
    "1",
    "-c:v",
    "libwebp",
    "-quality",
    "80",
    poster,
  ]);
  if (statSync(file).size > VIDEO_BUDGET) throw new Error(`${item.name}.mp4 is ${kib(file)} KiB`);
  const seconds = (times.at(-1) - times[0]).toFixed(1);
  return [
    `${item.name}.mp4 ${kib(file)} KiB, ${times.length} frames over ${seconds} s`,
    `${item.name}.webp ${kib(poster)} KiB`,
  ];
}

async function capture(page, item) {
  await page.send("Page.navigate", { url: "about:blank" });
  await sleep(200);
  await setFrame(page, item.frame);
  for (const action of item.setup ?? []) await step(page, action);
  return item.record ? clip(page, item) : shot(page, item);
}

const browser = await launchBrowser(args.browser ?? "brave-browser");
const results = [];
try {
  const page = await openPage(browser.ws);
  await page.send("Network.enable");
  for (const item of MEDIA) {
    if (only && !only.has(item.name)) continue;
    try {
      results.push({ name: item.name, files: await capture(page, item) });
    } catch (error) {
      results.push({ name: item.name, failed: error.message });
    }
    console.log(JSON.stringify(results.at(-1)));
  }
  page.close();
} finally {
  await browser.close();
}
const failed = results.filter((result) => result.failed);
if (failed.length) process.exit(1);
