import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { readVisibleUnits } from "../src/ui/features/debug/kit-lab/hud-redesign/sample.mjs";
import {
  coveredPixels,
  inspectHudReview,
  judgeHudReview,
  REFERENCE_FRAMES,
} from "../src/ui/features/debug/kit-lab/hud-redesign/review.mjs";
const app = fileURLToPath(new URL("..", import.meta.url));
const out = resolve(app, "../../../evidence/hud/lab-proof-driver.js");
const review = `const REFERENCE_FRAMES = ${JSON.stringify(REFERENCE_FRAMES)};\n${[coveredPixels, inspectHudReview, judgeHudReview].map((fn) => fn.toString()).join("\n")}`;
const driver = await readFile(resolve(app, "scripts/hud-picker-browser-proof.js"), "utf8");
await mkdir(resolve(out, ".."), { recursive: true });
await writeFile(
  out,
  driver
    .replace("/* HUD_SAMPLER */", readVisibleUnits.toString())
    .replace("/* HUD_REVIEW */", review)
    .replace(/;\s*$/, ""),
);
console.log(out);
