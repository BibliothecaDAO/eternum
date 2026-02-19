import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

function read(relPath) {
  return readFileSync(join(ROOT, relPath), "utf8");
}

test("Homepage route includes agent-native and atlas section anchors", () => {
  const homeRoute = read("src/routes/index.tsx");

  assert.match(
    homeRoute,
    /id="agent-native"/,
    "Expected homepage to include an agent-native section anchor"
  );
  assert.match(
    homeRoute,
    /id="ecosystem-atlas"/,
    "Expected homepage to include an ecosystem-atlas section anchor"
  );
  assert.doesNotMatch(
    homeRoute,
    /id="games"/,
    "Expected duplicate homepage games section to be removed"
  );
});

test("Intro hero derives live game count from shared games data", () => {
  const intro = read("src/components/sections/IntroSection.tsx");

  assert.match(
    intro,
    /games\.filter\(\(game\) => game\.isLive\)\.length/,
    "Expected live game count to be derived from the games dataset"
  );
});

test("Agent rollout message is present in hero copy", () => {
  const intro = read("src/components/sections/IntroSection.tsx");

  assert.match(
    intro,
    /rolling out across games/i,
    "Expected rollout wording in hero copy"
  );
});

test("Header keeps only Games/Scroll while section links move to right rail", () => {
  const topBar = read("src/components/layout/TopBar.tsx");

  assert.match(
    topBar,
    /to="\/games"/,
    "Expected header nav to keep Games link"
  );
  assert.match(
    topBar,
    /to="\/scroll"/,
    "Expected header nav to keep Scroll link"
  );
  assert.match(
    topBar,
    /Section rail navigation/,
    "Expected a right-side vertical section rail"
  );
  assert.match(
    topBar,
    /Agent Native/,
    "Expected section rail to include Agent Native"
  );
  assert.match(
    topBar,
    /Ecosystem Atlas/,
    "Expected section rail to include Ecosystem Atlas"
  );
  assert.doesNotMatch(
    topBar,
    /id:\s*"games",\s*label:\s*"Games",\s*href:\s*"#games"/,
    "Expected header section anchors to drop removed duplicate games block"
  );
});

test("Header style aligns with agent-native revamp", () => {
  const topBar = read("src/components/layout/TopBar.tsx");

  assert.match(
    topBar,
    /bg-black\/45/,
    "Expected a darker mythic header surface"
  );
  assert.match(
    topBar,
    /Go to homepage/,
    "Expected logo button to remain for homepage navigation"
  );
  assert.doesNotMatch(
    topBar,
    /Agent-native ecosystem/,
    "Expected agent-native text block to be removed from header"
  );
  assert.doesNotMatch(
    topBar,
    /Explore Ecosystem/,
    "Expected extra header CTA to be removed"
  );
  assert.doesNotMatch(
    topBar,
    /LORDS:/,
    "Expected legacy LORDS ticker to be removed from header"
  );
});

test("Header includes live APY badge", () => {
  const topBar = read("src/components/layout/TopBar.tsx");

  assert.match(
    topBar,
    /veLORDS APY/,
    "Expected a dedicated veLORDS APY badge in the header controls"
  );
  assert.match(
    topBar,
    /import\("@\/components\/sections\/FooterApyValue"\)/,
    "Expected APY badge to lazy-load the shared FooterApyValue source"
  );
});

test("Background scene uses a Mobius strip centerpiece", () => {
  const bg = read("src/components/RealmSceneBackground.tsx");

  assert.match(
    bg,
    /createMobiusStripGeometry/,
    "Expected explicit Mobius strip geometry generator"
  );
  assert.match(
    bg,
    /mobiusStrip/i,
    "Expected Mobius strip mesh usage in scene composition"
  );
  assert.match(
    bg,
    /new THREE\.TorusGeometry/,
    "Expected orbital halo geometry for stronger medieval silhouette"
  );
  assert.match(
    bg,
    /glyphShard/i,
    "Expected glyph shard field for visibly new ambient motion"
  );
  assert.match(
    bg,
    /asciiPassMaterial/i,
    "Expected explicit ASCII post-processing shader material"
  );
  assert.match(
    bg,
    /new THREE\.WebGLRenderTarget/,
    "Expected offscreen render target for shader post-processing"
  );
  assert.match(
    bg,
    /asciiCellSize/i,
    "Expected ASCII cell-size uniform for block character rendering"
  );
  assert.doesNotMatch(
    bg,
    /new THREE\.TorusGeometry\(2\.6, 0\.12, 24, 140\)/,
    "Expected legacy torus centerpiece to be removed"
  );
});

