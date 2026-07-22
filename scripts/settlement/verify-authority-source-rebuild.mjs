import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { hash } from "starknet";
import {
  computeHistoricalStorageLayoutIdentityHash,
  hashAuthorityDomain,
} from "../../packages/settlement-codec/src/authority-commitments.ts";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const observation = readJson("packages/settlement-codec/schema/onchain-observation-a20-v1.json");
const rebuild = observation.deployedSourceRebuild;
const sierraArtifactPath = "target/release/mmr_MMRToken.contract_class.json";
const casmArtifactPath = "target/release/mmr_MMRToken.compiled_contract_class.json";

verifyPinnedSourceInputs();
verifyPinnedToolchain();
const cleanBuilds = [0, 1].map(runCleanHistoricalBuild);
verifyCleanBuildResults(cleanBuilds);
await verifyRpcRepresentableClass(cleanBuilds[0].sierraClass);

console.log(
  JSON.stringify({
    cleanBuildCount: cleanBuilds.length,
    compiledClassHash: cleanBuilds[0].compiledClassHash,
    result: "verified",
    rpcRepresentableCanonicalSha256: rebuild.rpcRepresentableCanonicalSha256,
    sierraClassHash: cleanBuilds[0].sierraClassHash,
    sourceCommit: rebuild.sourceCommit,
  }),
);

function verifyPinnedSourceInputs() {
  for (const source of [
    sourceInput("source", rebuild.sourcePath, rebuild.sourceGitBlob, rebuild.sourceSha256),
    sourceInput("manifest", rebuild.manifestPath, rebuild.manifestGitBlob, rebuild.manifestSha256),
    sourceInput("lockfile", rebuild.lockfilePath, rebuild.lockfileGitBlob, rebuild.lockfileSha256),
  ]) {
    assertEqual(gitObjectId(rebuild.sourceCommit, source.path), source.gitBlob, `${source.label} Git blob`);
    assertEqual(sha256(gitFile(rebuild.sourceCommit, source.path)), source.sha256, `${source.label} SHA-256`);
  }
  assertEqual(
    sha256(readFileSync(resolve(repositoryRoot, rebuild.sourcePath))),
    rebuild.sourceSha256,
    "current source SHA-256",
  );
  const historicalSource = gitFile(rebuild.sourceCommit, rebuild.sourcePath).toString("utf8");
  assertEqual(
    hashAuthorityDomain(extractStorageLayout(historicalSource)),
    rebuild.topLevelStorageDeclarationHash,
    "historical top-level storage declaration hash",
  );
  assertEqual(
    computeHistoricalStorageLayoutIdentityHash(rebuild),
    rebuild.storageLayoutIdentityHash,
    "historical storage layout identity hash",
  );
  execFileSync(
    "git",
    [
      "diff",
      "--exit-code",
      `${rebuild.sourceCommit}..${rebuild.lastPredeclarationCommit}`,
      "--",
      rebuild.sourcePath,
      rebuild.manifestPath,
      rebuild.lockfilePath,
    ],
    { cwd: repositoryRoot, stdio: "pipe" },
  );
}

