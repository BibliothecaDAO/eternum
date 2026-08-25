import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

function read(relPath) {
  return readFileSync(join(ROOT, relPath), "utf8");
}

test("Blitz page: route file exists and is registered", () => {
  const routePath = join(ROOT, "src", "routes", "blitz.tsx");
  assert.equal(existsSync(routePath), true, "Expected new /blitz route file");

  const blitzRoute = read("src/routes/blitz.tsx");
  const routeTree = read("src/routeTree.gen.ts");

  assert.match(
    blitzRoute,
    /createFileRoute\("\/blitz"\)/,
    "Expected /blitz file route definition"
  );
  assert.match(
    routeTree,
    /'\/blitz'/,
    "Expected route tree to include /blitz route"
  );
});

test("Blitz page: includes full-screen video stub section", () => {
  const blitzRoute = read("src/routes/blitz.tsx");
  const stubVideoPath = join(ROOT, "public", "videos", "blitz-stub.mp4");

  assert.match(
    blitzRoute,
    /min-h-\[100svh\]/,
    "Expected a full-screen viewport section for the Blitz video"
  );
  assert.match(blitzRoute, /<video/, "Expected a video element on the Blitz page");
  assert.match(blitzRoute, /autoPlay/, "Expected HTML5 video to autoplay");
  assert.match(blitzRoute, /muted/, "Expected autoplay-safe muted video");
  assert.match(blitzRoute, /loop/, "Expected video loop for continuous ambient motion");
  assert.match(blitzRoute, /playsInline/, "Expected inline playback for mobile browsers");
  assert.doesNotMatch(
    blitzRoute,
    /<video[\s\S]*controls/,
    "Expected the hero video to hide native controls"
  );
  assert.match(
    blitzRoute,
    /\/videos\/blitz-stub\.mp4/,
    "Expected a stub video source path for upcoming real footage"
  );
  assert.equal(
    existsSync(stubVideoPath),
    true,
    "Expected a local MP4 file at public/videos/blitz-stub.mp4"
  );
  assert.match(
    blitzRoute,
    /mix-blend-screen/,
    "Expected blend mode styling so the video integrates with the page theme"
  );
});

test("Blitz page: includes styled fake CLI agent interaction", () => {
  const blitzRoute = read("src/routes/blitz.tsx");

  assert.match(
    blitzRoute,
    /const \[command, setCommand\] = useState\(""\);/,
    "Expected command input state for fake CLI"
  );
  assert.match(
    blitzRoute,
    /const \[terminalLines, setTerminalLines\] = useState/,
    "Expected terminal output state for agent-style responses"
  );
  assert.match(
    blitzRoute,
    /placeholder="Type a command \(try: help\)"/,
    "Expected explicit command input prompt"
  );
  assert.match(
    blitzRoute,
    /case "help":/,
    "Expected a CLI help command response"
  );
  assert.match(
    blitzRoute,
    /className="realm-panel realm-grid-scan/,
    "Expected CLI container to use themed styling"
  );
});

test("Blitz page: includes multiple game-explainer sections", () => {
  const blitzRoute = read("src/routes/blitz.tsx");

  assert.match(
    blitzRoute,
    /How Blitz Works/,
    "Expected a dedicated game-loop explainer section"
  );
  assert.match(
    blitzRoute,
    /Agent Roles In Every Match/,
    "Expected a section that explains each agent role"
  );
  assert.match(
    blitzRoute,
    /Across The Realms Ecosystem/,
    "Expected a section describing cross-ecosystem integration"
  );
  assert.match(
    blitzRoute,
    /const blitzPhases = \[/,
    "Expected structured phase data for the game explainer"
  );
  assert.match(
    blitzRoute,
    /const agentRoles = \[/,
    "Expected structured role data for the agent explainer"
  );
  assert.match(
    blitzRoute,
    /const ecosystemSignals = \[/,
    "Expected structured ecosystem signal data for integration explainer"
  );
});

test("Blitz page: includes docs-aligned mode cadence and bracket tiers", () => {
  const blitzRoute = read("src/routes/blitz.tsx");

  assert.match(
    blitzRoute,
    /2-hour|2 hour|two-hour/i,
    "Expected docs-aligned two-hour Blitz session reference"
  );
  assert.match(
    blitzRoute,
    /Recruit|Gladiator|Warrior|Elite/,
    "Expected docs-aligned Blitz tier references"
  );
});

test("TopBar: desktop nav links to Blitz page", () => {
  const topBar = read("src/components/layout/TopBar.tsx");

  assert.match(topBar, /to="\/blitz"/, "Expected top nav link to /blitz");
  assert.match(topBar, />\s*Blitz\s*</, "Expected Blitz label in header nav");
});

test("Root layout: Blitz route is full-bleed and route changes reset scroll to top", () => {
  const rootRoute = read("src/routes/__root.tsx");

  assert.match(
    rootRoute,
    /const location = useLocation\(\);/,
    "Expected root route to read current location for layout + scroll handling"
  );
  assert.match(
    rootRoute,
    /const isBlitzRoute = location\.pathname === "\/blitz";/,
    "Expected a dedicated full-bleed toggle for Blitz route"
  );
  assert.match(
    rootRoute,
    /window\.scrollTo\(\{ top: 0, left: 0, behavior: "auto" \}\);/,
    "Expected navigation to reset viewport to top"
  );
  assert.match(
    rootRoute,
    /isBlitzRoute[\s\S]*\? "min-h-screen"[\s\S]*: "min-h-screen pt-12 sm:pt-16 md:pt-24 mx-1 sm:mx-2 md:mx-4"/,
    "Expected Blitz route to bypass the shared page padding and outer margins"
  );
});

test("Blitz hero: mouse hover enables ASCII spotlight following pointer", () => {
  const blitzRoute = read("src/routes/blitz.tsx");
  const css = read("src/index.css");

  assert.match(
    blitzRoute,
    /const \[isHeroAsciiActive, setIsHeroAsciiActive\] = useState\(false\);/,
    "Expected hover state to toggle ASCII effect"
  );
  assert.match(
    blitzRoute,
    /heroAsciiOverlayRef = useRef<HTMLDivElement \| null>\(null\);/,
    "Expected overlay ref for direct CSS variable updates"
  );
  assert.match(
    blitzRoute,
    /requestAnimationFrame\(/,
    "Expected RAF-based mouse tracking for smooth spotlight movement"
  );
  assert.match(
    blitzRoute,
    /onMouseMove=\{handleHeroMouseMove\}/,
    "Expected hero section to track mouse movement"
  );
  assert.match(
    blitzRoute,
    /realm-blitz-ascii-overlay/,
    "Expected ASCII overlay layer on the hero media"
  );
  assert.match(
    blitzRoute,
    /realm-blitz-hover-lens/,
    "Expected additional hover lens layer for the filter reveal"
  );
  assert.match(
    css,
    /\.realm-blitz-ascii-overlay\b/,
    "Expected dedicated CSS class for ASCII character field"
  );
  assert.match(
    css,
    /\.realm-blitz-hover-lens\b/,
    "Expected dedicated CSS class for the mouse-follow spotlight lens"
  );
});
