import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import {
  expectedPageIcons,
  forbiddenModePages,
  frontierGuardPhrases,
  frontierPhrases,
  loadBalanceSources,
  missingIcons,
  missingPhrases,
  pageLine,
} from "./check-rendered-balance.mjs";
import { LAYER_NAMES } from "@bibliothecadao/types";

const dist = fileURLToPath(new URL("../dist", import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), "rendered-balance-"));
after(() => rmSync(scratch, { recursive: true, force: true }));
const sources = await loadBalanceSources();
const {
  frontierPreset: current,
  frontierConfig,
  historicalFrontierPreset: historical,
  nativeFragments,
  nativeOaths,
  nativeRace,
  nativeRules,
} = sources;
const pages = frontierPhrases(frontierConfig, current, nativeRules, nativeFragments, nativeOaths, nativeRace, sources);
const n = (value) => value.toLocaleString("en-US");
const range = (lower, upper) => `${n(lower)}–${n(upper)}`;

test("built current guides match the active preset, including its balance overrides", () => {
  assert.notEqual(current.id, historical.id, "current guides must not select the historical preset");
  assert.deepEqual(missingPhrases(dist, pages), []);
  assert.deepEqual(missingIcons(dist, expectedPageIcons(sources)), []);
});

test("the expedition and beasts guides give reveal pay and guards for the personal depths only, never the shared Deep", () => {
  const deepName = LAYER_NAMES.at(-1);
  assert.ok(current.deep, "the current preset has a shared Deep");
  const expedition = pageLine(readFileSync(join(dist, "frontier/expedition", "index.html"), "utf8"));
  const beasts = pageLine(readFileSync(join(dist, "frontier/beasts", "index.html"), "utf8"));
  assert.ok(!new RegExp(`\\b${deepName} \\d+%`).test(expedition), "the Deep pays no reveal reward");
  assert.ok(!new RegExp(`\\b${deepName} (?:\\S+ )?[\\d,]+–`).test(beasts), "the Deep has no camp or rift guard row");
});

function rejectsStaleValue(page, currentText, historicalText) {
  assert.notEqual(currentText, historicalText, "the regression must change a current value");
  const original = pageLine(readFileSync(join(dist, page, "index.html"), "utf8"));
  assert.ok(original.includes(currentText), `the built ${page} must contain ${currentText}`);
  const stale = original.replace(currentText, historicalText);
  mkdirSync(join(scratch, page), { recursive: true });
  writeFileSync(join(scratch, page, "index.html"), `<main>${stale}</main>`);
  const expected = pages.find((entry) => entry.page === page);
  const missing = missingPhrases(scratch, [expected]);
  assert.equal(missing.length, 1, `historical value must fail the rendered check: ${historicalText}`);
  assert.ok(missing[0].run[0].includes(currentText));
}

for (const [index, depth] of current.depths.entries()) {
  for (const strength of ["Weak", "Strong"]) {
    test(`the rendered expedition check rejects historical ${strength.toLowerCase()} beasts at depth ${index}`, () => {
      const row = frontierGuardPhrases(current)[index + 1];
      const oldDepth = historical.depths[index];
      const stale = row.replace(
        range(depth[`beast${strength}Lower`], depth[`beast${strength}Upper`]),
        range(oldDepth[`beast${strength}Lower`], oldDepth[`beast${strength}Upper`]),
      );
      rejectsStaleValue("frontier/beasts", row, stale);
    });
  }
}

test("the rendered armies check rejects the Knight reveal cost for Scouts", () => {
  rejectsStaleValue(
    "frontier/armies",
    `${nativeRules.SCOUT_EXPLORE_STAMINA} for Scouts`,
    `${frontierConfig.troop.stamina.staminaExploreStaminaCost} for Scouts`,
  );
});

test("no built HTML page or llm.txt names Blitz, Devcon or Season 0, and synthetic regressions fail", () => {
  const llm = readFileSync(join(dist, "llm.txt"), "utf8");
  assert.deepEqual(forbiddenModePages(dist, llm), []);
  for (const term of ["Blitz", "Devcon", "Season 0", "Next up", "Up next"]) {
    const fakeDist = mkdtempSync(join(tmpdir(), "rendered-mode-"));
    try {
      mkdirSync(join(fakeDist, "frontier"), { recursive: true });
      writeFileSync(join(fakeDist, "frontier", "index.html"), `<main>Play ${term} today.</main>`);
      const hits = forbiddenModePages(fakeDist, "");
      assert.equal(hits.length, 1, `expected built HTML check to reject ${term}`);
    } finally {
      rmSync(fakeDist, { recursive: true, force: true });
    }
  }
});

test("Realms home shows Games card without quick-link panels, and Frontier omits duplicate nav buttons", () => {
  const home = pageLine(readFileSync(join(dist, "index.html"), "utf8"));
  for (const phrase of [
    "Guides, rules, and live data for Realms games, accounts, and LORDS.",
    "Games",
    "Open Frontier docs",
  ]) {
    assert.ok(home.includes(phrase), `Realms home missing "${phrase}"`);
  }
  for (const removed of ["Payout wallet", "Live dashboard", "Get the data"]) {
    assert.equal(home.includes(removed), false, `Realms home must not duplicate sidebar link "${removed}"`);
  }
  const frontierHtml = readFileSync(join(dist, "frontier", "index.html"), "utf8");
  assert.equal(frontierHtml.includes("docs-frontier-landing-nav"), false);
  assert.equal(frontierHtml.includes("docs-home-quick"), false);
});

