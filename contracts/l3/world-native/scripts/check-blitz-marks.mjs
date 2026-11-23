import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const BLITZ_MARKS = 121;

const source = "contracts/l3/world-native/src";

export function countBlitzMarks(dir) {
  return readdirSync(dir, { recursive: true })
    .filter((path) => path.endsWith(".cairo"))
    .map((path) => readFileSync(join(dir, path), "utf8"))
    .filter((text) => !text.split("\n", 1)[0].includes("@generated"))
    .reduce((count, text) => count + (text.match(/feature\s*:\s*"blitz"/g)?.length ?? 0), 0);
}

export function checkBlitzMarks(dir, figure) {
  const count = countBlitzMarks(dir);
  if (count > figure)
    return `${source} has ${count} Blitz marks, the most allowed is ${figure}: put Blitz code in a Blitz file picked by the Blitz build (logic/blitz/, balance/blitz/, the way balance.cairo swaps its modules), not as a mark in a Frontier file`;
  if (count < figure)
    return `${source} has ${count} Blitz marks: lower BLITZ_MARKS in contracts/l3/world-native/scripts/check-blitz-marks.mjs to ${count}`;
  return null;
}

export const worldSource = fileURLToPath(new URL("../src", import.meta.url));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const refusal = checkBlitzMarks(worldSource, BLITZ_MARKS);
  if (refusal) {
    console.error(refusal);
    process.exit(1);
  }
  console.log(`${BLITZ_MARKS} Blitz marks, none added`);
}
