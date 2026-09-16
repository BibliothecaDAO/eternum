import { expect, test } from "bun:test";
import { requiredParityCases } from "./parity-report";
import { readDomainFixtures, selectParityScope } from "./parity-scope";

test("the domain matrix covers every declared case and supplemental check exactly once", async () => {
  const fixtures = await readDomainFixtures();
  const shards = ["slice", ...fixtures.map((fixture) => fixture.domain)].map((name) =>
    selectParityScope(fixtures, name),
  );
  const cases = shards.flatMap((shard) => Object.keys(shard.cases));
  expect(cases.sort()).toEqual(Object.keys(requiredParityCases).sort());
  const checks = shards.flatMap((shard) => shard.supplementalTests);
  expect(new Set(checks).size).toBe(checks.length);
  expect(checks.sort()).toEqual(selectParityScope(fixtures).supplementalTests.sort());
});

test("a domain keeps its entire declared workload and only its own measurements", async () => {
  const fixtures = await readDomainFixtures();
  for (const fixture of fixtures) {
    const scope = selectParityScope(fixtures, fixture.domain);
    expect(Object.keys(scope.cases).sort()).toEqual([...fixture.parityCases].sort());
    expect(scope.fixtures).toEqual([fixture]);
  }
  expect(selectParityScope(fixtures, "slice").fixtures).toEqual([]);
});

test("unknown, missing and conflicting domains cannot silently reduce the gate", async () => {
  const fixtures = await readDomainFixtures();
  const first = fixtures[0];
  expect(() => selectParityScope(fixtures, "missing")).toThrow("Unknown parity domain");
  expect(() => selectParityScope(fixtures.slice(1))).toThrow("Missing domain for parity case");
  expect(() => selectParityScope([...fixtures, first])).toThrow("Conflicting parity domain");
  expect(() => selectParityScope([...fixtures, { domain: "slice", parityCases: [] }])).toThrow(
    "Conflicting parity domain",
  );
  expect(() => selectParityScope([...fixtures, { domain: "extra", parityCases: ["missing"] }])).toThrow(
    "Undeclared domain parity case",
  );
  expect(() => selectParityScope([...fixtures, { domain: "extra", parityCases: ["creation"] }])).toThrow(
    "more than one domain",
  );
  expect(() => selectParityScope([...fixtures, { domain: "extra", parityCases: [] }], "extra")).toThrow(
    "Empty parity scope",
  );
});
