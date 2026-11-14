import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { wireIds } from "./wire-ids.mjs";

export function checkDiscoveryVectors(vectors, cases) {
  const body = vectors.split("pub fn typed_commands()")[1]?.split("pub fn fresh_world(")[0] ?? "";
  const names = [...body.matchAll(/Command::(\w+)/g)].map((match) => match[1]);
  const live = wireIds.commands.filter(({ retired }) => !retired);
  if (names.length !== live.length || live.some(({ name }, index) => names[index] !== name))
    throw new Error("Update typed_commands in roll_independence.cairo for every live permanent command, in wire order");

  for (const name of [
    "all_typed_entry_refusals_are_root_independent",
    "all_real_domain_verdicts_are_root_independent",
  ]) {
    const attributes = cases.match(new RegExp(`((?:#\\[[^\\n]+\\]\\n)+)fn ${name}\\(`))?.[1] ?? "";
    checkRootGroups(attributes, live.length);
  }
}

function checkRootGroups(attributes, commands) {
  const coverage = new Map();
  for (const match of attributes.matchAll(/test_case\(name: "route_(\d+)_roots_(\d+)_(\d+)", (\d+), (\d+)\)/g)) {
    const [, namedIndex, namedStart, namedEnd, index, start] = match.map(Number);
    if (namedIndex !== index || namedStart !== start || namedEnd !== start + 7 || index >= commands)
      throw new Error("Discovery root case names must match their command index and eight-root range");
    const key = `${index}:${start}`;
    coverage.set(key, (coverage.get(key) ?? 0) + 1);
  }
  if (
    coverage.size !== commands * 4 ||
    Array.from({ length: commands }, (_, index) => index).some((index) =>
      [0, 8, 16, 24].some((start) => coverage.get(`${index}:${start}`) !== 1),
    )
  )
    throw new Error("Add all four root groups for each command to both discovery refusal tests");
}

export function discoveryVectorSources() {
  return [
    readFileSync(new URL("../tests/support/src/tests/roll_independence.cairo", import.meta.url), "utf8"),
    readFileSync(new URL("../tests/discovery-roots/src/tests/roll_independence.cairo", import.meta.url), "utf8"),
  ];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  checkDiscoveryVectors(...discoveryVectorSources());
  console.log("Every live command has typed discovery vectors and all 32 roots in both refusal tests");
}
