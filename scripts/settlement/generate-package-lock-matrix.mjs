import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { access, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const contractsRoot = resolve(repositoryRoot, "contracts");
const outputPath = resolve(repositoryRoot, "packages/settlement-codec/schema/package-lock-matrix-v1.json");
const checkOnly = process.argv.includes("--check");
const execFileAsync = promisify(execFile);

const roles = new Map([
  ["settlement_protocol", { role: "dependency-leaf" }],
  ["factory", { role: "protocol-consumer" }],
  ["game", { role: "protocol-consumer" }],
  ["settlement_appchain", { role: "protocol-consumer" }],
  ["settlement_integration_tests", { role: "dev-conformance" }],
  ["season_resources", { role: "deferred-migration", deferredTo: "C7", releaseBlocking: true }],
  ["collectibles", { role: "explicit-compatible" }],
  ["collectibles_claim", { role: "explicit-compatible" }],
  ["lords", { role: "explicit-compatible" }],
  ["mmr", { role: "explicit-compatible" }],
  ["season_pass", { role: "explicit-compatible" }],
  ["village_pass", { role: "explicit-compatible" }],
]);

function readSection(manifest, section) {
  const match = manifest.match(new RegExp(`^\\[${section}\\]\\n([\\s\\S]*?)(?=^\\[|(?![\\s\\S]))`, "m"));
  return match?.[1] ?? "";
}

function readStringField(section, field) {
  const match = section.match(new RegExp(`^${field}\\s*=\\s*"([^"]+)"`, "m"));
  return match?.[1]?.replace(/^=/, "") ?? null;
}

function readDependencyVersion(section, dependency) {
  const line = section.match(new RegExp(`^${dependency}\\s*=\\s*(.+)$`, "m"))?.[1];
  if (!line) return null;
  const direct = line.match(/^"=?([^"]+)"/)?.[1];
  const tagged = line.match(/(?:tag|rev)\s*=\s*"v?([^"]+)"/)?.[1];
  return direct ?? tagged ?? null;
}

function readDependencyNames(manifest) {
  const sections = [readSection(manifest, "dependencies"), readSection(manifest, "dev-dependencies")];
  return [
    ...new Set(
      sections.flatMap((section) => [...section.matchAll(/^([A-Za-z0-9_-]+)\s*=/gm)].map((match) => match[1])),
    ),
  ].sort();
}

