import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createBrowserSession } from "./client-playtest/browser-session.mjs";
import { withDevClient } from "./lib/dev-client.mjs";
import { assertBrowserClean, parseOption, recordClip } from "./lib/motion-proof.mjs";

const out = parseOption("--out", join(tmpdir(), "troop-motion-proof-" + Date.now()));
const port = parseOption("--port", "4427");
mkdirSync(out, { recursive: true });

const profile = mkdtempSync(join(tmpdir(), "troop-motion-proof-"));
const browser = createBrowserSession("troop-motion-" + Date.now(), { profile, headed: false });

await withDevClient({ base: parseOption("--base-url", null), port, out }, async (baseUrl) => {
  try {
    const clips = [];
    browser.run(["set", "viewport", "1280", "720"]);
    browser.run(["open", `${baseUrl}/lab/troop-motion?capture=1&troop=knight&action=idle&camera=desktop`]);
    browser.run([
      "wait",
      "--fn",
      "document.querySelector('[data-troop-motion-ready=\"true\"]') !== null && Boolean(window.__troopMotionLab?.ready)",
    ]);

    const meta = browser.read("window.__troopMotionLab.getMeta()");
    const troops = meta.troops;
    const actions = meta.actions;

    for (const troop of troops) {
      for (const action of actions) {
        const duration = action === "attack" ? 3000 : action === "death" ? 2500 : 2400;
        clips.push(
          recordClip(
            browser,
            out,
            `${troop}-desktop-${action}`,
            "__troopMotionLab",
            { troop, action, camera: "desktop", compareShipped: troop !== "knight" },
            duration,
          ),
        );
      }
      clips.push(
        recordClip(
          browser,
          out,
          `${troop}-reel-desktop`,
          "__troopMotionLab",
          { troop, action: "reel", camera: "desktop", compareShipped: false },
          11800,
        ),
      );
    }

    browser.run(["set", "viewport", "390", "844"]);
    for (const troop of troops) {
      for (const action of actions) {
        const duration = action === "attack" ? 3000 : action === "death" ? 2500 : 2400;
        clips.push(
          recordClip(
            browser,
            out,
            `${troop}-phone-${action}`,
            "__troopMotionLab",
            { troop, action, camera: "phone", compareShipped: troop !== "knight" },
            duration,
          ),
        );
      }
    }

    const stats = assertBrowserClean(browser, "__troopMotionLab");
    writeFileSync(join(out, "summary.json"), JSON.stringify({ capturedAt: new Date().toISOString(), clips, stats }, null, 2));
    console.log(`Troop motion proof complete: ${clips.length} clips in ${out}`);
  } finally {
    browser.close();
    rmSync(profile, { recursive: true, force: true });
  }
});
