import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runProof, waitFor } from "../prove-run.mjs";
import { BEASTS, DEEP_BEASTS, LAYER_NAMES, beastModel, beastOf, beastsOfFamily } from "@bibliothecadao/types";

const MODEL_COUNT = new Set([...Object.values(BEASTS), ...Object.values(DEEP_BEASTS)].map(beastModel)).size;
const BEAST_COUNT = Object.keys(BEASTS).length;
const RUINS = beastsOfFamily("ruin");
const SELECTED_AT_START = beastOf("ruin", 0);

/** Drive the visible model and site controls, capture their drawn result, and release the WebGL page. */
export async function proveBeasts(b, out, records, baseUrl, only, rendererMode = "webgpu-force-webgl") {
  if (!["webgpu-force-webgl", "webgpu-auto"].includes(rendererMode)) throw new Error("Unknown renderer mode");
  await b.run(
    "open",
    "about:blank",
    "--args",
    "--ignore-gpu-blocklist,--enable-gpu,--use-angle=vulkan,--enable-features=Vulkan,--enable-unsafe-webgpu",
  );
  await b.run("set", "viewport", "1600", "1000");
  for (const scenario of [
    { name: "models-gameplay", group: "models", focus: "lineup", models: MODEL_COUNT, labels: MODEL_COUNT },
    { name: "ruins-gameplay", group: "ruins", focus: "lineup", models: RUINS.length * 2, labels: RUINS.length },
    { name: "families-gameplay", group: "families", focus: "lineup", models: BEAST_COUNT, labels: BEAST_COUNT },
    { name: "standing-sites", group: "sites", focus: "lineup", models: 6, labels: 4 },
    ...Array.from({ length: MODEL_COUNT }, (_, index) => [
      { name: `model-${index}-detail`, group: "models", focus: String(index), models: MODEL_COUNT },
      {
        name: `model-${index}-rear`,
        group: "models",
        focus: String(index),
        models: MODEL_COUNT,
        yaw: "180",
        lighting: "sunset",
      },
    ]).flat(),
    ...RUINS.map((beast) => ({
      name: `ruin-${LAYER_NAMES[beast.layer]}`,
      group: "ruins",
      focus: String(beast.layer),
      models: RUINS.length * 2,
      beast,
      site: "2",
      layer: String(beast.layer),
      panel: true,
    })),
    ...[0, 1, 2].flatMap((layer) =>
      [
        { family: "camp", site: "0", focus: "0" },
        { family: "rift", site: "1", focus: "1" },
      ].map(({ family, site, focus }) => ({
        name: `${family}-${LAYER_NAMES[layer]}`,
        group: "sites",
        focus,
        models: 6,
        beast: beastOf(family, layer),
        site,
        layer: String(layer),
        panel: true,
      })),
    ),
    ...[0, 1, 2].flatMap((layer) =>
      [
        { family: "herd", band: "lowly", focus: "0" },
        { family: "band", band: "stronger", focus: "1" },
      ].map(({ family, band, focus }) => ({
        name: `${band}-beast-${LAYER_NAMES[layer]}`,
        group: "beasts",
        focus,
        models: 2,
        beast: beastOf(family, layer),
        band,
        layer: String(layer),
        panel: true,
      })),
    ),
  ].filter((scenario) => !only || scenario.name === only)) {
    const record = { name: scenario.name, ready: false, presses: [], checks: [] };
    records.push(record);
    try {
      await b.run("open", `${baseUrl}/lab/models?family=beasts&rendererMode=${rendererMode}`, "--ignore-https-errors");
      record.ready = await waitFor(b, 'document.querySelector("[data-beasts-ready=true]")', 60000);
      if (!record.ready) continue;
      for (const [label, value] of [
        ["Set", scenario.group],
        ["Layer", scenario.layer ?? "0"],
        ["View", scenario.focus],
        ["Turn", scenario.yaw ?? "30"],
        ["Light", scenario.lighting ?? "day"],
      ]) {
        await b.run("select", `select[aria-label="${label}"]`, value);
        record.presses.push({
          action: `${label}: ${value}`,
          status:
            (await b.evaluate(`document.querySelector('select[aria-label="${label}"]').value`)) === value
              ? "led"
              : "failed",
        });
        await waitFor(b, 'document.querySelector("[data-beasts-ready=true]")', 60000);
      }
      record.renderer = await b.evaluate("window.__rendererDiagnostics");
      record.checks.push({
        check: "requested renderer backend is active",
        ok: record.renderer?.activeMode === (rendererMode === "webgpu-auto" ? "webgpu" : "webgl2-fallback"),
        actual: record.renderer,
      });
      const focus = scenario.focus === "lineup" ? "lineup" : Number(scenario.focus);
      const rendered = await waitFor(
        b,
        `(() => {const node=document.querySelector('[data-lineup-rendered]');if(!node)return false;const value=JSON.parse(node.dataset.lineupRendered);return value.focus===${JSON.stringify(focus)}&&value.models===${scenario.models}&&value.yaw===${Number(scenario.yaw ?? 30)}&&value.lighting===${JSON.stringify(scenario.lighting ?? "day")}&&value.calls>0;})()`,
        15000,
      );
      const actual = await b.evaluate(
        `(() => {const node=document.querySelector('[data-lineup-rendered]');return node?JSON.parse(node.dataset.lineupRendered):null;})()`,
      );
      record.checks.push({ check: "controls reached the rendered model selection", ok: rendered, actual });
      if (focus === "lineup")
        record.checks.push({ check: "every model part was drawn", ok: actual?.drawnParts.length === scenario.models });
      if (scenario.beast && focus !== "lineup")
        record.checks.push({
          check: "the focused site draws its beast's model",
          ok: actual?.focusParts?.includes(`/models/frontier/beast-${beastModel(scenario.beast)}.glb`) === true,
          actual: actual?.focusParts,
        });
      const labels = await b.evaluate(`(() => {
        const canvas = document.querySelector('.model-lineup canvas');
        return Array.from(document.querySelectorAll('.model-lineup-label')).filter(label => !label.hidden).map(label => ({
          text: label.textContent, width: label.getBoundingClientRect().width,
          aboveCanvas: Number(getComputedStyle(label).zIndex) > Number(getComputedStyle(canvas).zIndex),
        }));
      })()`);
      const expectedLabels = focus === "lineup" ? scenario.labels : 1;
      if (scenario.beast && focus !== "lineup")
        record.checks.push({
          check: "the focused model's label names its beast",
          ok: labels.length === 1 && labels[0].text.includes(scenario.beast.name),
          actual: labels,
        });
      if (scenario.group === "families")
        record.checks.push({
          check: "every beast of the table has its label",
          ok: Object.values(BEASTS).every((beast) => labels.some((label) => label.text.startsWith(beast.name))),
          actual: labels,
        });
      record.checks.push({
        check: "names are visible above the model canvas",
        ok: labels.length === expectedLabels && labels.every((label) => label.width > 0 && label.aboveCanvas),
        actual: labels,
      });
      if (scenario.site) await b.run("select", 'select[aria-label="Site"]', scenario.site);
      if (scenario.band) {
        await b.run("select", 'select[aria-label="Site"]', "3");
        await b.run("select", 'select[aria-label="Beast strength"]', scenario.band);
        record.presses.push({ action: `Select ${scenario.band} beast`, status: "led" });
      }
      const plate = await b.evaluate(`(() => {
        const p=document.querySelector('[data-after] .mp-plate');
        return { rows: Array.from(p.querySelectorAll('.mp-plate__row')).map(row=>row.textContent), icon:p.querySelector('img')?.dataset.icon, tier:!!p.querySelector('.ui-tier') || /T[123]/.test(p.textContent) };
      })()`);
      const beast = scenario.beast ?? SELECTED_AT_START;
      const speciesName = beast.name;
      const portrait = `beast-${beastModel(beast)}`;
      record.checks.push({
        check: "species title follows site name, with its own icon and no tier badge",
        ok:
          plate.rows[1] === speciesName &&
          !plate.rows[0].includes(speciesName) &&
          plate.icon === portrait &&
          !plate.tier,
        actual: plate,
      });
      if (scenario.panel) {
        await b.run("find", "role", "button", "click", "--name", "Select site", "--exact");
        record.presses.push({
          action: "Select site",
          status: (await waitFor(b, 'document.querySelector("[role=dialog]")', 5000)) ? "led" : "failed",
        });
        const panel = await b.evaluate(
          `(() => {const p=document.querySelector('[role=dialog]');return {text:p?.textContent,icons:Array.from(p?.querySelectorAll('[data-icon]')??[]).map(i=>i.dataset.icon)};})()`,
        );
        record.checks.push({
          check: "selected panel shares the species portrait and omits the beast tier",
          ok: panel.text?.includes(speciesName) && panel.icons.includes(portrait) && !/T[123]/.test(panel.text),
          actual: panel,
        });
      }
      const icons = await b.evaluate(
        `Array.from(document.querySelectorAll('.beast-icon-studies img')).map(img=>({width:img.getBoundingClientRect().width,loaded:img.complete&&img.naturalWidth>0,meaning:img.dataset.icon}))`,
      );
      record.checks.push({
        check: "every model's distinct painting decoded at real 20px HUD size",
        ok:
          icons.length === MODEL_COUNT &&
          new Set(icons.map((icon) => icon.meaning)).size === MODEL_COUNT &&
          icons.every((icon) => icon.width === 20 && icon.loaded),
        actual: icons,
      });
      await b.run("screenshot", join(out, `${scenario.name}.png`));
      if (scenario.group === "models" && focus !== "lineup") {
        await b.run("wait", "1100");
        await b.run("screenshot", join(out, `${scenario.name}-later.png`));
      }
    } finally {
      await b.run("open", "about:blank");
    }
  }
  if (records.length === 0) throw new Error("No beast proof scenario matched");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const baseUrl = process.argv[2] ?? "https://127.0.0.1:4218";
  await runProof(
    {
      parent: resolve(process.argv[3] ?? ".context/beast-proof"),
      name: "beasts",
      baseUrl,
      where: (record) => ({ name: record.name }),
    },
    (b, out, records) => proveBeasts(b, out, records, baseUrl, process.argv[4], process.argv[5]),
  );
}
