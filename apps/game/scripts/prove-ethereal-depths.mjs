import { spawn } from "node:child_process";
import { cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import looks from "../src/three/terrain/ethereal-depths.json" with { type: "json" };
import { withDevClient } from "./lib/dev-client.mjs";
import { writeDepthGallery } from "./ethereal-depths-gallery.mjs";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
};
const out = resolve(arg("--out", `.context/ethereal-depths-${Date.now()}`));
const runner = fileURLToPath(new URL("./run-client-playtest.mjs", import.meta.url));
const shots = [];
mkdirSync(out, { recursive: true });

await withDevClient({ base: arg("--base-url", null), port: arg("--port", "4197"), out }, async (base) => {
  for (const [device, viewport] of [
    ["desktop", "1440x900"],
    ["phone", "390x844"],
  ]) {
    for (const [depth, look] of Object.entries(looks)) {
      const evidence = join(out, `proof-${device}-${depth}`);
      await runProof([
        "--base-url",
        base,
        "--steps",
        `lab-ethereal-${depth}`,
        "--iterations",
        "1",
        "--renderer-modes",
        "webgpu-force-webgl",
        "--viewport",
        viewport,
        "--out",
        evidence,
      ]);
      const run = join(evidence, readdirSync(evidence).sort().at(-1));
      const summary = JSON.parse(readFileSync(join(run, "summary.json")));
      if (!summary.ok) throw new Error(`Failed Frontier proof: ${device}/${depth}`);
      const prefix = "spectator-webgpu-force-webgl-1";
      const transcript = JSON.parse(readFileSync(join(run, `${prefix}-transcript.json`)));
      const file = `frontier-${depth}-${device}.png`;
      const entry = `spire-${depth}-${device}.png`;
      cpSync(join(run, `${prefix}-05-ethereal-${depth}.png`), join(out, file));
      cpSync(join(run, `${prefix}-04-spire-card.png`), join(out, entry));
      shots.push({
        depth,
        device,
        viewport,
        file,
        entry,
        title: look.title,
        source: "Frontier client, lab world with fixture facts",
        proof: transcript.steps.at(-1).played,
      });
      writeFileSync(join(out, "captures.json"), JSON.stringify({ shots }, null, 2) + "\n");
      console.log(`Ready: ${file}`);
    }
  }
});
writeDepthGallery(out, looks, shots);

function runProof(args) {
  return new Promise((done, fail) => {
    const child = spawn(process.execPath, [runner, ...args], { stdio: "inherit" });
    child.once("error", fail);
    child.once("exit", (code) => (code === 0 ? done() : fail(new Error(`Frontier playtest exited ${code}`))));
  });
}
