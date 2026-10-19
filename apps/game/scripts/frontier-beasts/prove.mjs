import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runProof, waitFor } from "../prove-run.mjs";

/** Drive the visible model and site controls, capture their drawn result, and release the WebGL page. */
export async function proveBeasts(b, out, records, baseUrl) {
  await b.run("set", "viewport", "1600", "1000");
  for (const scenario of [
    { name: "models-gameplay", group: "models", focus: "lineup", models: 6 },
    { name: "minotaur-detail", group: "models", focus: "1", models: 6 },
    { name: "chimera-detail", group: "models", focus: "3", models: 6 },
    { name: "cyclops-detail", group: "models", focus: "5", models: 6 },
    { name: "standing-sites", group: "sites", focus: "lineup", models: 7 },
    { name: "stragglers", group: "stragglers", focus: "lineup", models: 3 },
    { name: "goblin-panel", group: "stragglers", focus: "2", models: 3, panel: true },
  ]) {
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
        `(() => {const node=document.querySelector('[data-lineup-rendered]');if(!node)return false;const value=JSON.parse(node.dataset.lineupRendered);return value.focus===${JSON.stringify(focus)}&&value.models===${scenario.models}&&value.calls>0;})()`,
        15000,
      );
      const actual = await b.evaluate(
        `(() => {const node=document.querySelector('[data-lineup-rendered]');return node?JSON.parse(node.dataset.lineupRendered):null;})()`,
      );
      record.checks.push({ check: "controls reached the rendered model selection", ok: rendered, actual });
      if (focus === "lineup")
        record.checks.push({ check: "every model part was drawn", ok: actual?.drawnParts.length === scenario.models });
      const labels = await b.evaluate(`(() => {
        const canvas = document.querySelector('.model-lineup canvas');
        return Array.from(document.querySelectorAll('.model-lineup-label')).filter(label => !label.hidden).map(label => ({
          text: label.textContent, width: label.getBoundingClientRect().width,
          aboveCanvas: Number(getComputedStyle(label).zIndex) > Number(getComputedStyle(canvas).zIndex),
        }));
      })()`);
      const expectedLabels = focus === "lineup" ? (scenario.group === "sites" ? 4 : scenario.models) : 1;
      record.checks.push({
        check: "names are visible above the model canvas",
        ok: labels.length === expectedLabels && labels.every((label) => label.width > 0 && label.aboveCanvas),
        actual: labels,
      });
      if (scenario.panel) {
        await b.run("select", 'select[aria-label="Site"]', "3");
        await b.run("select", 'select[aria-label="Combat class"]', "Crossbowman");
        await b.run("click", 'button:has-text("Select site")');
        record.presses.push({
          action: "Select Crossbowman Stragglers",
          status: (await waitFor(b, 'document.querySelector("[role=dialog]")', 5000)) ? "led" : "failed",
        });
        const panel = await b.evaluate(
          `(() => {const p=document.querySelector('[role=dialog]');return {text:p?.textContent,beast:!!p?.querySelector('[data-icon="beast-t1"]'),oldGuard:!!p?.querySelector('[data-icon="troops"]')};})()`,
        );
        record.checks.push({
          check: "selected panel names Goblin with the actual T1 beast icon",
          ok: panel.text?.includes("Goblin") && panel.beast && !panel.oldGuard,
          actual: panel,
        });
      }
      const icons = await b.evaluate(
        `Array.from(document.querySelectorAll('.beast-icon-studies img')).map(img=>({width:img.getBoundingClientRect().width,loaded:img.complete&&img.naturalWidth>0,meaning:img.dataset.icon}))`,
      );
      record.checks.push({
        check: "three tier paintings decoded at real 20px HUD size",
        ok: icons.length === 3 && icons.every((icon) => icon.width === 20 && icon.loaded),
        actual: icons,
      });
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
      parent: resolve(process.argv[3] ?? ".context/beast-proof"),
      name: "beasts",
      baseUrl,
      where: (record) => ({ name: record.name }),
    },
    (b, out, records) => proveBeasts(b, out, records, baseUrl),
  );
}
