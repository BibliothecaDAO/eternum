import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

function read(relPath) {
  return readFileSync(join(ROOT, relPath), "utf8");
}

test("Mobile touch targets: button size variants are 44px minimum", () => {
  const button = read("src/components/ui/button.tsx");

  assert.match(
    button,
    /default:\s*"h-11 px-4 py-2"/,
    "Expected default button height to be at least 44px"
  );
  assert.match(
    button,
    /sm:\s*"h-11 rounded-md px-3 text-xs"/,
    "Expected small button height to be at least 44px"
  );
  assert.match(
    button,
    /icon:\s*"h-11 w-11"/,
    "Expected icon button touch target to be at least 44x44"
  );
});

test("Mobile value flow: ReactFlow allows tighter zoom and responsive height", () => {
  const valueFlow = read("src/components/sections/ValueFlowSection.tsx");

  assert.match(
    valueFlow,
    /h-\[420px\] sm:h-\[600px\]/,
    "Expected value-flow canvas height to be mobile-responsive"
  );
  assert.match(
    valueFlow,
    /fitViewOptions=\{\{ padding: 0\.3, minZoom: 0\.35, maxZoom: 1 \}\}/,
    "Expected fitView to allow smaller mobile zoom levels"
  );
});

test("Game details mobile: container padding is responsive", () => {
  const details = read("src/components/game/GameDetails.tsx");

  assert.match(
    details,
    /container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl rounded-2xl/,
    "Expected game detail container to avoid desktop-only horizontal padding on mobile"
  );
});

test("Screenshot modal: right navigation button has visible contrast styling", () => {
  const details = read("src/components/game/GameDetails.tsx");

  assert.match(
    details,
    /className="absolute right-4 top-1\/2 -translate-y-1\/2 text-white hover:bg-white\/30 bg-black\/50 backdrop-blur-sm z-10"/,
    "Expected right screenshot nav button to match visible left-button styling"
  );
});

test("Footer legal links wrap on mobile", () => {
  const footer = read("src/components/sections/FooterSection.tsx");

  assert.match(
    footer,
    /className="flex flex-wrap items-center justify-center md:justify-start gap-4 md:gap-6 text-sm"/,
    "Expected footer legal links row to wrap on mobile"
  );
});

test("TopBar login button does not shrink below mobile touch target", () => {
  const topBar = read("src/components/layout/TopBar.tsx");

  assert.doesNotMatch(
    topBar,
    /isScrolled \? "h-8 text-xs px-3" : ""/,
    "Expected scrolled login button to keep >=44px touch height"
  );
});
