import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { createBrowserSession } from "./client-playtest/browser-session.mjs";
import { withDevClient } from "./lib/dev-client.mjs";

/** Season 1's client presentations in the lab: each view's every case, on a desktop and on a phone, one still each. */
const VIEWS = [
  { name: "deep-site", path: "/lab/season-one/deep-site", cases: [0, 1, 2, 3, 4], shown: "section[role=dialog]" },
  { name: "day-banner", path: "/lab/season-one/day-banner", cases: [0, 1, 2, 3, 4, 5, 6], shown: "[data-day-banner]" },
  { name: "opening", path: "/lab/season-one/opening", cases: [0, 1, 3, 7, 8], shown: "[data-opening-line]" },
  { name: "race", path: "/lab/season-one/race", cases: [0, 1, 2, 3], shown: "[data-aspect-page]" },
];
const SIZES = [
  ["desktop", "1920", "1080"],
  ["phone", "390", "844"],
];

const option = (key, fallback) => (process.argv.includes(key) ? process.argv[process.argv.indexOf(key) + 1] : fallback);
const out = option("--out", join(homedir(), "projects/eternum-lanes/evidence/s1-client", String(Date.now())));
const port = option("--port", "4421");
mkdirSync(out, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), "season-one-proof-"));
const browser = createBrowserSession("season-one-" + Date.now(), { profile, headed: false });
await withDevClient({ base: option("--base-url", null), port, out }, async (baseUrl) => {
  try {
    for (const [device, width, height] of SIZES) {
      browser.run(["set", "viewport", width, height]);
      for (const { name, path, cases, shown } of VIEWS)
        for (const each of cases) {
          browser.run(["open", `${baseUrl}${path}?case=${each}`]);
          browser.run(["wait", "--fn", `!!document.querySelector('${shown}')`]);
          browser.screenshot(join(out, `${name}-${each}-${device}.png`));
        }
    }
    const errors = browser.run(["errors"]);
    if (errors.trim()) throw new Error(errors);
    writeFileSync(join(out, "proof.json"), JSON.stringify({ ok: true }) + "\n");
  } finally {
    browser.close();
    rmSync(profile, { recursive: true, force: true });
  }
});
console.log(`evidence: ${out}`);
