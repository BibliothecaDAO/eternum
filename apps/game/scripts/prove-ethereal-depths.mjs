import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createBrowserSession } from "./client-playtest/browser-session.mjs";
import { withDevClient } from "./lib/dev-client.mjs";
import { writeDepthGallery } from "./ethereal-depths-gallery.mjs";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
};
const out = resolve(arg("--out", `.context/ethereal-depths-${Date.now()}`));
const sets = JSON.parse(readFileSync(new URL("../src/lab/ethereal-depths/looks.json", import.meta.url)));
const shots = [];
mkdirSync(out, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), "ethereal-depths-"));
const browser = createBrowserSession(`ethereal-${Date.now().toString(36)}`, { profile, headed: false });
const cases = [
  { set: "current", depth: "1", title: "Current · all depths" },
  ...Object.entries(sets).flatMap(([set, value]) =>
    Object.entries(value.depths).map(([depth, look]) => ({ set, depth, title: `${value.title} · ${look.title}` })),
  ),
];

try {
  await withDevClient({ base: arg("--base-url", null), port: arg("--port", "4197"), out }, async (base) => {
    browser.run([
      "open",
      "about:blank",
      "--ignore-https-errors",
      "--args",
      "--ignore-gpu-blocklist,--enable-gpu,--use-angle=vulkan,--enable-features=Vulkan,--enable-unsafe-webgpu",
    ]);
    for (const [device, width, height] of [
      ["desktop", 1440, 900],
      ["phone", 390, 844],
    ]) {
      browser.run(["set", "viewport", String(width), String(height)]);
      for (const entry of cases) {
        const url = `${base}/lab/ethereal-depths?capture=1&set=${entry.set}&depth=${entry.depth}`;
        browser.run(["open", url, "--ignore-https-errors"]);
        browser.run([
          "wait",
          "--fn",
          "document.querySelector('[data-depth-study]')?.dataset.ready === 'true'",
          "--timeout",
          "55000",
        ]);
        const state = browser.read(
          "JSON.stringify({stats: window.__terrainVerification.getSnapshot(), labels: [...document.querySelectorAll('[data-scale-label]')].map(e => ({text:e.textContent, x:e.getBoundingClientRect().x, y:e.getBoundingClientRect().y})), title:document.querySelector('h1').textContent})",
        );
        const file = `${entry.set}-${entry.depth}-${device}.png`;
        browser.screenshot(join(out, file));
        shots.push({ ...entry, device, width, height, url, file, state });
        if (state.labels.length !== 2 || state.labels.some((p) => p.x < 0 || p.x > width || p.y < 0 || p.y > height))
          throw new Error(`Scale labels outside ${device} frame`);
        const errors = browser.run(["errors"]);
        if (errors.trim()) throw new Error(errors);
        browser.run(["open", "about:blank"]);
        console.log(file);
      }
    }
  });
  writeDepthGallery(out, sets, shots);
} finally {
  browser.close();
  rmSync(profile, { recursive: true, force: true });
  writeFileSync(join(out, "captures.json"), JSON.stringify({ shots }, null, 2) + "\n");
}
