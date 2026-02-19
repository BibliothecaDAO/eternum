import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

function read(relPath) {
  return readFileSync(join(ROOT, relPath), "utf8");
}

test("Theme: app is dark-mode only", () => {
  const topBar = read("src/components/layout/TopBar.tsx");
  const themeProvider = read("src/components/theme-provider.tsx");

  assert.doesNotMatch(
    topBar,
    /ModeToggle/,
    "Expected header theme toggle to be removed"
  );

  assert.match(
    themeProvider,
    /type Theme = "dark";/,
    "Expected theme provider to only expose dark mode"
  );
  assert.match(
    themeProvider,
    /root\.classList\.add\("dark"\);/,
    "Expected theme provider to always apply dark class"
  );
  assert.doesNotMatch(
    themeProvider,
    /"light"|"system"/,
    "Expected light/system theme modes to be removed"
  );
  assert.doesNotMatch(
    themeProvider,
    /prefers-color-scheme|matchMedia/,
    "Expected no system theme detection in dark-only mode"
  );
});
