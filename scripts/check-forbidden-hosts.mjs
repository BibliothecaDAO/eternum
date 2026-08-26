#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync } from "node:fs";

const forbiddenScope = "@" + "cartridge" + "/";
// The identity wallet picker offers Controller for the one SIWS signature (brief, Decisions taken,
// 2026-08-26). These two packages are the only allowed members of the scope; everything else stays banned.
const allowedIdentityConnectorPackages = [
  forbiddenScope + "connector",
  forbiddenScope + "controller",
  // transitive dependencies of the connector
  forbiddenScope + "controller-wasm",
  forbiddenScope + "penpal",
];
const forbiddenHost = "cartridge" + ".gg";
const plainHttp = "http" + "://";

function listRepositoryFiles() {
  const result = spawnSync("git", ["ls-files", "-co", "--exclude-standard", "-z"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || "git ls-files failed");
  }
  return result.stdout.split("\0").filter(Boolean);
}

function readTextFile(path) {
  if (!existsSync(path)) return null;
  if (!lstatSync(path).isFile()) return null;
  const contents = readFileSync(path);
  return contents.includes(0) ? null : contents.toString("utf8");
}

function lineNumberAt(contents, index) {
  return contents.slice(0, index).split("\n").length;
}

function recordLiteralMatches(violations, path, contents, literal, rule) {
  let offset = contents.indexOf(literal);
  while (offset >= 0) {
    if (!isAllowedIdentityConnectorReference(contents, offset, literal)) {
      violations.push({ rule, path, line: lineNumberAt(contents, offset) });
    }
    offset = contents.indexOf(literal, offset + literal.length);
  }
}

function isAllowedIdentityConnectorReference(contents, offset, literal) {
  if (literal !== forbiddenScope) return false;
  return allowedIdentityConnectorPackages.some((pkg) => contents.startsWith(pkg, offset));
}

function isDependencyManifest(path) {
  return (
    path.endsWith("package.json") ||
    path.endsWith("pnpm-lock.yaml") ||
    path.endsWith("package-lock.json") ||
    path.endsWith("yarn.lock") ||
    path.endsWith("bun.lock")
  );
}

function isOutsideDocumentation(path) {
  return !path.startsWith("docs/");
}

function checkEnvironmentHttp(violations, path, contents, prefix) {
  for (const [index, line] of contents.split("\n").entries()) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(\S.*)?$/);
    if (!match || !match[1].startsWith(prefix) || !match[2]?.includes(plainHttp)) continue;
    violations.push({ rule: "browser-plain-http", path, line: index + 1, variable: match[1] });
  }
}

function checkBrowserFacingHttp(violations, path, contents) {
  if (path.startsWith("apps/game/.env")) {
    checkEnvironmentHttp(violations, path, contents, "VITE_PUBLIC_");
    return;
  }
  if (path.startsWith("apps/web/.env")) {
    checkEnvironmentHttp(violations, path, contents, "VITE_");
    return;
  }
  if (
    path === "packages/chain/src/endpoints.ts" ||
    (path.startsWith("apps/game/src/runtime/world/") && !path.includes(".test."))
  ) {
    recordLiteralMatches(violations, path, contents, plainHttp, "browser-plain-http");
  }
}

function runChecks() {
  const files = listRepositoryFiles();
  const violations = [];

  for (const path of files) {
    const contents = readTextFile(path);
    if (contents === null) continue;

    if (isDependencyManifest(path)) {
      recordLiteralMatches(violations, path, contents, forbiddenScope, "forbidden-dependency");
    }
    if (isOutsideDocumentation(path)) {
      recordLiteralMatches(violations, path, contents, forbiddenHost, "forbidden-host");
    }
    checkBrowserFacingHttp(violations, path, contents);
  }

  return { ok: violations.length === 0, filesScanned: files.length, violations };
}

try {
  const result = runChecks();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exit(1);
}
