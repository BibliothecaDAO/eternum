import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { readVisibleUnits } from "../src/ui/features/debug/kit-lab/hud-redesign/sample.mjs";
import { LIVE_SAMPLE } from "./live-sample.mjs";
import {
  coveredPixels,
  inspectHudReview,
  judgeHudReview,
  REFERENCE_FRAMES,
} from "../src/ui/features/debug/kit-lab/hud-redesign/review.mjs";
const app = fileURLToPath(new URL("..", import.meta.url));
const watch = process.argv[2] === "--watch" ? process.argv[3] : null;
if (process.argv.length > 2 && (process.argv[2] !== "--watch" || !/^0x[0-9a-fA-F]+:[1-9][0-9]*$/.test(watch ?? "")))
  throw new Error("--watch expects <chain>:<game>");
const out = resolve(app, `../../../evidence/hud/${watch ? "live" : "lab"}-proof-driver.js`);
const review = `const REFERENCE_FRAMES = ${JSON.stringify(REFERENCE_FRAMES)};\n${[coveredPixels, inspectHudReview, judgeHudReview].map((fn) => fn.toString()).join("\n")}`;
const driver = await readFile(resolve(app, "scripts/hud-picker-browser-proof.js"), "utf8");
await mkdir(resolve(out, ".."), { recursive: true });
await writeFile(
  out,
  driver
    .replace(
      "/* HUD_WATCH_URL */",
      `const WATCH_URL = ${JSON.stringify(watch ? `https://127.0.0.1:4192/g/${watch.replace(":", "/")}?spectate=true` : null)};`,
    )
    .replace("/* HUD_LIVE_SAMPLE */", `const LIVE_SAMPLE = ${JSON.stringify(LIVE_SAMPLE)};`)
    .replace("/* HUD_SAMPLER */", readVisibleUnits.toString())
    .replace("/* HUD_REVIEW */", review)
    .replace(/;\s*$/, ""),
);
console.log(out);