function extractStorageLayout(source) {
  const match = source.match(/#\[storage\]\s*struct Storage\s*\{[\s\S]*?\n    \}/);
  if (!match) throw new Error("historical MMR token storage layout was not found");
  return match[0].replace(/\s+/g, " ").trim();
}

function sourceInput(label, path, gitBlob, sourceSha256) {
  return { label, path, gitBlob, sha256: sourceSha256 };
}

function verifyPinnedToolchain() {
  const version = execFileSync("scarb", ["--version"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: historicalBuildEnvironment(),
  });
  for (const expected of [
    `scarb ${rebuild.toolchain.scarbVersion} (${rebuild.toolchain.scarbBuildCommit}`,
    `cairo: ${rebuild.toolchain.cairoVersion}`,
    `sierra: ${rebuild.toolchain.sierraVersion}`,
  ]) {
    if (!version.includes(expected)) throw new Error(`historical MMR toolchain mismatch: missing ${expected}`);
  }
}

function runCleanHistoricalBuild(buildIndex) {
  const temporaryRoot = mkdtempSync(join(tmpdir(), `eternum-a20-mmr-${buildIndex}-`));
  try {
    exportHistoricalPackage(temporaryRoot);
    const packageRoot = resolve(temporaryRoot, "contracts/mmr");
    execFileSync("scarb", ["--release", "build"], {
      cwd: packageRoot,
      env: historicalBuildEnvironment(),
      stdio: "pipe",
    });
    return readBuildResult(buildIndex, packageRoot);
  } finally {
    rmSync(temporaryRoot, { force: true, recursive: true });
  }
}

function exportHistoricalPackage(temporaryRoot) {
  const archive = execFileSync("git", ["archive", rebuild.sourceCommit, "contracts/mmr"], {
    cwd: repositoryRoot,
  });
  execFileSync("tar", ["-x", "-C", temporaryRoot], { input: archive });
}

function historicalBuildEnvironment() {
  return { ...process.env, ASDF_SCARB_VERSION: rebuild.toolchain.scarbVersion };
}

function readBuildResult(buildIndex, packageRoot) {
  const sierraArtifact = readFileSync(resolve(packageRoot, sierraArtifactPath));
  const casmArtifact = readFileSync(resolve(packageRoot, casmArtifactPath));
  const sierraClass = JSON.parse(sierraArtifact);
  const casmClass = JSON.parse(casmArtifact);
  return {
    buildIndex,
    sierraArtifactSha256: sha256(sierraArtifact),
    casmArtifactSha256: sha256(casmArtifact),
    sierraClass,
    sierraClassHash: hash.computeSierraContractClassHash(sierraClass),
    compiledClassHash: hash.computeCompiledClassHash(casmClass),
  };
}

function verifyCleanBuildResults(cleanBuilds) {
  assertJsonEqual(
    cleanBuilds.map(({ buildIndex, sierraArtifactSha256, casmArtifactSha256 }) => ({
      buildIndex,
      sierraArtifactSha256,
      casmArtifactSha256,
    })),
    rebuild.cleanBuilds,
    "two clean historical MMR builds",
  );
  for (const build of cleanBuilds) {
    assertFeltEqual(build.sierraClassHash, rebuild.sierraClassHash, `clean build ${build.buildIndex} Sierra class`);
    assertFeltEqual(
      build.sierraClassHash,
      observation.declaration.classHash,
      `clean build ${build.buildIndex} declaration`,
    );
    assertFeltEqual(
      build.compiledClassHash,
      rebuild.compiledClassHash,
      `clean build ${build.buildIndex} compiled class`,
    );
    assertFeltEqual(
      build.compiledClassHash,
      observation.declaration.compiledClassHash,
      `clean build ${build.buildIndex} declared compiled class`,
    );
  }
}

async function verifyRpcRepresentableClass(rebuiltClass) {
  const rpcClass = await rpcResult("starknet_getClass", [
    { block_number: observation.declaration.blockNumber },
    observation.classHash,
  ]);
  const normalizedRebuild = { ...rebuiltClass };
  delete normalizedRebuild.sierra_program_debug_info;
  const normalizedRpc = {
    ...rpcClass,
    abi: typeof rpcClass.abi === "string" ? JSON.parse(rpcClass.abi) : rpcClass.abi,
  };
  const rebuiltCanonical = canonicalJson(normalizedRebuild);
  const rpcCanonical = canonicalJson(normalizedRpc);
  assertEqual(rebuiltCanonical, rpcCanonical, "normalized RPC-representable MMR class");
  assertEqual(sha256(rpcCanonical), rebuild.rpcRepresentableCanonicalSha256, "normalized RPC class SHA-256");
  if (!rebuild.rpcRepresentableClassExactMatch) throw new Error("recorded normalized RPC class match is false");
}

async function rpcResult(method, params) {
  const response = await fetch(observation.rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`${method} HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(`${method} failed: ${JSON.stringify(body.error)}`);
  return body.result;
}

function gitObjectId(commit, path) {
  return execFileSync("git", ["rev-parse", `${commit}:${path}`], { cwd: repositoryRoot, encoding: "utf8" }).trim();
}

function gitFile(commit, path) {
  return execFileSync("git", ["show", `${commit}:${path}`], { cwd: repositoryRoot });
}

function canonicalJson(value) {
  return JSON.stringify(sortObjectKeys(value));
}

function sortObjectKeys(value) {
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortObjectKeys(value[key])]),
  );
}

function assertFeltEqual(actual, expected, label) {
  if (BigInt(actual) !== BigInt(expected))
    throw new Error(`${label} mismatch: expected ${expected}, received ${actual}`);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label} mismatch: expected ${expected}, received ${actual}`);
}

function assertJsonEqual(actual, expected, label) {
  assertEqual(JSON.stringify(actual), JSON.stringify(expected), label);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(repositoryRoot, path), "utf8"));
}
