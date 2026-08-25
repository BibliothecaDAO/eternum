import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

function getFilesRecursively(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getFilesRecursively(fullPath));
      continue;
    }

    if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

test("P1: LORDS info queries use a normalized cache key", () => {
  const srcFiles = getFilesRecursively(join(ROOT, "src"));
  const offenders = [];

  for (const filePath of srcFiles) {
    const content = readFileSync(filePath, "utf8");
    if (content.includes('queryKey: ["lordsPrice"]')) {
      offenders.push(filePath.replace(`${ROOT}/`, ""));
    }
  }

  assert.equal(
    offenders.length,
    0,
    `Found legacy lordsPrice query keys in: ${offenders.join(", ")}`
  );
});

test("P1: deprecated react-helmet-async type package is removed", () => {
  const packageJson = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const devDependencies = packageJson.devDependencies ?? {};

  assert.equal(
    Object.hasOwn(devDependencies, "@types/react-helmet-async"),
    false,
    "Expected @types/react-helmet-async to be removed from devDependencies"
  );
});

test("P1: low-risk TypeScript refresh is applied", () => {
  const packageJson = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const devDependencies = packageJson.devDependencies ?? {};
  const version = devDependencies.typescript ?? "";
  const match = version.match(/(\d+)\.(\d+)\.(\d+)/);

  assert.ok(match, `Expected a concrete typescript semver, got: ${version}`);

  const major = Number(match[1]);
  const minor = Number(match[2]);

  assert.equal(major, 5, `Expected TypeScript major to remain 5, got ${major}`);
  assert.ok(
    minor >= 9,
    `Expected TypeScript to be refreshed to 5.9+, got ${version}`
  );
});

test("Toolchain majors: vite/eslint stack is on target versions", () => {
  const packageJson = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const devDependencies = packageJson.devDependencies ?? {};

  const expectations = [
    { name: "vite", major: 7 },
    { name: "@vitejs/plugin-react", major: 5 },
    { name: "eslint", major: 10 },
    { name: "@eslint/js", major: 10 },
    { name: "eslint-plugin-react-hooks", major: 7 },
  ];

  for (const { name, major } of expectations) {
    const version = devDependencies[name] ?? "";
    const match = version.match(/(\d+)\.(\d+)\.(\d+)/);
    assert.ok(match, `Expected a concrete semver for ${name}, got: ${version}`);
    const detectedMajor = Number(match[1]);
    assert.equal(
      detectedMajor,
      major,
      `Expected ${name} major ${major}, got ${version}`
    );
  }
});

test("P2 runtime majors: starknet/zod/recharts are on target versions", () => {
  const packageJson = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const dependencies = packageJson.dependencies ?? {};

  const expectations = [
    { name: "@starknet-react/chains", major: 5 },
    { name: "@starknet-react/core", major: 5 },
    { name: "recharts", major: 3 },
    { name: "zod", major: 4 },
  ];

  for (const { name, major } of expectations) {
    const version = dependencies[name] ?? "";
    const match = version.match(/(\d+)\.(\d+)\.(\d+)/);
    assert.ok(match, `Expected a concrete semver for ${name}, got: ${version}`);
    const detectedMajor = Number(match[1]);
    assert.equal(
      detectedMajor,
      major,
      `Expected ${name} major ${major}, got ${version}`
    );
  }
});
