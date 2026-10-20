import { join } from "node:path";
import { loadavg } from "node:os";
import { writeFileSync } from "node:fs";
import { waitFor } from "../prove-run.mjs";

const contexts = ["cyclops", "wraith", "troll", "dark-fey", "ammit", "basilisk", "wyvern", "hydra"];

/** Select each production encounter through the same owner-facing lab controls. */
export async function proveSiteStudies(b, out, records, baseUrl, rendererMode) {
  const record = { name: "site-map", ready: false, presses: [], checks: [] };
  records.push(record);
  try {
    await b.run(
      "open",
      `${baseUrl}/lab/models?family=beasts&group=site-map&rendererMode=${rendererMode}`,
      "--ignore-https-errors",
    );
    record.ready = await waitFor(b, 'document.querySelector("[data-site-studies-ready=true]")', 60000);
    if (!record.ready) {
      record.page = await b.evaluate("document.body.innerText");
      record.errors = await b.run("errors");
      record.console = await b.run("console");
      await b.run("screenshot", join(out, `${record.name}-not-ready.png`));
      return;
    }
    record.renderer = await b.evaluate("window.__rendererDiagnostics");
    record.checks.push({
      check: "requested renderer backend is active",
      ok: record.renderer?.activeMode === (rendererMode === "webgpu-auto" ? "webgpu" : "webgl2-fallback"),
      actual: record.renderer,
    });
    const overview = await readDrawn(b, "lineup", 0);
    record.checks.push({
      check: "eight final contexts draw all thirteen production parts",
      ok: overview?.drawnParts.length === 13 && overview?.models === 13,
      actual: overview,
    });
    const baseline = await b.evaluate(
      "(() => {const image=document.querySelector('img[src*=\"production-before\"]');return image?.complete&&image.naturalWidth>0;})()",
    );
    record.checks.push({ check: "recorded production comparison is visible beside the live final map", ok: baseline });
    await b.run("screenshot", join(out, "site-map-overview.png"));
    for (const [index, name] of contexts.entries()) {
      await b.run("select", 'select[aria-label="Site view"]', String(index));
      record.presses.push({ action: `Site view: ${name}`, status: "led" });
      for (const yaw of [30, 180]) {
        await b.run("select", 'select[aria-label="Turn"]', String(yaw));
        const drawn = await readDrawn(b, index, yaw);
        record.checks.push({
          check: `${name} at ${yaw} degrees draws its production delivery`,
          ok: drawn?.drawnAssets.includes(`/models/frontier/beast-${name}.glb`),
          actual: drawn,
        });
        await b.run("screenshot", join(out, `site-${name}-${yaw}.png`));
      }
    }
    await b.run("select", 'select[aria-label="Site view"]', "3");
    await b.run("select", 'select[aria-label="Turn"]', "30");
    await b.run("screenshot", join(out, "fey-motion-a.png"));
    await b.run("wait", "750");
    await b.run("screenshot", join(out, "fey-motion-b.png"));
    await b.run("select", 'select[aria-label="Site view"]', "4");
    await b.run("uncheck", 'input[aria-label="Ground mist"]');
    await b.run("screenshot", join(out, "ruin-mist-off.png"));
    await b.run("check", 'input[aria-label="Ground mist"]');
    await b.run("wait", "500");
    await b.run("screenshot", join(out, "ruin-mist-on.png"));
  } finally {
    await b.run("open", "about:blank");
  }
}

/** Six alternating runs on the same 100-ruin scene; retain every sample and machine-load bound. */
export async function proveMistCost(b, out, records, baseUrl) {
  const record = { name: "mist-cost", ready: false, presses: [], checks: [], loadBefore: loadavg() };
  records.push(record);
  if (record.loadBefore[0] > 12) {
    record.error = "Machine load exceeds 12; frame measurements would be invalid";
    return;
  }
  const loadSamples = [record.loadBefore];
  const monitor = setInterval(() => loadSamples.push(loadavg()), 1000);
  try {
    await b.run("set", "viewport", "1600", "1000");
    await b.run(
      "open",
      `${baseUrl}/lab/models?family=beasts&group=site-map&population=100&rendererMode=webgpu-force-webgl`,
      "--ignore-https-errors",
    );
    record.ready = await waitFor(b, 'document.querySelector("[data-site-studies-ready=true]")', 60000);
    if (!record.ready) {
      record.page = await b.evaluate("document.body.innerText");
      record.errors = await b.run("errors");
      record.console = await b.run("console");
      await b.run("screenshot", join(out, `${record.name}-not-ready.png`));
      return;
    }
    const scene = await readDrawn(b, "lineup", 0);
    record.checks.push({
      check: "one hundred complete ruin compositions are submitted",
      ok: scene.models === 200 && scene.drawnParts.length === 200,
      actual: scene.models,
    });
    await b.run("find", "role", "button", "click", "--name", "Measure mist cost", "--exact");
    const complete = await waitFor(b, 'document.querySelector("[data-mist-measurement]")', 90000);
    if (!complete) throw new Error("Mist measurement did not complete");
    const result = await b.evaluate("JSON.parse(document.querySelector('[data-mist-measurement]').textContent)");
    record.loadAfter = loadavg();
    writeFileSync(
      join(out, "mist-frames.json"),
      JSON.stringify(
        { ...result, viewport: [1600, 1000], loadSamples, loadBefore: record.loadBefore, loadAfter: record.loadAfter },
        null,
        2,
      ),
    );
    record.checks.push({
      check: "six complete hardware-rendered runs at acceptable load",
      ok:
        result.runs?.length === 6 &&
        result.runs.every((run) => run.frames.length === 90 && !/swiftshader|llvmpipe|software/i.test(run.gpu)) &&
        record.loadAfter[0] <= 12 &&
        loadSamples.every((load) => load[0] <= 12),
      error: result.error,
    });
    await b.run("screenshot", join(out, "hundred-ruins.png"));
  } finally {
    clearInterval(monitor);
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
  return b.evaluate("JSON.parse(document.querySelector('[data-lineup-rendered]').dataset.lineupRendered)");
}
