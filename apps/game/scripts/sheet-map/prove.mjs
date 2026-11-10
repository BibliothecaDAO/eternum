import { createBrowserSession } from "../client-playtest/browser-session.mjs";
import { withDevClient } from "../lib/dev-client.mjs";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const option = (key, fallback) => {
  const index = process.argv.indexOf(key);
  return index < 0 ? fallback : process.argv[index + 1];
};
const out = resolve(option("--out", ".context/sheet-map-" + Date.now()));
const port = option("--port", "4199");
const base = option("--base-url", null);
const chapters = option("--chapters", "hexes,routes,ownership,strategic,sites").split(",");
const backends = option("--backends", "webgpu-auto,webgpu-force-webgl").split(",");
if (chapters.some((chapter) => !["hexes", "routes", "ownership", "strategic", "sites"].includes(chapter)))
  throw new Error("Unknown chapter");
mkdirSync(out, { recursive: false });
const records = [];
const pause = (ms) => new Promise((done) => setTimeout(done, ms));
const check = (value, message) => {
  if (!value) throw new Error(message);
};
await withDevClient({ base, port, out }, async (baseUrl) => {
  for (const backend of backends)
    for (const chapter of chapters) {
      const profile = mkdtempSync(join(tmpdir(), "sheet-map-proof-"));
      const browser = createBrowserSession("sheet-map-" + Date.now().toString(36), { profile, headed: false });
      try {
        const url = `${baseUrl}/lab/kit?chapter=hexes&rendererMode=${backend}`;
        browser.run([
          "open",
          url,
          "--ignore-https-errors",
          "--args",
          "--ignore-gpu-blocklist,--enable-gpu,--use-angle=vulkan,--enable-features=Vulkan,--enable-unsafe-webgpu",
        ]);
        browser.run(["set", "viewport", "1920", "1080"]);
        browser.run(["wait", "--fn", "!!document.querySelector('[data-map-context-world] button')"]);
        browser.click("Open 3D comparison");
        browser.run(["eval", "document.querySelector('[data-map-context-world]').scrollIntoView({block:'start'})"]);
        browser.run(["wait", "--fn", "document.querySelector('[data-map-sheet]')?.dataset.ready === 'true'"]);
        if (chapter !== "hexes")
          browser.click(
            { routes: "Paths & orders", ownership: "Ownership", strategic: "Strategic markers", sites: "Sites & fog" }[
              chapter
            ],
          );
        browser.run([
          "wait",
          "--fn",
          `document.querySelector('[data-map-sheet]')?.dataset.ready === 'true' && document.querySelector('[data-map-sheet]')?.dataset.chapter === '${chapter}'`,
        ]);
        browser.run(["mouse", "move", "10", "10"]);
        browser.run(["wait", "600"]);
        const state = browser.read(
          `JSON.stringify({route:location.pathname,mapContext:!!document.querySelector('[data-map-sheet]').closest('[data-sheet-element="Map context"]'),chapter:document.querySelector('[data-map-sheet]').dataset.chapter,labels:[...document.querySelectorAll('.map-sheet-label')].map(x=>x.textContent),headings:document.querySelector('.map-sheet-headings').innerText,labelRects:[...document.querySelectorAll(".map-sheet-label")].slice(0,3).map(x=>({rect:x.getBoundingClientRect().toJSON(),transform:x.style.transform,visibility:getComputedStyle(x).visibility})),renderer:window.__terrainVerification.getSnapshot().activeMode,terrain:window.__terrainVerification.getSnapshot().cellCount,canvas:[document.querySelector('canvas').width,document.querySelector('canvas').height]})`,
        );
        check(
          state.labels.length === { hexes: 48, routes: 24, ownership: 24, strategic: 32, sites: 32 }[chapter],
          "Missing specimens",
        );
        check(state.terrain > 0, "No native terrain");
        check(state.route === "/lab/kit" && state.mapContext, "World is outside the shared Map context");
        check(
          state.renderer === (backend === "webgpu-force-webgl" ? "webgl2-fallback" : "webgpu"),
          "Wrong renderer backend",
        );
        browser.screenshot(join(out, `${chapter}-${backend}.png`));
        const errors = browser.run(["errors"]);
        check(!errors.trim(), "Browser errors: " + errors);
        browser.click("Close 3D comparison");
        const released = browser.read(
          "JSON.stringify(!document.querySelector('[data-map-sheet]') && !window.__terrainVerification)",
        );
        check(released, "Closing the section retained its renderer");
        records.push({ backend, ...state, errors, released });
        writeFileSync(join(out, "proof.json"), JSON.stringify({ ok: false, records }, null, 2) + "\n");
        console.log("Captured " + chapter + " " + backend);
      } catch (error) {
        writeFileSync(
          join(out, `${chapter}-${backend}-failure.txt`),
          browser.run(["snapshot"]) + "\n" + browser.run(["errors"]) + "\n" + browser.run(["console"]),
        );
        browser.screenshot(join(out, `${chapter}-${backend}-failure.png`));
        throw error;
      } finally {
        browser.close();
        rmSync(profile, { recursive: true, force: true });
      }
      await pause(0);
    }
  writeFileSync(join(out, "proof.json"), JSON.stringify({ ok: true, records }, null, 2) + "\n");
});
