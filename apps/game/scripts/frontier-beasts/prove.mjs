import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runProof, waitFor } from "../prove-run.mjs";

/** Drive the visible model and site controls, capture their drawn result, and release the WebGL page. */
export async function proveBeasts(b, out, records, baseUrl, only) {
  await b.run("set", "viewport", "1600", "1000");
  if (!only || only === "weak-concepts") await proveConcepts(b, out, records, baseUrl);
  for (const scenario of [
    { name: "weak-options-gameplay", group: "weak-options", focus: "lineup", models: 5, species: "minotaur" },
    ...["ghoul", "kappa", "wraith"].flatMap((name, index) => [
      { name: `${name}-study`, group: "weak-options", focus: String(index + 1), models: 5, species: "minotaur" },
      {
        name: `${name}-rear`,
        group: "weak-options",
        focus: String(index + 1),
        models: 5,
        species: "minotaur",
        yaw: "180",
        lighting: "sunset",
      },
    ]),
    ...["wyvern", "hydra"].flatMap((beast) => [
      { name: `${beast}-gameplay`, group: `species-${beast}`, focus: "lineup", models: 2, species: beast },
      { name: `${beast}-sculpt`, group: `species-${beast}`, focus: "1", models: 2, species: beast },
      {
        name: `${beast}-rear`,
        group: `species-${beast}`,
        focus: "1",
        models: 2,
        species: beast,
        yaw: "180",
        lighting: "sunset",
      },
    ]),
    { name: "creatures-gameplay", group: "creatures", focus: "lineup", models: 2, species: "troll" },
    { name: "models-gameplay", group: "models", focus: "lineup", models: 5, species: "troll" },
    { name: "ruins-gameplay", group: "ruins", focus: "lineup", models: 8, species: "troll" },
    ...[0, 1, 2, 3].map((depth) => ({
      name: `ruin-depth-${depth}`,
      group: "ruins",
      focus: String(depth),
      models: 8,
      species: ["troll", "wyvern", "hydra", "hydra"][depth],
      depth: String(depth),
    })),
    { name: "approved-troll", group: "models", focus: "0", models: 5, species: "troll" },
    { name: "standing-sites", group: "sites", focus: "lineup", models: 7, species: "troll" },
    {
      name: "lowly-beast",
      group: "beasts",
      focus: "0",
      models: 2,
      species: "minotaur",
      band: "lowly",
      panel: true,
    },
    {
      name: "stronger-beast",
      group: "beasts",
      focus: "1",
      models: 2,
      species: "cyclops",
      band: "stronger",
      panel: true,
    },
    { name: "wyvern-panel", group: "models", focus: "1", models: 5, species: "wyvern", depth: "1", panel: true },
    { name: "hydra-panel", group: "models", focus: "2", models: 5, species: "hydra", depth: "2", panel: true },
  ].filter((scenario) => !only || scenario.name === only)) {
    const record = { name: scenario.name, ready: false, presses: [], checks: [] };
    records.push(record);
    try {
      await b.run(
        "open",
        `${baseUrl}/lab/models?family=beasts&rendererMode=webgpu-force-webgl`,
        "--ignore-https-errors",
      );
      record.ready = await waitFor(b, 'document.querySelector("[data-beasts-ready=true]")', 60000);
      if (!record.ready) continue;
      for (const [label, value] of [
        ["Set", scenario.group],
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
      if (scenario.group === "weak-options") {
        const expected = [
          "/models/frontier/beast-minotaur.glb",
          ...["ghoul", "kappa", "wraith"].map((name) => `/lab/frontier-beasts/beast-${name}.glb`),
          "/models/frontier/beast-cyclops.glb",
        ];
        record.checks.push({
          check: "the requested monster comparison or detail was drawn",
          ok: (focus === "lineup" ? expected : [expected[focus]]).every((path) => actual?.drawnAssets?.includes(path)),
          actual: actual?.drawnAssets,
        });
      }

      if (scenario.group.startsWith("species-") && focus === "lineup") {
        const expected = [
          `/models/frontier/beast-${scenario.species}.glb`,
          `/lab/frontier-beasts/beast-${scenario.species}.glb`,
        ];
        record.checks.push({
          check: "current and creature study drawn together",
          ok: expected.every((path) => actual?.drawnAssets.includes(path)),
          actual: actual?.drawnAssets,
        });
      }
      if (focus === "lineup")
        record.checks.push({ check: "every model part was drawn", ok: actual?.drawnParts.length === scenario.models });
      const labels = await b.evaluate(`(() => {
        const canvas = document.querySelector('.model-lineup canvas');
        return Array.from(document.querySelectorAll('.model-lineup-label')).filter(label => !label.hidden).map(label => ({
          text: label.textContent, width: label.getBoundingClientRect().width,
          aboveCanvas: Number(getComputedStyle(label).zIndex) > Number(getComputedStyle(canvas).zIndex),
        }));
      })()`);
      const expectedLabels =
        focus === "lineup" ? (["sites", "ruins"].includes(scenario.group) ? 4 : scenario.models) : 1;
      record.checks.push({
        check: "names are visible above the model canvas",
        ok: labels.length === expectedLabels && labels.every((label) => label.width > 0 && label.aboveCanvas),
        actual: labels,
      });
      if (scenario.band) {
        await b.run("select", 'select[aria-label="Site"]', "3");
        await b.run("select", 'select[aria-label="Beast strength"]', scenario.band);
        record.presses.push({ action: `Select ${scenario.band} beast`, status: "led" });
      }
      if (scenario.depth) {
        await b.run("select", 'select[aria-label="Depth"]', scenario.depth);
        record.presses.push({ action: `Select depth ${scenario.depth}`, status: "led" });
      }
      const plate = await b.evaluate(`(() => {
        const p=document.querySelector('[data-after] .mp-plate');
        return { rows: Array.from(p.querySelectorAll('.mp-plate__row')).map(row=>row.textContent), icon:p.querySelector('img')?.dataset.icon, tier:!!p.querySelector('.ui-tier') || /T[123]/.test(p.textContent) };
      })()`);
      const speciesName = scenario.species[0].toUpperCase() + scenario.species.slice(1);
      record.checks.push({
        check: "species title follows site name, with its own icon and no tier badge",
        ok:
          plate.rows[1] === speciesName &&
          !plate.rows[0].includes(speciesName) &&
          plate.icon === `beast-${scenario.species}` &&
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
          ok:
            panel.text?.includes(speciesName) &&
            panel.icons.includes(`beast-${scenario.species}`) &&
            !/T[123]/.test(panel.text),
          actual: panel,
        });
      }
      const icons = await b.evaluate(
        `Array.from(document.querySelectorAll('.beast-icon-studies img')).map(img=>({width:img.getBoundingClientRect().width,loaded:img.complete&&img.naturalWidth>0,meaning:img.dataset.icon}))`,
      );
      record.checks.push({
        check: "five distinct species paintings decoded at real 20px HUD size",
        ok:
          icons.length === 5 &&
          new Set(icons.map((icon) => icon.meaning)).size === 5 &&
          icons.every((icon) => icon.width === 20 && icon.loaded),
        actual: icons,
      });
      await b.run("screenshot", join(out, `${scenario.name}.png`));
    } finally {
      await b.run("open", "about:blank");
    }
  }
  if (records.length === 0) throw new Error("No beast proof scenario matched");
}
async function proveConcepts(b, out, records, baseUrl) {
  const record = { name: "weak-concepts", ready: false, presses: [], checks: [] };
  records.push(record);
  try {
    await b.run(
      "open",
      `${baseUrl}/lab/models?family=beasts&group=weak-concepts&rendererMode=webgpu-force-webgl`,
      "--ignore-https-errors",
    );
    record.ready = await waitFor(
      b,
      `document.querySelectorAll('.beast-concepts img').length===4 && [...document.querySelectorAll('.beast-concepts img')].every(image=>image.complete && image.naturalWidth>0)`,
      60000,
    );
    const names = await b.evaluate(
      `Array.from(document.querySelectorAll('.beast-concepts strong')).map(node=>node.textContent)`,
    );
    record.checks.push({
      check: "four distinct monster concepts loaded",
      ok: record.ready && JSON.stringify(names) === JSON.stringify(["Ghoul", "Kappa", "Wraith", "Golem"]),
      actual: names,
    });
    await b.run("screenshot", join(out, "weak-concepts.png"), "--full");
    await b.run("click", '.beast-concepts a[href*="focus=1"]');
    record.presses.push({ action: "View model from first concept", status: "led" });
    const linked = await waitFor(
      b,
      `(() => { const node=document.querySelector('[data-lineup-rendered]'); if(!node)return false;const value=JSON.parse(node.dataset.lineupRendered);return document.querySelector('[data-group="weak-options"]')&&value.focus===1&&value.models===5&&value.drawnAssets.includes('/lab/frontier-beasts/beast-ghoul.glb')&&value.calls>0;})()`,
      60000,
    );
    record.checks.push({ check: "concept link opens the actual model in its comparison", ok: linked });
    await b.run("screenshot", join(out, "concept-to-model.png"));
  } finally {
    await b.run("open", "about:blank");
  }
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
    (b, out, records) => proveBeasts(b, out, records, baseUrl, process.argv[4]),
  );
}