test("Partners section uses shared partner data source", () => {
  const partnersSection = read("src/components/sections/PartnersSection.tsx");

  assert.match(
    partnersSection,
    /from "@\/data\/partners"/,
    "Expected partners section to consume shared data module"
  );
  assert.doesNotMatch(
    partnersSection,
    /const partners = \[/,
    "Expected inline partner list duplication to be removed"
  );
});

test("Agent native section surfaces rollout snapshot metrics", () => {
  const agentNative = read("src/components/sections/AgentNativeSection.tsx");

  assert.match(
    agentNative,
    /Rollout Snapshot/,
    "Expected a rollout snapshot block for at-a-glance adoption signals"
  );
  assert.match(
    agentNative,
    /games\.filter\(\(game\) => game\.isLive\)\.length/,
    "Expected live rollout count to derive from shared games data"
  );
  assert.match(
    agentNative,
    /new Set\(games\.map\(\(game\) => game\.studio\)\)\.size/,
    "Expected studio coverage metric to derive from shared games data"
  );
});

test("Ecosystem atlas section promotes discovery signals", () => {
  const atlas = read("src/components/sections/EcosystemAtlasSection.tsx");

  assert.match(
    atlas,
    /Atlas Snapshot/,
    "Expected atlas snapshot heading to prioritize key ecosystem signals"
  );
  assert.match(
    atlas,
    /View Full Ecosystem/,
    "Expected explicit CTA for browsing the complete games catalog"
  );
  assert.match(
    atlas,
    /game\.genre/,
    "Expected per-card genre metadata for faster scanning"
  );
});

test("Partners section explains partner roles", () => {
  const partnersSection = read("src/components/sections/PartnersSection.tsx");

  assert.match(
    partnersSection,
    /Capability Map/,
    "Expected a capability framing heading for partner context"
  );
  assert.match(
    partnersSection,
    /partnerRoles/,
    "Expected explicit partner role mapping for clearer UX"
  );
});

test("Partners section keeps a stable non-zigzag timeline layout", () => {
  const partnersSection = read("src/components/sections/PartnersSection.tsx");

  assert.match(
    partnersSection,
    /xl:grid-cols-\[/,
    "Expected split panel layout only at extra-large breakpoints to avoid cramped overlap"
  );
  assert.match(
    partnersSection,
    /className="group w-full rounded-xl/,
    "Expected partner cards to use full available column width"
  );
  assert.doesNotMatch(
    partnersSection,
    /sm:even:ml-auto|sm:max-w-\[88%\]|lg:max-w-\[86%\]/,
    "Expected zig-zag offsets and constrained max-width classes to be removed"
  );
  assert.doesNotMatch(
    partnersSection,
    /realm-world-node card-relic realm-holo-card/,
    "Expected partner cards to avoid holo sheen overlay that can reduce text legibility"
  );
});

test("Partners section uses rebuilt non-timeline card stack", () => {
  const partnersSection = read("src/components/sections/PartnersSection.tsx");

  assert.match(
    partnersSection,
    /Core Partner Stack/,
    "Expected rewritten section heading for the new partner card stack"
  );
  assert.doesNotMatch(
    partnersSection,
    /realm-journey-map|realm-journey-path|realm-world-node/,
    "Expected old journey/timeline classes to be removed in rebuilt component"
  );
});

test("Value flow section surfaces concise snapshot first", () => {
  const valueFlow = read("src/components/sections/ValueFlowSection.tsx");

  assert.match(
    valueFlow,
    /Flow Snapshot/,
    "Expected a flow snapshot heading for key metrics"
  );
  assert.doesNotMatch(
    valueFlow,
    /How Value Flows to Stakers/,
    "Expected verbose duplicate explainer block to be removed"
  );
});

test("Tokenomics section includes supply snapshot block", () => {
  const tokenomics = read("src/components/sections/TokenomicsSection.tsx");

  assert.match(
    tokenomics,
    /Supply Snapshot/,
    "Expected supply snapshot heading for tokenomics scannability"
  );
});

test("Treasury section includes governance pulse summary", () => {
  const treasury = read("src/components/sections/TreasurySection.tsx");

  assert.match(
    treasury,
    /Governance Pulse/,
    "Expected governance pulse summary block in treasury section"
  );
});

test("Agent native section clips decorative overflow", () => {
  const agentNative = read("src/components/sections/AgentNativeSection.tsx");

  assert.match(
    agentNative,
    /<section className="[^"]*overflow-hidden[^"]*"/,
    "Expected agent native section root to include overflow-hidden to prevent horizontal page overflow"
  );
});
