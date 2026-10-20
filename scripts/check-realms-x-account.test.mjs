import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("./check-realms-x-account.mjs", import.meta.url));
const canonical = readFileSync(new URL("../packages/chain/src/community.ts", import.meta.url), "utf8");

/** The share messages as the client writes them: each tags the account through X_HANDLE. */
const SHARE_MESSAGES = `import { X_HANDLE } from "@/shell/community";
const tweetFooter = [X_HANDLE, "The most insane fully onchain game"].join("\\n");
export const twitterTemplates = { combat: \`BATTLE DECLARED!\\n\\n\${tweetFooter}\` };
`;

/** Runs the check, as CI does, on a repository holding the canonical file and these sources. */
function check(files) {
  const cwd = mkdtempSync(join(tmpdir(), "realms-x-account-"));
  try {
    assert.equal(spawnSync("git", ["init", "--quiet"], { cwd }).status, 0);
    const all = { "packages/chain/src/community.ts": canonical, ...files };
    for (const [path, contents] of Object.entries(all)) {
      mkdirSync(dirname(join(cwd, path)), { recursive: true });
      writeFileSync(join(cwd, path), contents);
    }
    const result = spawnSync(process.execPath, [script], { cwd, encoding: "utf8" });
    assert.ok(result.status === 0 || result.status === 1, result.stderr);
    return { status: result.status, violations: JSON.parse(result.stdout).violations };
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

const baseline = {
  "apps/game/src/ui/shared/lib/x-share-messages.ts": SHARE_MESSAGES,
  "apps/web/src/site/data/socials.ts":
    'import { REALMS_X_URL } from "@realms-world/chain";\nexport const x = REALMS_X_URL;\n',
};

test("sources that read the canonical account pass", () => {
  assert.deepEqual(check(baseline), { status: 0, violations: [] });
});

test("a new file linking a retired account fails, naming it", () => {
  const { status, violations } = check({
    ...baseline,
    "apps/game/src/ui/follow.tsx": '<a href="https://x.com/realmsgg">X</a>',
  });
  assert.equal(status, 1);
  assert.deepEqual(violations, [{ path: "apps/game/src/ui/follow.tsx", line: 1, written: "x.com/realmsgg" }]);
});

test("a new file tagging a retired account in words fails", () => {
  const { status, violations } = check({ ...baseline, "apps/web/src/site/follow.tsx": "<p>Follow @realmsgg</p>" });
  assert.equal(status, 1);
  assert.deepEqual(violations, [{ path: "apps/web/src/site/follow.tsx", line: 1, written: "@realmsgg" }]);
});

test("a wrong tag beside the correct footer in a share message fails", () => {
  const path = "apps/game/src/ui/shared/lib/x-share-messages.ts";
  const tagged = SHARE_MESSAGES.replace("BATTLE DECLARED!", "@realmsgg BATTLE DECLARED!");
  const { status, violations } = check({ ...baseline, [path]: tagged });
  assert.equal(status, 1);
  assert.deepEqual(violations, [{ path, line: 3, written: "@realmsgg" }]);
});

test("the current account written by hand fails too, in any case, in the docs as well", () => {
  const { violations } = check({
    ...baseline,
    "apps/game-docs/docs/pages/links.mdx": "- [X](https://x.com/LootRealms)\n- Tag @lootrealms",
  });
  assert.deepEqual(
    violations.map((violation) => violation.written),
    ["x.com/LootRealms", "@lootrealms"],
  );
});

test("a post, another account, a test file and Loot Survivor's own listing pass", () => {
  const { status } = check({
    ...baseline,
    "apps/game-docs/docs/pages/guide.mdx": "[guide](https://x.com/lordcumberlord/status/1920650310621495350)",
    "apps/web/src/site/data/post.ts": 'export const post = "https://x.com/LootRealms/status/1";',
    "apps/web/src/site/data/games.ts":
      '      twitter: "https://twitter.com/await_0x",\n      twitter: "https://twitter.com/LootRealms",\n',
    "apps/game/src/shell/news/news.test.tsx": 'expect(href).toBe("https://x.com/LootRealms");',
  });
  assert.equal(status, 0);
});
