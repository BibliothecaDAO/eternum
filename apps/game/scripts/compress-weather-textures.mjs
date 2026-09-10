import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Requires KTX-Software's toktx. Keep the PNGs as the lossless authoring sources.
for (const name of ["lightning-bolt", "lightning-ground-flash", "rain-drops", "rain-splashes"]) {
  const source = fileURLToPath(new URL(`../public/textures/weather/${name}.png`, import.meta.url));
  const target = source.replace(/\.png$/, ".ktx2");
  execFileSync(
    "toktx",
    [
      "--t2",
      "--encode",
      "uastc",
      "--uastc_quality",
      "3",
      "--zcmp",
      "18",
      "--assign_oetf",
      "srgb",
      "--lower_left_maps_to_s0t0",
      "--threads",
      "4",
      target,
      source,
    ],
    { stdio: "inherit" },
  );
}
