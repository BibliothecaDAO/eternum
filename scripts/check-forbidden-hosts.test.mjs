import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("./check-forbidden-hosts.mjs", import.meta.url));
const vendorHost = ["cartridge", "gg"].join(".");
const vendorScope = "@" + "cartridge";

function checkFixture(files) {
  const cwd = mkdtempSync(join(tmpdir(), "eternum-host-policy-"));
  try {
    assert.equal(spawnSync("git", ["init", "--quiet"], { cwd }).status, 0);
    for (const [path, contents] of Object.entries(files)) {
      mkdirSync(dirname(join(cwd, path)), { recursive: true });
      writeFileSync(join(cwd, path), contents);
    }
    const result = spawnSync(process.execPath, [script], { cwd, encoding: "utf8" });
    assert.ok(result.status === 0 || result.status === 1, result.stderr);
    return JSON.parse(result.stdout);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

test("identity SDK patches share the existing dependency exception", () => {
  const result = checkFixture({
    [`patches/${vendorScope}__controller@0.13.16.patch`]: `+const host = "${vendorHost}";`,
    "package.json": JSON.stringify({ dependencies: { [`${vendorScope}/controller`]: "0.13.16" } }),
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.violations, []);
});

test("first-party endpoints and unrelated patches/dependencies stay prohibited", () => {
  const result = checkFixture({
    "apps/game/src/identity.ts": `const host = "${vendorHost}";`,
    "patches/unrelated@1.0.0.patch": `+const host = "${vendorHost}";`,
    [`patches/${vendorScope}__controller-extra@1.0.0.patch`]: `+const host = "${vendorHost}";`,
    "package.json": JSON.stringify({ dependencies: { [`${vendorScope}/other-sdk`]: "1.0.0" } }),
  });
  assert.equal(result.ok, false);
  assert.deepEqual(
    result.violations.map(({ path, rule }) => ({ path, rule })).sort((a, b) => a.path.localeCompare(b.path)),
    [
      { path: "apps/game/src/identity.ts", rule: "forbidden-host" },
      { path: "package.json", rule: "forbidden-dependency" },
      { path: `patches/${vendorScope}__controller-extra@1.0.0.patch`, rule: "forbidden-host" },
      { path: "patches/unrelated@1.0.0.patch", rule: "forbidden-host" },
    ].sort((a, b) => a.path.localeCompare(b.path)),
  );
});

test("the old price provider is refused wherever its address is written or assembled; only its permitted links pass", () => {
  const name = ["coin", "gecko"].join("");
  const link = `https://www.${name}.com/en/coins/lords`;
  const display = ["Coin", "Gecko"].join("");
  const result = checkFixture({
    "apps/realms/server/contiguous.ts": `fetch("https://api.${name}.com/api/v3/simple/price");`,
    "apps/realms/server/pro.ts": `fetch("https://pro-api.${name}.com/api/v3/simple/price");`,
    "apps/realms/server/split.ts": `fetch("https://api." + "${name}.com/api/v3/simple/price");`,
    "apps/realms/server/parts.ts": `const host = "api." + "${name}" + ".com";`,
    "apps/web/src/config.ts": `export const market = { subdomain: "api", host: "${name}.com" };`,
    "apps/web/src/upper.tsx": `const host = { name: "${name.toUpperCase()}.COM" };`,
    "apps/realms/config/market.json": JSON.stringify({ priceUrl: `https://api.${name}.com/api/v3/simple/price` }),
    "apps/realms/config/link-and-api.json": JSON.stringify({ page: link, priceUrl: `https://api.${name}.com/api/v3` }),
    "apps/game/src/shell/community.ts": `const href = "${link}"; fetch("https://api.${name}.com/api/v3/ping");`,
    "apps/web/src/site/data/socials.ts": `export const socials = [{ id: "${name}", name: "${display}", href: "${link}" }];`,
    "apps/game/src/shell/new-link-component.tsx": `export const Link = () => <a href="${link}" label="${display}" />;`,
    "apps/game/asset-sources/facets/verdicts.json": JSON.stringify({
      logo: `https://assets.${name}.com/coins/images/22171/standard/lords.png`,
      note: `Nothing shipped for ${display}`,
    }),
    "apps/game/src/shell/icon.ts": `export const icon = "brand-${name}";`,
    "docs/notes.md": `the old reader called api.${name}.com`,
    [`apps/game/public/tokens/brand-${name}.svg`]: "<svg/>",
  });
  assert.equal(result.ok, false);
  assert.deepEqual(
    result.violations
      .map(({ path, rule, line }) => ({ path, rule, line }))
      .sort((a, b) => a.path.localeCompare(b.path)),
    [
      { path: "apps/game/src/shell/community.ts", rule: "forbidden-price-source", line: 1 },
      { path: "apps/realms/config/link-and-api.json", rule: "forbidden-price-source", line: 1 },
      { path: "apps/realms/config/market.json", rule: "forbidden-price-source", line: 1 },
      { path: "apps/realms/server/contiguous.ts", rule: "forbidden-price-source", line: 1 },
      { path: "apps/realms/server/parts.ts", rule: "forbidden-price-source", line: 1 },
      { path: "apps/realms/server/pro.ts", rule: "forbidden-price-source", line: 1 },
      { path: "apps/realms/server/split.ts", rule: "forbidden-price-source", line: 1 },
      { path: "apps/web/src/config.ts", rule: "forbidden-price-source", line: 1 },
      { path: "apps/web/src/upper.tsx", rule: "forbidden-price-source", line: 1 },
    ],
  );
});
