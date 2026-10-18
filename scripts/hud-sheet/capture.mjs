/**
 * The HUD sheet's captures (`pnpm hud:capture <evidence-dir> <base-url> [--page <path>] [element ...]`): opens a lab
 * page (/lab/kit unless `--page` names another, such as /lab/kit/area-d) in a real browser at 1920 wide and saves each
 * sheet element on it (every one, or those named) as `<name>.png` in a new run directory under the evidence directory,
 * with the run's record beside them. The lab must be served at the base URL; the command
 * starts no server and closes its browser session whatever happens.
 */
import { join } from "node:path";

import { runProof } from "../../apps/game/scripts/prove-run.mjs";

const [parent, baseUrl, ...rest] = process.argv.slice(2);
const pageAt = rest.indexOf("--page");
const page = pageAt === -1 ? "/lab/kit" : rest[pageAt + 1];
const named = pageAt === -1 ? rest : rest.filter((_, index) => index !== pageAt && index !== pageAt + 1);
if (!parent || !baseUrl || !page) {
  console.error("usage: pnpm hud:capture <evidence-dir> <base-url> [--page <path>] [element ...]");
  process.exit(2);
}

/** An element's name as a file name: "Ring badge" is ring-badge.png. */
const fileOf = (name) =>
  `${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}.png`;

await runProof(
  { parent, name: "hud-sheet-capture", baseUrl, where: (record) => ({ element: record.name }) },
  async (b, out, records) => {
    b.run("set", "viewport", "1920", "1080");
    b.run("open", `${baseUrl}${page}`, "--ignore-https-errors");
    b.run("wait", "[data-sheet-element]");
    const shown = b.evaluate(
      `[...document.querySelectorAll("[data-sheet-element]")].map((element) => element.dataset.sheetElement)`,
    );
    for (const name of named.length > 0 ? named : shown) {
      const record = { name, ready: false, presses: [], checks: [] };
      records.push(record);
      if (!shown.includes(name)) {
        record.error = `no such element on ${page}`;
        continue;
      }
      const selector = `[data-sheet-element="${name}"]`;
      b.run("scrollintoview", selector);
      record.file = join(out, fileOf(name));
      b.run("screenshot", selector, record.file);
      record.ready = true;
    }
  },
);
