import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runProof, waitFor, clickAsPlayer } from "./prove-run.mjs";

export async function checkConstructionImages() {
  const models = [...document.querySelectorAll("img[data-building-thumbnail]")];
  const icons = [...document.querySelectorAll("img[data-icon]")];
  const decoded = await Promise.all(
    [...models, ...icons].map(async (image) => {
      try {
        await image.decode();
        return { src: image.getAttribute("src"), ok: image.naturalWidth > 0 && image.naturalHeight > 0 };
      } catch {
        return { src: image.getAttribute("src"), ok: false };
      }
    }),
  );
  return [
    {
      check: "every model represented",
      ok: models.length === 15 && new Set(models.map((image) => image.src)).size === 15,
    },
    {
      check: "construction art uses model renders",
      ok: models.every((image) => image.getAttribute("src").startsWith("/images/buildings/construction/")),
    },
    {
      check: "surrounding icons keep Facets",
      ok: icons.length > 0 && icons.every((image) => image.getAttribute("src").startsWith("/icons/facets/")),
    },
    { check: "all images decode", ok: decoded.every((image) => image.ok), decoded },
    { check: "no horizontal overflow", ok: document.documentElement.scrollWidth <= innerWidth },
  ];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const baseUrl = process.argv[2] ?? "https://127.0.0.1:4193";
  await runProof(
    {
      parent: resolve(process.argv[3] ?? ".context/construction-proof"),
      name: "construction",
      baseUrl,
      where: (record) => ({ name: record.name }),
    },
    async (b, out, records) => {
      for (const [name, width, height] of [
        ["desktop", 1440, 1000],
        ["phone", 390, 844],
      ]) {
        b.run("set", "viewport", String(width), String(height));
        b.run("open", `${baseUrl}/lab/kit/construction`, "--ignore-https-errors");
        const record = {
          name,
          ready: await waitFor(b, 'document.querySelectorAll("[data-building-thumbnail]").length === 15', 30000),
          presses: [],
          checks: [],
        };
        records.push(record);
        if (!record.ready) continue;
        record.checks = b.evaluate(`(${checkConstructionImages.toString()})()`);
        const selector = 'section[aria-label="Farm"]';
        const error = clickAsPlayer(b, `${selector} button[aria-label="${name === "phone" ? "Build Farm" : "Build"}"]`);
        const built = b.evaluate(`document.querySelector('${selector}').textContent.includes("2 built")`);
        record.presses.push({ action: "Build Farm", status: !error && built ? "led" : "failed", error });
        if (name === "phone") {
          const detailsError = clickAsPlayer(b, `${selector} summary`);
          record.presses.push({ action: "Details", status: detailsError ? "failed" : "led", error: detailsError });
        }
        const pause =
          name === "phone" ? `${selector} details button:nth-child(1)` : `${selector} button[aria-label="Pause all"]`;
        const pauseError = clickAsPlayer(b, pause);
        const paused = b.evaluate(
          `Array.from(document.querySelectorAll('${selector} button')).some(button => (button.getAttribute("aria-label") || button.textContent) === "Resume all")`,
        );
        record.presses.push({
          action: "Pause Farm",
          status: !pauseError && paused ? "led" : "failed",
          error: pauseError,
        });
        const destroy =
          name === "phone"
            ? `${selector} details button:nth-child(2)`
            : `${selector} button[aria-label="Destroy building"]`;
        const destroyError = clickAsPlayer(b, destroy);
        const destroyed = b.evaluate(`document.querySelector('${selector}').textContent.includes("1 built")`);
        record.presses.push({
          action: "Destroy Farm",
          status: !destroyError && destroyed ? "led" : "failed",
          error: destroyError,
        });
        b.run("screenshot", join(out, `${name}.png`), "--full");
      }
    },
  );
}
