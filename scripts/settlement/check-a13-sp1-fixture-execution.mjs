import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const evidence = readJson("proofs/eternum-settlement/sp1/mmr-plan-a13-fixture-evidence-v0.json");

if (isDirectExecution()) verifyExecutionEvidence();

function verifyExecutionEvidence() {
  const executionLog = process.env.A13_SP1_EXECUTION_LOG;
  const elfPath = process.env.A13_SP1_ELF;

  assert(executionLog, "A13_SP1_EXECUTION_LOG is required");
  assert(elfPath, "A13_SP1_ELF is required");

  const emitted = readExecutionRecord(executionLog);

  assertFixtureElfIdentity(elfPath);
  assertExecutionRecord(emitted);

  console.log(
    JSON.stringify({
      schema: "eternum.a13.sp1-ci-verification.v1",
      result: "pass",
      elfSha256: evidence.fixtureElf.sha256,
      journalHash: evidence.fixtureElf.expectedJournalHash,
      negativeAssertions: emitted.nativeNegativeAssertions.map(({ name, exactError }) => ({ name, exactError })),
    }),
  );
}

export function assertFixtureElfIdentity(relativePath) {
  const absolutePath = resolve(repositoryRoot, relativePath);
  const bytes = readFileSync(absolutePath);
  const identity = { sha256: sha256(bytes), sizeBytes: statSync(absolutePath).size };

  assertEqual(identity.sha256, evidence.fixtureElf.sha256, "A13 rebuilt fixture ELF hash");
  assertEqual(identity.sizeBytes, evidence.fixtureElf.sizeBytes, "A13 rebuilt fixture ELF size");
  return identity;
}

function assertExecutionRecord(record) {
  const canonical = evidence.execution;
  const guest = record.guestExecution;

  assertEqual(record.schema, canonical.schema, "A13 emitted execution schema");
  assertEqual(guest.name, "valid-tie-gap", "A13 emitted valid guest name");
  assertEqual(guest.status, "accepted", "A13 emitted valid guest status");
  assertEqual(guest.publicJournalHashHex, evidence.fixtureElf.expectedJournalHash, "A13 emitted journal hash");
  assertEqual(guest.instructions, canonical.guestExecution.instructions, "A13 deterministic guest instructions");
  assertEqual(guest.syscalls, 0, "A13 emitted guest syscalls");
  assertEqual(guest.totalCycles, guest.instructions, "A13 emitted guest total cycles");
  assertPositiveInteger(guest.elapsedMs, "A13 emitted guest elapsed time");
  assertPositiveInteger(record.proverInitializationMs, "A13 emitted prover initialization");
  assertPositiveInteger(record.suiteElapsedMs, "A13 emitted suite elapsed time");

  assertEqual(Object.hasOwn(record, "fixtures"), false, "A13 parallel fixture output wire removal");
  assertDeepEqual(
    record.nativeNegativeAssertions.map(({ name }) => name).sort(),
    ["bad-snapshot", "substituted-plan-root"],
    "A13 emitted native negative set",
  );
  assertNativeNegative(record.nativeNegativeAssertions, "bad-snapshot", "invalid-plan:snapshot");
  assertNativeNegative(record.nativeNegativeAssertions, "substituted-plan-root", "substituted-plan-root");
}

function assertNativeNegative(entries, name, expectedError) {
  const matches = entries.filter((entry) => entry.name === name);
  assertEqual(matches.length, 1, `A13 ${name} uniqueness`);

  const negative = matches[0];
  assertEqual(negative.status, "rejected", `A13 ${name} rejection status`);
  assertEqual(negative.exactError, expectedError, `A13 ${name} exact error`);
  assertPositiveInteger(negative.elapsedMs, `A13 ${name} elapsed time`);
  assertEqual(Object.hasOwn(negative, "publicOutcomeHex"), false, `A13 ${name} public outcome absence`);
  assertEqual(Object.hasOwn(negative, "publicJournalHashHex"), false, `A13 ${name} public hash absence`);
}

function readExecutionRecord(relativePath) {
  return parseExecutionRecord(readFileSync(resolve(repositoryRoot, relativePath), "utf8"));
}

export function parseExecutionRecord(log) {
  const prefix = "A13_SP1_EXECUTION_EVIDENCE=";
  const records = log.split(/\r?\n/u).flatMap((line) => findExecutionRecords(line, prefix));

  assertEqual(records.length, 1, "A13 emitted execution record count");
  return JSON.parse(records[0]);
}

function findExecutionRecords(line, prefix) {
  const records = [];
  let offset = line.indexOf(prefix);

  while (offset !== -1) {
    records.push(line.slice(offset + prefix.length));
    offset = line.indexOf(prefix, offset + prefix.length);
  }

  return records;
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(repositoryRoot, relativePath), "utf8"));
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertPositiveInteger(value, label) {
  assert(Number.isSafeInteger(value) && value > 0, `${label} must be a positive safe integer`);
}

function assertDeepEqual(actual, expected, label) {
  assertEqual(JSON.stringify(actual), JSON.stringify(expected), label);
}

function assertEqual(actual, expected, label) {
  assert(actual === expected, `${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isDirectExecution() {
  return process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}
