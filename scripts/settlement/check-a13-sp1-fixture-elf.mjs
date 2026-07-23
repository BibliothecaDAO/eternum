import { assertExpectedFixtureElfIdentity, readFixtureElfIdentity } from "./check-a13-sp1-fixture-execution.mjs";

const elfPath = process.env.A13_SP1_ELF;

assert(elfPath, "A13_SP1_ELF is required");

const identity = readFixtureElfIdentity(elfPath);

console.log(JSON.stringify({ schema: "eternum.a13.sp1-elf-observation.v1", ...identity }));

assertExpectedFixtureElfIdentity(identity);

console.log(
  JSON.stringify({
    schema: "eternum.a13.sp1-elf-verification.v1",
    result: "pass",
    ...identity,
  }),
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
