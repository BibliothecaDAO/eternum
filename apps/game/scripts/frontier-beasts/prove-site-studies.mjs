import { join } from "node:path";
import { waitFor } from "../prove-run.mjs";

const concepts = {
  weak: ["ghoul", "kappa", "wraith"],
  ruin: ["basilisk", "ammit", "ent"],
  rift: ["dark-fey"],
};
const contexts = [
  ["ghoul", 0, ["/lab/frontier-beasts/beast-ghoul.glb"]],
  ["kappa", 1, ["/lab/frontier-beasts/beast-kappa.glb"]],
  ["wraith", 2, ["/lab/frontier-beasts/beast-wraith.glb"]],
  ["cyclops", 3, ["/models/frontier/beast-cyclops.glb"]],
  ["troll", 4, ["/models/frontier/beast-troll.glb"]],
  ["dark-fey", 5, ["/models/reward-tiles/rift.glb", "/lab/frontier-beasts/beast-dark-fey.glb"]],
  ["basilisk", 6, ["/models/outposts/ruin.glb", "/lab/frontier-beasts/beast-basilisk.glb"]],
  ["ammit", 7, ["/models/outposts/ruin.glb", "/lab/frontier-beasts/beast-ammit.glb"]],
  ["ruin-I", 8, ["/models/outposts/ruin.glb", "/models/frontier/beast-wyvern.glb"]],
  ["ruin-II", 9, ["/models/outposts/ruin.glb", "/models/frontier/beast-hydra.glb"]],
  ["ruin-III", 10, ["/models/outposts/ruin.glb", "/models/frontier/beast-hydra.glb"]],
];

/** Exercise the single owner-choice page through its visible concept and tile controls. */
export async function proveSiteStudies(b, out, records, baseUrl) {
  const record = { name: "site-map", ready: false, presses: [], checks: [] };
  records.push(record);
  try {
    await b.run(
      "open",
      `${baseUrl}/lab/models?family=beasts&group=site-map&rendererMode=webgpu-force-webgl`,
      "--ignore-https-errors",
    );
    record.ready = await waitFor(b, 'document.querySelector("[data-site-studies-ready=true]")', 60000);
    if (!record.ready) return;
    const overview = await readDrawn(b, "lineup", 0);
    record.checks.push({
      check: "eleven tile contexts draw all seventeen model parts together",
      ok: overview?.drawnParts.length === 17 && overview?.models === 17,
      actual: overview,
    });
    await b.run("screenshot", join(out, "site-map-overview.png"));
    for (const [group, species] of Object.entries(concepts)) {
      await b.run("select", 'select[aria-label="Concepts"]', group);
      record.presses.push({ action: `Concepts: ${group}`, status: "led" });
      const loaded = await waitFor(
        b,
        `(() => {const figures=[...document.querySelectorAll('[data-site-concept]')];return JSON.stringify(figures.map(f=>f.dataset.siteConcept))===${JSON.stringify(JSON.stringify(species))}&&figures.every(f=>f.querySelector('img').complete&&f.querySelector('img').naturalWidth>0);})()`,
        15000,
      );
      record.checks.push({ check: `${group} concept paintings decoded in their choice group`, ok: loaded });
      await b.run("screenshot", join(out, `site-concepts-${group}.png`));
      for (const name of species.filter((name) => name !== "ent")) {
        const [, index, paths] = contexts.find(([candidate]) => candidate === name);
        await b.evaluate(
          `document.querySelector('[data-site-concept="${name}"] button').scrollIntoView({block:"center"})`,
        );
        await b.run("click", `[data-site-concept="${name}"] button`);
        record.presses.push({ action: `Show ${name} on tile`, status: "led" });
        const drawn = await readDrawn(b, index, 0);
        record.checks.push({
          check: `${name} concept button draws the creature with its site context`,
          ok: paths.every((path) => drawn?.drawnAssets.includes(path)),
          actual: drawn?.drawnAssets,
        });
        await b.run("screenshot", join(out, `site-${name}.png`));
      }
    }
    for (const [name, index, paths] of contexts) {
      await b.run("select", 'select[aria-label="Site view"]', String(index));
      record.presses.push({ action: `Site view: ${name}`, status: "led" });
      for (const yaw of [30, 180]) {
        await b.run("select", 'select[aria-label="Turn"]', String(yaw));
        const drawn = await readDrawn(b, index, yaw);
        record.checks.push({
          check: `${name} at ${yaw} degrees focuses its tile and draws its intended site parts`,
          ok: drawn?.focus === index && drawn?.yaw === yaw && paths.every((path) => drawn?.drawnAssets.includes(path)),
          actual: drawn?.drawnAssets,
        });
        const labels = await b.evaluate(
          `Array.from(document.querySelectorAll('.model-lineup-label')).filter(label=>!label.hidden).map(label=>label.textContent)`,
        );
        record.checks.push({
          check: `${name} focus labels only its selected tile`,
          ok: labels.length === 1,
          actual: labels,
        });
        await b.run("screenshot", join(out, `site-${name}-${yaw}.png`));
      }
    }
  } finally {
    await b.run("open", "about:blank");
  }
}

async function readDrawn(b, focus, yaw) {
  const ready = await waitFor(
    b,
    `(() => {const node=document.querySelector('[data-lineup-rendered]');if(!node)return false;const v=JSON.parse(node.dataset.lineupRendered);return v.focus===${JSON.stringify(focus)}&&v.yaw===${yaw}&&v.calls>0;})()`,
    15000,
  );
  if (!ready) throw new Error(`Site renderer did not draw focus ${focus}, yaw ${yaw}`);
  return b.evaluate(
    `(() => {const node=document.querySelector('[data-lineup-rendered]');return node?JSON.parse(node.dataset.lineupRendered):null;})()`,
  );
}
