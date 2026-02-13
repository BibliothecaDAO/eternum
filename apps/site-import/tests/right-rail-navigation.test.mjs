import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

function read(relPath) {
  return readFileSync(join(ROOT, relPath), "utf8");
}

test("TopBar: right rail uses icon-first navigation affordance", () => {
  const topBar = read("src/components/layout/TopBar.tsx");
  const css = read("src/index.css");

  assert.match(
    topBar,
    /railIcons[\s\S]*?=\s*\{/,
    "Expected an icon map for rail sections"
  );
  assert.match(
    topBar,
    /"realm-rail-label truncate transition-all duration-200"/,
    "Expected labels to stay hidden by default and reveal on hover/focus"
  );
  assert.match(
    topBar,
    /const \[isRailExpanded, setIsRailExpanded\] = useState\(false\);/,
    "Expected shared rail expansion state so all items can expand together"
  );
  assert.match(
    topBar,
    /className=\{cn\(\s*"group realm-rail-shell/,
    "Expected rail shell to expose a group hover target for global expansion"
  );
  assert.match(
    topBar,
    /isRailExpanded\s*\?\s*"max-w-\[11rem\] opacity-100 ml-2"\s*:\s*"max-w-0 opacity-0 ml-0"/,
    "Expected all labels to expand together from shared rail hover state"
  );
  assert.match(
    css,
    /\.realm-rail-item[\s\S]*justify-content:\s*center;/,
    "Expected collapsed rail icons to remain centered"
  );
  assert.match(
    css,
    /\.realm-rail-shell-expanded[\s\S]*align-items:\s*stretch;/,
    "Expected expanded rail shell to stretch child buttons to full track width"
  );
  assert.match(
    css,
    /\.realm-rail-item-expanded[\s\S]*width:\s*100%;/,
    "Expected expanded rail buttons to fill the available rail width"
  );
});

test("TopBar: right rail tracks active section with IntersectionObserver", () => {
  const topBar = read("src/components/layout/TopBar.tsx");

  assert.match(
    topBar,
    /const \[activeSection, setActiveSection\] = useState<.*?>\("hero"\);/,
    "Expected active section state for current scroll position"
  );
  assert.match(
    topBar,
    /new IntersectionObserver\(/,
    "Expected IntersectionObserver to track the section currently in view"
  );
  assert.match(
    topBar,
    /setTimeout\(\(\)\s*=>\s*\{\s*setActiveSection\(/,
    "Expected active section updates to be slightly debounced to avoid jumpy state switches"
  );
  assert.match(
    topBar,
    /window\.clearTimeout\(/,
    "Expected previous active-section timers to be cleared before scheduling a new one"
  );
  assert.match(
    topBar,
    /setTimeout\(\(\)\s*=>\s*\{\s*setIsRailExpanded\(nextExpanded\);/,
    "Expected rail expansion changes to be debounced to prevent jittery hover behavior"
  );
});

test("TopBar: right rail applies themed active-state highlight", () => {
  const topBar = read("src/components/layout/TopBar.tsx");
  const css = read("src/index.css");

  assert.match(
    topBar,
    /activeSection === section\.id \? "realm-rail-item-active" : ""/,
    "Expected active section to receive a dedicated themed class"
  );
  assert.match(
    topBar,
    /aria-current=\{activeSection === section\.id \? "true" : undefined\}/,
    "Expected active section button to expose aria-current"
  );
  assert.match(css, /\.realm-rail-shell\b/, "Expected themed right rail shell utility");
  assert.match(css, /\.realm-rail-item-active\b/, "Expected themed active rail item utility");
  assert.match(
    css,
    /\.realm-rail-item:hover[\s\S]*border-radius:\s*0\.75rem;/,
    "Expected expanded rail buttons to use a tighter radius so stacked items do not clip"
  );
  assert.match(
    css,
    /\.realm-rail-shell:has\(\.realm-rail-item:hover\)[\s\S]*border-radius:\s*0\.95rem;/,
    "Expected rail shell radius to tighten while a button is expanded"
  );
});
