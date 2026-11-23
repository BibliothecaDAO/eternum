import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createBrowserSession } from "./client-playtest/browser-session.mjs";
import { withDevClient } from "./lib/dev-client.mjs";
import { assertBrowserClean, parseOption, recordClip } from "./lib/motion-proof.mjs";

const out = parseOption("--out", join(tmpdir(), "troop-motion-proof-" + Date.now()));
const port = parseOption("--port", "4427");
const explicitShippedRef = parseOption("--shipped-ref", null);
mkdirSync(out, { recursive: true });

const KNIGHT_FILES = ["skin.glb", "sword.glb", "shield.glb"];
const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const SKIN_REPO_PATH = "apps/game/public/models/characters/t1-knight-default/near/skin.glb";

function readGlbRootNodeName(buffer) {
  const jsonLength = buffer.readUInt32LE(12);
  const header = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString("utf8"));
  return header.nodes?.[0]?.name ?? null;
}

function resolveShippedKnightRef() {
  if (explicitShippedRef) return explicitShippedRef;
  const commits = execFileSync("git", ["log", "--format=%H", "-n", "16", "--", SKIN_REPO_PATH], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter(Boolean);
  for (const hash of commits) {
    const content = execFileSync("git", ["show", `${hash}:${SKIN_REPO_PATH}`], {
      cwd: REPO_ROOT,
      maxBuffer: 16 * 1024 * 1024,
    });
    if (readGlbRootNodeName(content) === "root") return hash;
  }
  throw new Error(`Could not locate pre-swap shipped Knight commit in git history for ${SKIN_REPO_PATH}`);
}

function stageShippedKnightFiles(targetDir) {
  const ref = resolveShippedKnightRef();
  for (const file of KNIGHT_FILES) {
    const gitPath = `${ref}:apps/game/public/models/characters/t1-knight-default/near/${file}`;
    const content = execFileSync("git", ["show", gitPath], { cwd: REPO_ROOT, maxBuffer: 16 * 1024 * 1024 });
    writeFileSync(join(targetDir, file), content);
  }
  return ref;
}

const profile = mkdtempSync(join(tmpdir(), "troop-motion-proof-"));
const shippedDir = mkdtempSync(join(tmpdir(), "shipped-knight-"));
const browser = createBrowserSession("troop-motion-" + Date.now(), { profile, headed: false });

try {
  const shippedRef = stageShippedKnightFiles(shippedDir);
  process.env.LAB_SHIPPED_KNIGHT_DIR = shippedDir;
  await withDevClient({ base: parseOption("--base-url", null), port, out }, async (baseUrl) => {
    try {
      const clips = [];
      const compareQuery = "&compare=1&shippedUrl=/__lab-shipped-knight";

      browser.run(["set", "viewport", "1280", "720"]);
      browser.run([
        "open",
        `${baseUrl}/lab/troop-motion?capture=1&troop=knight&action=idle&camera=desktop${compareQuery}`,
      ]);
      browser.run([
        "wait",
        "--fn",
        "document.querySelector('[data-troop-motion-ready=\"true\"]') !== null && Boolean(window.__troopMotionLab?.ready)",
      ]);

      const meta = browser.read("window.__troopMotionLab.getMeta()");
      const troops = meta.troops;
      const actions = meta.actions;

      for (const troop of troops) {
        for (const action of actions) {
          const duration = action === "attack" ? 3000 : action === "death" ? 2500 : 2400;
          clips.push(
            recordClip(
              browser,
              out,
              `${troop}-desktop-${action}`,
              "__troopMotionLab",
              { troop, action, camera: "desktop", compareShipped: true },
              duration,
            ),
          );
        }
        clips.push(
          recordClip(
            browser,
            out,
            `${troop}-reel-desktop`,
            "__troopMotionLab",
            { troop, action: "reel", camera: "desktop", compareShipped: false },
            11800,
          ),
        );
      }

      browser.run(["set", "viewport", "390", "844"]);
      for (const troop of troops) {
        for (const action of actions) {
          const duration = action === "attack" ? 3000 : action === "death" ? 2500 : 2400;
          clips.push(
            recordClip(
              browser,
              out,
              `${troop}-phone-${action}`,
              "__troopMotionLab",
              { troop, action, camera: "phone", compareShipped: true },
              duration,
            ),
          );
        }
      }

      const stats = assertBrowserClean(browser, "__troopMotionLab");
      writeFileSync(
        join(out, "summary.json"),
        JSON.stringify(
          { capturedAt: new Date().toISOString(), comparedWithShipped: true, shippedRef, clips, stats },
          null,
          2,
        ),
      );
      console.log(`Troop motion proof complete: ${clips.length} clips in ${out}`);
    } finally {
      browser.close();
      rmSync(profile, { recursive: true, force: true });
    }
  });
} finally {
  delete process.env.LAB_SHIPPED_KNIGHT_DIR;
  rmSync(shippedDir, { recursive: true, force: true });
}
