import sharp from "sharp";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runProof, waitFor } from "./prove-run.mjs";

/** The browser proof and its automation adapters share these assertions about the actual rendered comparison. */
export function checkRiftGround() {
  const host = document.querySelector("[data-rift-rendered]");
  const rendered = host ? JSON.parse(host.dataset.riftRendered) : null;
  const panels = rendered?.panels ?? [];
  return [
    {
      check: "both comparisons rendered",
      ok: panels.length === 2 && panels.every((panel) => panel.calls > 0),
      rendered,
    },
    { check: "same camera", ok: panels.length === 2 && panels[0].cameraDistance === panels[1].cameraDistance },
    { check: "existing dark fae placement", ok: rendered?.beastScale === 0.75 && rendered?.beastY === 0.2 },
    { check: "proposal adds no draws", ok: panels.length === 2 && panels[1].calls <= panels[0].calls },
    {
      check: "proposal adds no textures",
      ok: panels.length === 2 && panels[0].textures === panels[1].textures,
    },
    { check: "rift is carved into the ground", ok: rendered?.depth >= 0.33 },
    {
      check: "local refinement stays within the lab geometry budget",
      ok:
        rendered?.extraGeometryBytes > 0 &&
        rendered.extraGeometryBytes < 2000000 &&
        rendered.extraTerrainTriangles < 30000,
    },
    {
      check: "both panels draw the existing beast",
      ok: panels.length === 2 && panels.every((panel) => panel.beastDraws > 0),
    },
    {
      check: "only the current panel draws the slab",
      ok: panels.length === 2 && panels[0].baseDraws > 0 && panels[1].baseDraws === 0,
    },
    { check: "no horizontal overflow", ok: document.documentElement.scrollWidth <= innerWidth },
  ];
}

/** Sample the actual screenshot outside the old slab, where only a full-hex treatment can change the soil. */
export async function checkRiftGroundPixels(path, rendered) {
  const { data, info } = await sharp(path).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const brightness = ({ x, y }) => {
    const samples = [];
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const offset = (Math.round(y + dy) * info.width + Math.round(x + dx)) * info.channels;
        samples.push(data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722);
      }
    return samples.reduce((sum, value) => sum + value, 0) / samples.length;
  };
  const current = rendered.panels[0].groundProbes.map(brightness);
  const proposal = rendered.panels[1].groundProbes.map(brightness);
  const creepCurrent = rendered.panels[0].creepProbes.map(brightness);
  const creepProposal = rendered.panels[1].creepProbes.map(brightness);
  const outsideCurrent = rendered.panels[0].outsideProbes.map(brightness);
  const outsideProposal = rendered.panels[1].outsideProbes.map(brightness);
  return [
    {
      check: "soil beyond the old slab is visibly infested",
      ok: proposal.every((value, i) => value < 70 && value < current[i] * 0.6),
      current,
      proposal,
    },
    {
      check: "infestation crosses the hex edge on top of the neighboring biome",
      ok: creepProposal.every((value, i) => value < creepCurrent[i] * 0.75),
      current: creepCurrent,
      proposal: creepProposal,
    },
    {
      check: "neighboring soil between tendrils is unchanged",
      ok: outsideProposal.every((value, i) => Math.abs(value - outsideCurrent[i]) < 8),
      current: outsideCurrent,
      proposal: outsideProposal,
    },
  ];
}

/** Compare live trough and crest frames at the projected recessed floor, without setting the animation clock. */
export async function checkRiftPulsePixels(lowPath, highPath, rendered) {
  const { x, y } = rendered.panels[1].pulseProbe;
  const low = await sharp(lowPath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const high = await sharp(highPath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let strongest = { low: 0, high: 0, difference: 0 };
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++) {
      const offset = (Math.round(y + dy) * high.info.width + Math.round(x + dx)) * high.info.channels;
      if (high.data[offset] < high.data[offset + 1] * 1.3 || high.data[offset + 2] < high.data[offset + 1] * 1.3)
        continue;
      const brightness = (data) => data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722;
      const difference = brightness(high.data) - brightness(low.data);
      if (difference > strongest.difference)
        strongest = { low: brightness(low.data), high: brightness(high.data), difference };
    }
  return { check: "recessed floor visibly pulses", ok: strongest.difference > 20, ...strongest };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const baseUrl = process.argv[2] ?? "https://127.0.0.1:4210";
  await runProof(
    {
      parent: resolve(process.argv[3] ?? ".context/rift-ground-proof"),
      name: "rift-ground",
      baseUrl,
      where: (record) => ({ name: record.name }),
    },
    async (b, out, records) => {
      for (const [device, width, height] of [
        ["desktop", 1440, 1000],
        ["phone", 390, 844],
      ]) {
        b.run("set", "viewport", String(width), String(height));
        for (const mode of ["webgpu-auto", "webgpu-force-webgl"]) {
          for (const biome of ["grassland", "desert", "snow"]) {
            for (const view of ["detail", "play"]) {
              const name = `${device}-${mode}-${biome}-${view}`;
              b.run(
                "open",
                `${baseUrl}/lab/models?family=rift-ground&rendererMode=${mode}&biome=${biome}&view=${view}`,
                "--ignore-https-errors",
              );
              const ready = await waitFor(b, 'Boolean(document.querySelector("[data-rift-rendered]"))', 60000);
              records.push({
                name,
                ready,
                presses: [],
                checks: ready ? b.evaluate(`(${checkRiftGround.toString()})()`) : [],
              });
              const screenshot = join(out, `${name}.png`);
              b.run("screenshot", screenshot, "--full");
              if (ready) {
                records
                  .at(-1)
                  .checks.push(...(await checkRiftGroundPixels(screenshot, records.at(-1).checks[0].rendered)));
                const lowPath = join(out, `${name}-pulse-low.png`),
                  highPath = join(out, `${name}-pulse-high.png`);
                await waitFor(
                  b,
                  'JSON.parse(document.querySelector("[data-rift-rendered]").dataset.riftRendered).pulse < 0.005',
                  10000,
                );
                b.run("screenshot", lowPath, "--full");
                await waitFor(
                  b,
                  'JSON.parse(document.querySelector("[data-rift-rendered]").dataset.riftRendered).pulse > 0.97',
                  10000,
                );
                b.run("screenshot", highPath, "--full");
                records
                  .at(-1)
                  .checks.push(await checkRiftPulsePixels(lowPath, highPath, records.at(-1).checks[0].rendered));
              }
              b.run("open", "about:blank");
            }
          }
        }
      }
    },
  );
}
