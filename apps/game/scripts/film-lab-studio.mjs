/**
 * Films the studio (`/lab/studio`) frame by frame: the page's clock is held, and every saved frame is the world
 * advanced by exactly 1/60 s and read back from the canvas, so the footage plays evenly whatever the machine was
 * doing. A plan lists the shots; each becomes a folder of PNG frames in `--out`, with `film.json` beside them.
 *
 *   pnpm --dir apps/game film:studio --base-url https://127.0.0.1:4271 --plan <plan.json> --out <dir>
 *   [--only shot-a,shot-b] [--every 30]   (every: save one frame in N, for a quick look at a plan)
 *
 * plan.json: { "size": [1920, 1080], "mode": "frontier", "set": "world", "shots": [ { "name", "seconds",
 *   "light", "weather", "cast", "troops", "before": [{ "trigger", "args" }] played as the set is built,
 *   "warm": seconds played before the path starts, "from": seconds of the path played before the first saved frame, "path": { "keys": [...], "cues": [...] } } ] }
 *   (path as `window.__studio.path` takes it; a key's target may be a hex of the set, { "col", "row", "up" })
 *
 * It drives the browser it starts (`--browser`, default brave-browser) over the DevTools protocol and closes it
 * however the run ends. The dev client is the caller's: `pnpm dev --host 127.0.0.1 --port <port> --strictPort`.
 */
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
};
const base = arg("--base-url", "https://127.0.0.1:4271").replace(/\/$/, "");
const plan = JSON.parse(readFileSync(resolve(arg("--plan")), "utf8"));
const out = resolve(arg("--out"));
const only = arg("--only", "").split(",").filter(Boolean);
const every = Number(arg("--every", "1"));
const [width, height] = plan.size ?? [1920, 1080];
const STEP_MS = 1000 / 60;

/**
 * Runs in the page before its scripts. Until `hold()`, time is the browser's. After it, `performance.now()` and the
 * animation frame callbacks move only on `step()`: one call runs the frame callbacks once, 1/60 s later.
 */
const HELD_CLOCK = `(() => {
  const realNow = performance.now.bind(performance);
  const realRaf = window.requestAnimationFrame.bind(window);
  const realCancel = window.cancelAnimationFrame.bind(window);
  let held = false, now = 0, nextId = 1e9;
  const queue = new Map();
  performance.now = () => (held ? now : realNow());
  window.requestAnimationFrame = (callback) => {
    if (!held) return realRaf(callback);
    queue.set(++nextId, callback);
    return nextId;
  };
  window.cancelAnimationFrame = (id) => (queue.delete(id) ? undefined : realCancel(id));
  window.__film = {
    hold() {
      if (held) return;
      now = realNow();
      held = true;
      // The frame the browser already owes the page is the first one played by hand.
      realRaf((time) => void time);
    },
    step() {
      now += ${STEP_MS};
      const callbacks = [...queue.values()];
      queue.clear();
      for (const callback of callbacks) callback(now);
    },
    async frame() {
      const canvas = document.querySelector("[data-studio-lab] canvas");
      const blob = await new Promise((done) => canvas.toBlob(done, "image/png"));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let text = "";
      for (let at = 0; at < bytes.length; at += 32768) text += String.fromCharCode(...bytes.subarray(at, at + 32768));
      return btoa(text);
    },
  };
})();`;

const profile = mkdtempSync(join(tmpdir(), "film-studio-"));
const browser = spawn(
  arg("--browser", "brave-browser"),
  [
    "--headless=new",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`,
    "--ignore-certificate-errors",
    "--ignore-gpu-blocklist",
    "--enable-gpu",
    "--use-angle=vulkan",
    "--enable-features=Vulkan",
    "--enable-unsafe-webgpu",
    "--hide-scrollbars",
    "--no-first-run",
    "about:blank",
  ],
  { stdio: ["ignore", "ignore", "pipe"] },
);
const close = () => {
  if (browser.exitCode === null) browser.kill("SIGTERM");
  rmSync(profile, { recursive: true, force: true });
};
process.on("exit", close);
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => process.exit(1));

const endpoint = await new Promise((done, fail) => {
  let log = "";
  browser.stderr.on("data", (chunk) => {
    log += chunk;
    const found = log.match(/DevTools listening on (ws:\/\/\S+)/);
    if (found) done(found[1]);
  });
  browser.once("exit", () => fail(new Error(`The browser did not start: ${log}`)));
});

/** One DevTools connection: `send(method, params, sessionId)` resolves with the result. */
async function connect(url) {
  const socket = new WebSocket(url);
  await new Promise((done, fail) => {
    socket.onopen = done;
    socket.onerror = () => fail(new Error("DevTools connection failed"));
  });
  const waiting = new Map();
  let nextId = 0;
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    const pending = waiting.get(message.id);
    if (!pending) return;
    waiting.delete(message.id);
    if (message.error) pending.fail(new Error(message.error.message));
    else pending.done(message.result);
  };
  return (method, params = {}, sessionId) =>
    new Promise((done, fail) => {
      const id = ++nextId;
      waiting.set(id, { done, fail });
      socket.send(JSON.stringify({ id, method, params, sessionId }));
    });
}

const send = await connect(endpoint);
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
const page = (method, params) => send(method, params, sessionId);
/** Evaluates in the page and returns the value; a promise is awaited. */
const read = async (expression) => {
  const { result, exceptionDetails } = await page("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
  return result.value;
};
const until = async (expression, seconds, what) => {
  const deadline = Date.now() + seconds * 1000;
  while (!(await read(expression))) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}`);
    await new Promise((done) => setTimeout(done, 250));
  }
};

