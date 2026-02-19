import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

function read(relPath) {
  return readFileSync(join(ROOT, relPath), "utf8");
}

test("Theme: index.css defines medieval realm token groups", () => {
  const css = read("src/index.css");

  assert.match(css, /--realm-bg-void:/, "Expected realm background token");
  assert.match(css, /--realm-surface-iron:/, "Expected realm surface token");
  assert.match(css, /--realm-accent-ember:/, "Expected realm accent token");
  assert.match(css, /--realm-border-etched:/, "Expected realm border token");
});

test("Theme: typography uses game-oriented display and UI font stacks", () => {
  const css = read("src/index.css");

  assert.match(
    css,
    /MedievalSharp/,
    "Expected game-oriented display font family to be imported"
  );
  assert.match(
    css,
    /Rajdhani/,
    "Expected game-oriented UI/body font family to be imported"
  );
  assert.match(
    css,
    /--font-ui:/,
    "Expected dedicated UI font token for sigils and labels"
  );
  assert.match(
    css,
    /\.realm-banner[\s\S]*font-family:\s*var\(--font-ui\)/,
    "Expected banner labels to use the UI font token"
  );
  assert.match(
    css,
    /\.realm-sigil[\s\S]*font-family:\s*var\(--font-ui\)/,
    "Expected sigil metadata to use the UI font token"
  );
});

test("Theme: index.css exposes reusable medieval utility classes", () => {
  const css = read("src/index.css");

  assert.match(css, /\.realm-section\b/, "Expected reusable realm section class");
  assert.match(css, /\.realm-panel\b/, "Expected reusable realm panel class");
  assert.match(css, /\.realm-banner\b/, "Expected reusable realm banner class");
  assert.match(css, /\.realm-sigil\b/, "Expected reusable realm sigil class");
  assert.match(css, /\.card-relic\b/, "Expected reusable relic card class");
});

test("Theme: index.css defines next-gen gaming surface utilities", () => {
  const css = read("src/index.css");

  assert.match(
    css,
    /\.realm-grid-scan\b/,
    "Expected grid scan utility for advanced gaming surfaces"
  );
  assert.match(
    css,
    /\.realm-edge-brackets\b/,
    "Expected edge bracket utility for angular panel framing"
  );
  assert.match(
    css,
    /\.realm-holo-card\b/,
    "Expected holographic card utility for non-vanilla visual hierarchy"
  );
});

test("Theme: index.css defines world-map narrative layout utilities", () => {
  const css = read("src/index.css");

  assert.match(
    css,
    /\.realm-journey-map\b/,
    "Expected journey map utility for narrative section composition"
  );
  assert.match(
    css,
    /\.realm-journey-path\b/,
    "Expected journey path utility for connected world routes"
  );
  assert.match(
    css,
    /\.realm-world-node\b/,
    "Expected world node utility for staged waypoint cards"
  );
});

test("UI: button variants include medieval CTA styles", () => {
  const button = read("src/components/ui/button.tsx");

  assert.match(button, /war:/, "Expected `war` button variant");
  assert.match(button, /oath:/, "Expected `oath` button variant");
  assert.match(button, /rune:/, "Expected `rune` button variant");
});

test("TopBar: header and rail adopt realm utility classes", () => {
  const topBar = read("src/components/layout/TopBar.tsx");

  assert.match(topBar, /realm-header-shell/, "Expected themed header shell class");
  assert.match(topBar, /realm-rail-button/, "Expected themed rail button class");
});

test("Landing sections adopt realm wrappers", () => {
  const intro = read("src/components/sections/IntroSection.tsx");
  const agent = read("src/components/sections/AgentNativeSection.tsx");
  const atlas = read("src/components/sections/EcosystemAtlasSection.tsx");
  const partners = read("src/components/sections/PartnersSection.tsx");

  assert.match(intro, /realm-section/, "Expected intro section themed wrapper");
  assert.match(agent, /realm-panel/, "Expected agent section themed panel");
  assert.match(atlas, /realm-sigil/, "Expected atlas section sigil metadata");
  assert.match(partners, /realm-panel/, "Expected partners section to use themed panel wrappers");
});

test("Landing sections apply next-gen utility classes", () => {
  const agent = read("src/components/sections/AgentNativeSection.tsx");
  const atlas = read("src/components/sections/EcosystemAtlasSection.tsx");
  const partners = read("src/components/sections/PartnersSection.tsx");

  assert.match(
    agent,
    /realm-edge-brackets/,
    "Expected agent section to use edge bracket framing"
  );
  assert.match(
    atlas,
    /realm-grid-scan/,
    "Expected atlas cards to use grid scan utility"
  );
  assert.match(
    partners,
    /Core Partner Stack/,
    "Expected partners section to expose the rebuilt partner stack heading"
  );
});

test("Landing sections use world-map narrative flow patterns", () => {
  const agent = read("src/components/sections/AgentNativeSection.tsx");
  const atlas = read("src/components/sections/EcosystemAtlasSection.tsx");
  const partners = read("src/components/sections/PartnersSection.tsx");

  assert.match(
    agent,
    /realm-journey-map/,
    "Expected agent section to present rollout as a connected journey map"
  );
  assert.match(
    atlas,
    /realm-world-node/,
    "Expected atlas section to render world entries as map nodes"
  );
  assert.match(
    partners,
    /Protocol Rail Index/,
    "Expected partners section to present the rebuilt protocol rail index"
  );
  assert.doesNotMatch(
    partners,
    /realm-journey-path|realm-world-node|sm:even:ml-auto/,
    "Expected old timeline classes to be removed from rebuilt partners section"
  );
});
