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
  { name: "race", path: "/lab/season-one/race", cases: [0, 1, 2], shown: "[data-aspect-race]" },
  { name: "race", path: "/lab/season-one/race", cases: [3], shown: "[data-aspect-page]" },
];
const PRESEASON_SCREENS = [
  ["preseason", "[data-season-countdown]"],
  ["preseason-member", "[data-preseason-step=pick]"],
  ["preseason-chosen", "[data-seal-code=open]"],
  ["preseason-sealed", "[data-seal-code=held]"],
  ["preseason-invited", "[data-shared-invite]", "/s/MRGHT234"],
  ["preseason-invited-pick", "[data-aspect-invited]"],
];
const ENTRY_STEPS = [
  ["aspect-kept", "[data-order]"],
  ["realm-side", "[data-realm-side-warning]"],
];
const FRAGMENTS_URL = "/lab/app/fragments/shop/fragments?chain=0x5245414c4d53&game=1&next=%2F&capture=1";
const PAGES = [
  ...VIEWS.flatMap(({ name, path, cases, shown }) =>
    cases.map((each) => ({ file: `${name}-${each}`, url: `${path}?case=${each}`, shown })),
  ),
  ...PRESEASON_SCREENS.map(([screen, shown, page = ""]) => ({
    file: `countdown-${screen}`,
    url: `/lab/app/${screen}${page}?capture=1`,
    shown,
  })),
  ...ENTRY_STEPS.map(([state, shown]) => ({
    file: `entry-${state}`,
    url: `/lab/app/wallet-ready/doorway/${state}?capture=1`,
    shown,
  })),
  { file: "doorway-loading", url: "/lab/app/home/doorway/map?capture=1", shown: "[data-doorway-loading]" },
  { file: "settings-no-wallet", url: "/lab/app/home/profile/settings?capture=1", shown: "[data-payout-wallet=none]" },
  { file: "hud-build", url: "/lab/kit/hud/build", shown: "[data-build-sheet]" },
  { file: "hud-research", url: "/lab/kit/hud/research", shown: 'section[aria-label="Research"]' },
  { file: "hud-day-done", url: "/lab/kit/hud/day-done", shown: ".day-done" },
  {
    file: "hud-map",
    url: "/lab/kit/unified/frontier-army",
    shown: 'header[aria-label="Game controls"], [aria-label="Frontier HUD"]',
  },
  { file: "fragments-packs", url: FRAGMENTS_URL, shown: "[data-fragment-packs]" },
  {
    file: "fragments-pay",
    url: FRAGMENTS_URL,
    press: { after: "[data-fragment-packs]", button: "Pay $10.00" },
    shown: "[data-pay-tokens]",
  },
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
      for (const { file, url, shown, press } of PAGES) {
        browser.run(["open", `${baseUrl}${url}`]);
        try {
          if (press) {
            browser.run(["wait", "--fn", `!!document.querySelector('${press.after}')`]);
            browser.run(["find", "role", "button", "click", "--name", press.button]);
          }
          browser.run(["wait", "--fn", `!!document.querySelector('${shown}')`]);
        } catch (error) {
          writeFileSync(join(out, `${file}-${device}-errors.txt`), browser.run(["errors"]));
          throw error;
        } finally {
          browser.screenshot(join(out, `${file}-${device}.png`));
        }
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