await page("Page.enable");
await page("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
await page("Page.addScriptToEvaluateOnNewDocument", { source: HELD_CLOCK });

mkdirSync(out, { recursive: true });
const film = { base, size: [width, height], adapter: null, shots: [] };
const query = new URLSearchParams({ mode: plan.mode ?? "frontier", clean: "1", capture: "1" });
if (plan.set) query.set("set", plan.set);

for (const shot of plan.shots) {
  if (only.length > 0 && !only.includes(shot.name)) continue;
  const started = Date.now();
  // Every shot starts on a page loaded for it: nothing a shot before it played is left on the set.
  await page("Page.navigate", { url: `${base}/lab/studio?${query}` });
  await until("document.querySelector('[data-studio-lab]')?.dataset.ready === 'true'", 180, "the studio's set");
  film.adapter ??= await read(
    "(async()=>{const a=await navigator.gpu?.requestAdapter();return a?{vendor:a.info.vendor,architecture:a.info.architecture,fallback:a.info.isFallbackAdapter}:null})()",
  );
  if (!film.adapter || film.adapter.fallback) throw new Error("The studio is not rendering on a hardware GPU");
  await read(`(() => {
    const studio = window.__studio, shot = ${JSON.stringify(shot)};
    // The clock is held before the set is reset, so the world's first instant is the same for every shot.
    window.__film.hold();
    studio.time({ scale: 1, fixedStep: true });
    if (shot.light !== undefined) studio.light(shot.light);
    if (shot.weather) studio.weather(shot.weather);
    if (shot.troops) studio.troops(shot.troops);
    studio.reset(shot.cast);
    for (const { trigger, args } of shot.before ?? []) studio.trigger(trigger, args);
    // A target given as a hex of the set is framed where that hex lies on the ground.
    for (const key of shot.path.keys) {
      if (!key.target || Array.isArray(key.target)) continue;
      const [x, y, z] = studio.at(key.target);
      key.target = [x, y + (key.target.up ?? 0), z];
    }
    window.__filmPath = shot.path;
    if (shot.path.keys[0]) studio.pose(shot.path.keys[0]);
  })()`);
  // Models and textures still arriving get the browser's own time to land; the world does not move meanwhile.
  await new Promise((done) => setTimeout(done, (shot.settle ?? 2) * 1000));
  for (let frame = 0; frame < Math.round((shot.warm ?? 0) * 60); frame += 1) await read("window.__film.step()");
  await read("void window.__studio.path(window.__filmPath)");
  const directory = join(out, shot.name);
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });
  const first = Math.round((shot.from ?? 0) * 60);
  const frames = Math.round(shot.seconds * 60);
  let saved = 0;
  for (let frame = -first; frame < frames; frame += 1) {
    await read("window.__film.step()");
    if (frame < 0 || frame % every !== 0) continue;
    const png = await read("window.__film.frame()");
    writeFileSync(join(directory, `f${String(saved).padStart(5, "0")}.png`), Buffer.from(png, "base64"));
    saved += 1;
  }
  const status = await read("window.__studio.status()");
  film.shots.push({ name: shot.name, frames, saved, filmSeconds: (Date.now() - started) / 1000, end: status });
  writeFileSync(join(out, "film.json"), JSON.stringify(film, null, 2) + "\n");
  console.log(`${shot.name}: ${saved} frames in ${Math.round((Date.now() - started) / 1000)} s`);
}

process.exit(0);
