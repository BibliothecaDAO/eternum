import { execFileSync } from "node:child_process";
import { wireIds, validateWireIds } from "./wire-ids.mjs";

const path = "contracts/l3/world-native/schema/wire-ids.json";
const commits = execFileSync("git", ["log", "--reverse", "--format=%H", "--", path], { encoding: "utf8" })
  .trim()
  .split("\n")
  .filter(Boolean);
let previous;
for (const commit of commits) {
  const registry = JSON.parse(execFileSync("git", ["show", `${commit}:${path}`], { encoding: "utf8" }));
  validateWireIds(registry, previous);
  previous = registry;
}
validateWireIds(wireIds, previous);
console.log("Permanent command and story wire allocations preserved");