const parseCssVars = (css) => {
  const vars = new Map();
  for (const [, name, value] of css.matchAll(/(--[a-zA-Z0-9-]+)\s*:\s*([^;}\n]+);/g)) {
    vars.set(name, value.trim());
  }
  return vars;
};

const resolveHex = (raw, vars, depth = 0) => {
  if (depth > 8) return null;
  const trimmed = raw.replace(/!important/g, "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase();
  const varMatch = trimmed.match(/^var\((--[a-zA-Z0-9-]+)\)$/);
  if (varMatch && vars.has(varMatch[1])) return resolveHex(vars.get(varMatch[1]), vars, depth + 1);
  return null;
};

const selectorSpecificity = (selector) => {
  const cleaned = selector.replace(/:not\([^)]*\)/g, "");
  const ids = (cleaned.match(/#[a-zA-Z0-9_-]+/g) ?? []).length;
  const classes = (cleaned.match(/\.[a-zA-Z0-9_-]+|\[[^\]]+\]|:(?!:)[a-zA-Z-]+/g) ?? []).length;
  const tags = (cleaned.match(/(?:^|[\s>+~])([a-zA-Z][a-zA-Z0-9-]*)/g) ?? []).length;
  return ids * 10000 + classes * 100 + tags;
};

const matchesPrimaryButtonInContent = (selector) => {
  const s = selector.trim();
  if (/:hover|:focus|:active/.test(s)) return false;
  return (
    s === ".vocs_Content a" ||
    s === ".docs-btn-primary" ||
    s === "a.docs-btn-primary" ||
    s === ".vocs_Content a.docs-btn-primary" ||
    s === ".vocs_Content .docs-btn-primary"
  );
};

const winningProp = (css, prop, matcher) => {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let best = null;
  let order = 0;
  for (const [, header, body] of stripped.matchAll(/([^{}@]+)\{([^{}]+)\}/g)) {
    for (const selector of header.split(",")) {
      if (!matcher(selector)) continue;
      for (const [, name, val] of body.matchAll(/([a-z-]+)\s*:\s*([^;]+);/g)) {
        if (name !== prop) continue;
        order += 1;
        const important = /!important/.test(val) ? 1 : 0;
        const spec = selectorSpecificity(selector);
        if (
          !best ||
          important > best.important ||
          (important === best.important && (spec > best.spec || (spec === best.spec && order >= best.order)))
        ) {
          best = { important, spec, order, value: val.trim() };
        }
      }
    }
  }
  return best?.value ?? null;
};

const luminance = (hex) => {
  const channels = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

const contrastRatio = (a, b) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

const primaryButtonContrast = (css) => {
  const vars = parseCssVars(css);
  const fg = resolveHex(winningProp(css, "color", matchesPrimaryButtonInContent) ?? "", vars);
  const bg = resolveHex(winningProp(css, "background", matchesPrimaryButtonInContent) ?? "", vars);
  assert.ok(fg && bg, `expected hex foreground and background for .docs-btn-primary, got fg=${fg} bg=${bg}`);
  return contrastRatio(fg, bg);
};

test("every link and button on home and frontier landing has an accessible name and readable contrast", () => {
  for (const rel of ["index.html", "frontier/index.html"]) {
    const html = readFileSync(join(dist, rel), "utf8");
    const controls = [...html.matchAll(/<(a|button)\b([^>]*)>([\s\S]*?)<\/\1>/g)];
    assert.ok(controls.length > 0, `expected interactive links/buttons on ${rel}`);
    for (const [, tag, attrs, inner] of controls) {
      if (/\baria-hidden="true"/.test(attrs)) continue;
      const aria = attrs.match(/\baria-label="([^"]+)"/)?.[1]?.trim() ?? "";
      const title = attrs.match(/\btitle="([^"]+)"/)?.[1]?.trim() ?? "";
      const alt = [...inner.matchAll(/\balt="([^"]+)"/g)].map((m) => m[1].trim()).join(" ");
      const text = inner
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      assert.ok(aria || title || alt || text, `empty <${tag}> without accessible name on ${rel}: ${attrs}`);
    }
  }
  const styles = readFileSync(fileURLToPath(new URL("../docs/styles.css", import.meta.url)), "utf8");
  const ratio = primaryButtonContrast(styles);
  assert.ok(ratio >= 4.5, `primary button contrast too low (${ratio.toFixed(2)}:1); check .vocs_Content a override`);

  const brokenCss = styles
    .replace(
      ".vocs_Content a {\n  color: var(--realm-accent-brass);\n}",
      ".vocs_Content a {\n  color: var(--realm-accent-brass) !important;\n}",
    )
    .replace(".vocs_Content a.docs-btn-primary", ".unused-btn");
  const brokenRatio = primaryButtonContrast(brokenCss);
  assert.ok(brokenRatio < 1.5, `expected regression check to detect gold-on-gold button (${brokenRatio.toFixed(2)}:1)`);
});
