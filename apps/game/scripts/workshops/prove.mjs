import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runProof, waitFor } from "../prove-run.mjs";

const scenarios = [
  { name: "gameplay", view: "14", focus: "lineup", distance: 14, yaw: "30", light: "day" },
  { name: "closer", view: "10", focus: "lineup", distance: 10, yaw: "30", light: "day" },
  { name: "detail", view: "workshop", focus: "workshop", distance: 5, yaw: "30", light: "day" },
  { name: "front", view: "workshop", focus: "workshop", distance: 5, yaw: "0", light: "day" },
  { name: "back", view: "workshop", focus: "workshop", distance: 5, yaw: "180", light: "day" },
  { name: "side", view: "workshop", focus: "workshop", distance: 5, yaw: "270", light: "day" },
  { name: "sunset", view: "10", focus: "lineup", distance: 10, yaw: "30", light: "sunset" },
];

export async function proveWorkshops(b, out, records, baseUrl) {
  await b.run("set", "viewport", "1600", "1000");
  for (const scenario of scenarios) {
    const record = { name: scenario.name, ready: false, presses: [], checks: [] };
    records.push(record);
    try {
      await b.run(
        "open",
        `${baseUrl}/lab/models?family=workshops&rendererMode=webgpu-force-webgl`,
        "--ignore-https-errors",
      );
      record.ready = await waitFor(b, 'document.querySelector("[data-workshop-ready=true]")', 60000);
      if (!record.ready) continue;
      for (const [label, value] of [
        ["View", scenario.view],
        ["Turn", scenario.yaw],
        ["Light", scenario.light],
      ]) {
        await b.run("select", `select[aria-label="${label}"]`, value);
        const selected = await b.evaluate(`document.querySelector('select[aria-label="${label}"]').value`);
        record.presses.push({ action: `${label}: ${value}`, status: selected === value ? "led" : "failed" });
      }
      const expected = {
        distance: scenario.distance,
        focus: scenario.focus === "workshop" ? 1 : "lineup",
        yaw: Number(scenario.yaw),
        lighting: scenario.light,
      };
      const rendered = await waitFor(
        b,
        `(() => { const node=document.querySelector('[data-lineup-rendered]'); if(!node) return false; const drawn=JSON.parse(node.dataset.lineupRendered); return Object.entries(${JSON.stringify(expected)}).every(([key,value]) => drawn[key] === value) && (drawn.focus === "lineup" ? drawn.drawnAssets.length === 3 : drawn.drawnAssets.includes("/models/new-buildings-opt/workshop.glb")); })()`,
        15000,
      );
      const actual = await b.evaluate(`(() => {
        const main = document.querySelector('[data-workshop-ready]');
        const drawn = document.querySelector('[data-lineup-rendered]');
        return { assets: JSON.parse(main.dataset.workshopAssets), drawn: drawn ? JSON.parse(drawn.dataset.lineupRendered) : null,
          overflow: document.documentElement.scrollWidth > innerWidth };
      })()`);
      record.checks.push(
        { check: "control changes reached the rendered view", ok: rendered, expected, actual: actual.drawn },
        {
          check: "three models loaded and selected models drawn at the requested distance",
          ok:
            actual.drawn?.models === 3 &&
            actual.drawn.calls > 0 &&
            (scenario.focus === "lineup"
              ? actual.drawn.drawnAssets.length === 3
              : actual.drawn.drawnAssets.includes("/models/new-buildings-opt/workshop.glb")) &&
            Math.abs(actual.drawn.cameraDistance - scenario.distance) < 0.01,
        },
        {
          check: "production Workshop loaded beside shipped references",
          ok:
            actual.assets.length === 3 &&
            actual.assets.join("|") ===
              [
                "/models/new-buildings-opt/farm.glb",
                "/models/new-buildings-opt/workshop.glb",
                "/models/new-buildings-opt/workers_hut.glb",
              ].join("|"),
          assets: actual.assets,
        },
        { check: "controls fit the viewport", ok: !actual.overflow },
      );
      await b.run("screenshot", join(out, `${scenario.name}.png`));
    } finally {
      await b.run("open", "about:blank");
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const baseUrl = process.argv[2] ?? "https://127.0.0.1:4218";
  await runProof(
    {
      parent: resolve(process.argv[3] ?? ".context/workshop-proof"),
      name: "workshops",
      baseUrl,
      where: (record) => ({ name: record.name }),
    },
    (b, out, records) => proveWorkshops(b, out, records, baseUrl),
  );
}
