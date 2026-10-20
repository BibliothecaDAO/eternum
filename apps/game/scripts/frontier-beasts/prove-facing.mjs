import { join } from "node:path";
import { waitFor } from "../prove-run.mjs";

/** Compare the old tile headings with the production resolver through visible lab controls. */
export async function proveBeastFacing(b, out, records, baseUrl, rendererMode) {
  await b.run("set", "viewport", "1920", "1080");
  for (const [zoom, distance] of [
    ["default", 20],
    ["far", 45],
  ]) {
    const record = { name: `facing-${zoom}`, ready: false, presses: [], checks: [] };
    records.push(record);
    try {
      await b.run(
        "open",
        `${baseUrl}/lab/models?family=beasts&group=site-map&population=facing&rendererMode=${rendererMode}`,
      );
      record.ready = await waitFor(b, 'document.querySelector("[data-site-studies-ready=true]")', 60000);
      if (!record.ready) continue;
      await b.run("select", 'select[aria-label="Map zoom"]', zoom);
      record.presses.push({ action: `Map zoom: ${zoom}`, status: "led" });
      const rendered = await waitFor(
        b,
        `(() => {
        const node = document.querySelector("[data-lineup-rendered]");
        if (!node) return false;
        const view = JSON.parse(node.dataset.lineupRendered);
        return Math.abs(view.cameraDistance - ${distance}) < 0.001 && view.drawnParts.length === view.models;
      })()`,
        15000,
      );
      const view = await b.evaluate(
        'JSON.parse(document.querySelector("[data-lineup-rendered]").dataset.lineupRendered)',
      );
      record.checks.push({ check: "production camera distance and every part drawn", ok: rendered, actual: view });
      record.checks.push({
        check: "all eight after headings face south; the previous tile headings vary",
        ok:
          view.rotations.length === 16 &&
          view.rotations.filter((_, i) => i % 2 === 1).every((yaw) => yaw === 0) &&
          view.rotations.some((yaw, i) => i % 2 === 0 && yaw !== 0),
      });
      record.checks.push({
        check: "same camera azimuth and field of view as the world map",
        ok: view.fieldOfView === 38 && Math.abs(view.cameraPosition[0] - view.cameraTarget[0]) < 0.0001,
      });
      record.checks.push({
        check: "idle and ground mist remain enabled",
        ok: await b.evaluate(
          "document.querySelector('input[aria-label=\"Beast idle\"]').checked && document.querySelector('input[aria-label=\"Ground mist\"]').checked",
        ),
      });
      await b.run("screenshot", join(out, `${record.name}.png`));
    } finally {
      await b.run("open", "about:blank");
    }
  }
}