function readDependencyPins(manifest) {
  const pins = new Map();
  for (const section of [readSection(manifest, "dependencies"), readSection(manifest, "dev-dependencies")]) {
    for (const match of section.matchAll(/^([A-Za-z0-9_-]+)\s*=\s*(.+)$/gm)) {
      const [, dependency, pin] = match;
      const previous = pins.get(dependency);
      if (previous && previous !== pin.trim()) {
        throw new Error(`dependency ${dependency} has conflicting production and dev pins`);
      }
      pins.set(dependency, pin.trim());
    }
  }
  return Object.fromEntries([...pins.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function readPrebuiltPlugins(manifest) {
  const toolSection = readSection(manifest, "tool\\.scarb");
  const list = toolSection.match(/^allow-prebuilt-plugins\s*=\s*\[([\s\S]*?)\]/m)?.[1] ?? "";
  return [...list.matchAll(/"([^"]+)"/g)].map((match) => match[1]).sort();
}

async function readResolvedDependencyGraph(packageRoot, packageIds) {
  const { stdout } = await execFileAsync(
    "scarb",
    ["metadata", "--format-version", "1", "--no-deps", "--ignore-cairo-version", "--no-warnings"],
    {
      cwd: packageRoot,
      env: { ...process.env, ASDF_SCARB_VERSION: "2.13.1" },
      maxBuffer: 10 * 1024 * 1024,
    },
  );
  const metadata = JSON.parse(stdout.slice(stdout.indexOf("{")));
  const packageMetadata = metadata.packages.find(({ root }) => resolve(root) === packageRoot);
  if (!packageMetadata) throw new Error(`scarb metadata omitted package at ${packageRoot}`);
  const dependencies = packageMetadata.dependencies.filter(({ name }) => name !== "core");
  return {
    resolvedDependencies: [...new Set(dependencies.map(({ name }) => name))].sort(),
    internalDependencies: resolveInternalDependencies(dependencies, packageIds),
  };
}

async function readToolVersion(packageRoot, tool) {
  try {
    const toolVersions = await readFile(resolve(packageRoot, ".tool-versions"), "utf8");
    return toolVersions.match(new RegExp(`^${tool}\\s+([^\\s]+)`, "m"))?.[1] ?? null;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function hashLockfile(packageRoot) {
  const lockfile = await readFile(resolve(packageRoot, "Scarb.lock"));
  return createHash("sha256").update(lockfile).digest("hex");
}

async function describePackage(id, packageIds) {
  const packageRoot = resolve(contractsRoot, id);
  const manifest = await readFile(resolve(packageRoot, "Scarb.toml"), "utf8");
  const packageSection = readSection(manifest, "package");
  const dependencies = readSection(manifest, "dependencies");
  const devDependencies = readSection(manifest, "dev-dependencies");
  const role = roles.get(id) ?? { role: "legacy-nonconsumer" };

  const dependencyPins = readDependencyPins(manifest);
  const dependencyGraph = await readResolvedDependencyGraph(packageRoot, packageIds);
  return {
    id,
    packageName: readStringField(packageSection, "name"),
    packageVersion: readStringField(packageSection, "version"),
    edition: readStringField(packageSection, "edition"),
    role: role.role,
    cairoVersion: readStringField(packageSection, "cairo-version"),
    starknetVersion: readDependencyVersion(dependencies, "starknet"),
    scarbVersion: await readToolVersion(packageRoot, "scarb"),
    snforgeVersion:
      readDependencyVersion(devDependencies, "snforge_std") ??
      (await readToolVersion(packageRoot, "starknet-foundry")) ??
      (await readToolVersion(packageRoot, "snforge")),
    dependencies: readDependencyNames(manifest),
    dependencyPins,
    resolvedDependencies: dependencyGraph.resolvedDependencies,
    internalDependencies: dependencyGraph.internalDependencies,
    prebuiltPlugins: readPrebuiltPlugins(manifest),
    lockSha256: await hashLockfile(packageRoot),
    ...(role.deferredTo ? { deferredTo: role.deferredTo, releaseBlocking: role.releaseBlocking } : {}),
  };
}

function resolveInternalDependencies(dependencies, packageIds) {
  const internalDependencies = [];
  for (const dependency of dependencies) {
    if (!dependency.source.startsWith("path+")) continue;
    const manifestPath = fileURLToPath(dependency.source.slice("path+".length));
    const target = relative(contractsRoot, dirname(manifestPath)).split("/")[0];
    if (target && !target.startsWith("..") && packageIds.has(target)) internalDependencies.push(target);
  }
  return [...new Set(internalDependencies)].sort();
}

async function hasManifest(id) {
  try {
    await access(resolve(contractsRoot, id, "Scarb.toml"));
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function buildMatrix() {
  const entries = await readdir(contractsRoot, { withFileTypes: true });
  const packageIds = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const packageIdSet = new Set(packageIds);
  const packages = [];
  for (const id of packageIds) {
    if (await hasManifest(id)) packages.push(await describePackage(id, packageIdSet));
  }
  return { schemaVersion: 1, packages };
}

const generated = `${JSON.stringify(await buildMatrix(), null, 2)}\n`;
if (checkOnly) {
  const committed = await readFile(outputPath, "utf8");
  if (committed !== generated)
    throw new Error("package lock matrix is stale; run pnpm run generate:package-lock-matrix");
} else {
  await writeFile(outputPath, generated);
}
