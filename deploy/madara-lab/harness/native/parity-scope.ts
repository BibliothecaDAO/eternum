import { readFile, readdir } from "node:fs/promises";
import sliceFixture from "../../../../contracts/l3/world-native/fixtures/slice.json";
import { requiredParityCases } from "./parity-report";

const directory = new URL("../../../../contracts/l3/world-native/fixtures/", import.meta.url);
const projectionTest = "eternum::native_parity::world_parity_projection_ignores_storage_bookkeeping";

export async function readDomainFixtures() {
  const fixtures = [];
  for (const file of (await readdir(directory)).sort()) {
    if (!file.endsWith(".json") || file.endsWith("-parity.json")) continue;
    const fixture = JSON.parse(await readFile(new URL(file, directory), "utf8"));
    if (fixture.domain === undefined) continue;
    if (file !== `${fixture.domain}.json` || !Array.isArray(fixture.parityCases))
      throw new Error(`Invalid domain fixture ${file}`);
    fixtures.push(fixture);
  }
  return fixtures;
}

export function selectParityScope<T extends { domain: string; parityCases: string[]; supplementalTests?: string[] }>(
  fixtures: T[],
  domain?: string,
) {
  const names = new Set(fixtures.map((fixture) => fixture.domain));
  if (names.size !== fixtures.length || names.has("slice")) throw new Error("Conflicting parity domain names");
  if (domain !== undefined && domain !== "slice" && !names.has(domain))
    throw new Error(`Unknown parity domain ${domain}`);
  const declarations = [...sliceFixture.sliceCases, ...fixtures.flatMap((fixture) => fixture.parityCases)];
  const owned = new Set(declarations);
  if (owned.size !== declarations.length) throw new Error("A parity case belongs to more than one domain");
  for (const name of owned)
    if (!(name in requiredParityCases)) throw new Error(`Undeclared domain parity case ${name}`);
  for (const name of Object.keys(requiredParityCases))
    if (!owned.has(name)) throw new Error(`Missing domain for parity case ${name}`);
  const selected = domain === undefined ? fixtures : fixtures.filter((fixture) => fixture.domain === domain);
  const cases =
    domain === undefined
      ? requiredParityCases
      : Object.fromEntries(
          Object.entries(requiredParityCases).filter(([name]) =>
            domain === "slice" ? sliceFixture.sliceCases.includes(name) : selected[0].parityCases.includes(name),
          ),
        );
  if (Object.keys(cases).length === 0) throw new Error(`Empty parity scope ${domain}`);
  const supplementalTests = selected.flatMap((fixture) => fixture.supplementalTests ?? []);
  if (domain === undefined || domain === "slice") supplementalTests.push(projectionTest);
  return { name: domain ?? "all", fixtures: selected, cases, supplementalTests };
}
