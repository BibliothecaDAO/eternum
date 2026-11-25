import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { spendsFragments } from "@bibliothecadao/eternum/game-client";
import { createBrowserSession } from "./client-playtest/browser-session.mjs";
import { withDevClient } from "./lib/dev-client.mjs";

const RELEASE = JSON.parse(
  readFileSync(new URL("../../../contracts/l3/world-native/schema/release-definition.json", import.meta.url), "utf8"),
);
const SEASON_SPENDS_FRAGMENTS = spendsFragments({ command_mask: BigInt(RELEASE.definition.rules.command_mask) });

/** Season 1's client presentations in the lab: each view's every case, on a desktop and on a phone, one still each. */
const VIEWS = [
  { name: "deep-site", path: "/lab/season-one/deep-site", cases: ["all"], shown: "section[role=dialog]" },
  {
    name: "quest-dock",
    path: "/lab/season-one/quest-dock",
    cases: [0, 1, 2, 3, 4, 5, 6],
    shown: "[data-quest-dock-lab]",
  },
  { name: "opening", path: "/lab/season-one/opening", cases: [0, 1, 3, 7, 8], shown: "[data-opening-line]" },
  { name: "race", path: "/lab/season-one/race", cases: [0, 1, 2], shown: "[data-race-stage][data-ready]" },
  { name: "race", path: "/lab/season-one/race", cases: [3], shown: "[data-aspect-page]" },
];
const PRESEASON_SCREENS = [
  ["preseason", "[data-season-countdown]"],
  ["preseason-member", "[data-season-countdown]"],
  ["preseason-chosen", "[data-seal-code=open]"],
  ["preseason-sealed", "[data-seal-code=held]"],
  ["preseason-invited", "[data-shared-invite]", "/s/MRGHT234"],
  ["preseason-invited-pick", "[data-aspect-invited]"],
  ["preseason-testnet", "[data-preseason-testnet]"],
  ["preseason-testnet-chosen", "[data-preseason-testnet]"],
];
const ENTRY_STEPS = [
  ["aspect-kept", "[data-order]"],
  ["realm-side", "[data-realm-side-warning]"],
];
const FRAGMENTS_URL = "/lab/app/fragments/shop?chain=0x5245414c4d53&game=1&next=%2F&capture=1";
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
  {
    file: "doorway-loading",
    url: "/lab/app/home/doorway/map?capture=1",
    shown: "[data-doorway-loading]",
    matrix: true,
  },
  {
    file: "doorway-sign-in",
    url: "/lab/app/home/doorway/sign-in?capture=1",
    shown: "[data-band=body]",
    matrix: true,
  },
  {
    file: "entry-founding",
    url: "/lab/app/realm-vault/doorway/home?capture=1",
    shown: "[data-home-picker]",
    matrix: true,
  },
  { file: "connect-start", url: "/lab/app/first-visit/connect/start?capture=1", shown: "[data-sign-in-stage]" },
  {
    file: "play-active",
    url: "/lab/app/home?capture=1",
    shown: "[data-play-page] [data-race-stage][data-ready]",
    matrix: true,
  },
  {
    file: "season-race",
    url: "/lab/app/home/season?capture=1",
    shown: "[data-season-race] [data-race-stage][data-ready]",
    matrix: true,
  },
  {
    file: "recap-season",
    url: "/lab/app/season-over/results/0x5245414c4d53-3?capture=1",
    shown: "[data-race-recap]",
    matrix: true,
  },
  { file: "shop-unified", url: "/lab/app/realm-vault/shop?capture=1", shown: "[data-shop-page]", matrix: true },
  { file: "you-profile", url: "/lab/app/realm-vault/profile?capture=1", shown: "[data-you-hub]", matrix: true },
  {
    file: "you-referrals",
    url: "/lab/app/realm-vault/profile?capture=1#referrals",
    shown: "[data-referrals-panel]",
    matrix: true,
  },
  {
    file: "you-settings",
    url: "/lab/app/realm-vault/profile/settings?capture=1",
    shown: "[data-you-tab=settings]",
    matrix: true,
  },
  { file: "state-not-found", url: "/lab/app/home/no-such-page?capture=1", shown: "[data-state-card]" },
  { file: "state-offline", url: "/offline.html", shown: "main" },
  { file: "state-locked", url: "/lab/app/home/doorway/devices?capture=1", shown: "[data-band=body]" },
  { file: "state-spectator", url: "/lab/app/home/doorway/spectator?capture=1", shown: "[data-doorway-loading]" },
  { file: "day-share", url: "/lab/app/home/share/day?capture=1", shown: ".day-card" },
  { file: "settings-no-wallet", url: "/lab/app/home/profile?capture=1#wallet", shown: "[data-payout-wallet=none]" },
  { file: "hud-build", url: "/lab/kit/hud/build", shown: "[data-build-sheet]", matrix: true },
  { file: "hud-menu", url: "/lab/kit/hud/menu", shown: 'section[aria-label="Menu"]', matrix: true },
  {
    file: "hud-quest",
    url: "/lab/kit/hud/idle",
    press: { after: "[data-daily-quest-chip]", selector: "[data-daily-quest-chip]" },
    shown: "[data-daily-quest]",
    matrix: true,
  },
  {
    file: "hud-oath-pick",
    url: "/lab/game?scenario=oath-pick&renderer=webgpu-force-webgl",
    shown: "[data-oath-pick]",
    matrix: true,
  },
  { file: "hud-research", url: "/lab/kit/hud/research", shown: 'section[aria-label="Research"]', matrix: true },
  {
    file: "hud-research-realm",
    url: "/lab/game?scenario=realm-world&renderer=webgpu-force-webgl",
    openResearch: true,
    shown: 'section[aria-label="Research"] [data-node="row-6"]',
    matrix: true,
  },
  { file: "hud-day-done", url: "/lab/kit/hud/day-done", shown: ".day-done" },
  { file: "hud-offline", url: "/lab/kit/hud/offline", shown: "[data-offline-banner]" },
  {
    file: "hud-map",
    url: "/lab/kit/unified/frontier-army",
    shown: 'header[aria-label="Game controls"], [aria-label="Frontier HUD"]',
  },
  ...(SEASON_SPENDS_FRAGMENTS
    ? [
        { file: "fragments-packs", url: FRAGMENTS_URL, shown: "[data-fragment-packs]" },
        {
          file: "fragments-pay",
          url: FRAGMENTS_URL,
          press: { after: "[data-fragment-packs]", button: "Pay $10.00" },
          shown: "[data-pay-tokens]",
        },
      ]
    : []),
];
const SIZES = [
  ["desktop", "1920", "1080"],
  ["phone", "390", "844"],
];
const MATRIX_SIZES = [
  ["360x800", "360", "800"],
  ["768x1024", "768", "1024"],
  ["1280x720", "1280", "720"],
  ["1440x900", "1440", "900"],
  ["2560x1440", "2560", "1440"],
];

const PAGES_PER_BROWSER = 20;

const option = (key, fallback) => (process.argv.includes(key) ? process.argv[process.argv.indexOf(key) + 1] : fallback);
const out = option("--out", join(homedir(), "projects/eternum-lanes/evidence/s1-client", String(Date.now())));
const port = option("--port", "4421");
mkdirSync(out, { recursive: true });
const runGroups = [
  SIZES.map(([device, width, height]) => ({ device, width, height, pages: PAGES })),
  MATRIX_SIZES.map(([device, width, height]) => ({
    device,
    width,
    height,
    pages: PAGES.filter(({ matrix }) => matrix),
  })),
];
for (const group of runGroups) {
  const jobs = group.flatMap(({ device, width, height, pages }) =>
    pages.map((page) => ({ device, width, height, ...page })),
  );
  await withDevClient({ base: option("--base-url", null), port, out }, async (baseUrl) => {
    for (let start = 0; start < jobs.length; start += PAGES_PER_BROWSER) {
      const batch = jobs.slice(start, start + PAGES_PER_BROWSER);
      const profile = mkdtempSync(join(tmpdir(), "season-one-proof-"));
      const browser = createBrowserSession(`season-one-${start}-${Date.now()}`, { profile, headed: false });
      let activeViewport = "";
      try {
        for (const { device, width, height, file, url, shown, press, openResearch } of batch) {
          const viewport = `${width}x${height}`;
          if (viewport !== activeViewport) {
            browser.run(["set", "viewport", width, height]);
            activeViewport = viewport;
          }
          browser.run(["open", `${baseUrl}${url}`]);
          try {
            if (openResearch) {
              browser.run(["wait", "--fn", `!!document.querySelector('nav[aria-label="Places"] button')`]);
              browser.tapPlace("Research");
            }
            if (press) {
              browser.run(["wait", "--fn", `!!document.querySelector('${press.after}')`]);
              browser.run(
                press.selector
                  ? ["click", press.selector]
                  : ["find", "role", "button", "click", "--name", press.button],
              );
            }
            browser.run(["wait", "--fn", `!!document.querySelector('${shown}')`]);
          } catch (error) {
            writeFileSync(join(out, `${file}-${device}-errors.txt`), browser.run(["errors"]));
            throw error;
          } finally {
            browser.screenshot(join(out, `${file}-${device}.png`));
          }
        }
        const errors = browser.run(["errors"]);
        if (errors.trim()) throw new Error(errors);
      } finally {
        browser.close();
        rmSync(profile, { recursive: true, force: true });
      }
    }
  });
}
writeFileSync(join(out, "proof.json"), JSON.stringify({ ok: true }) + "\n");
console.log(`evidence: ${out}`);
