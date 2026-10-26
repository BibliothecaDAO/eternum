/**
 * Takes the Feed pick page's stills: each frame of src/lab/feed/stills.ts opened at its own size in one browser, waited
 * on until every player is named and every painting has loaded, and screenshotted into asset-sources/lab/feed (or
 * --out). The run's record goes to a new run directory under --record.
 *
 *   pnpm --dir apps/game capture:feed --record <evidence-dir> [--port 4199 | --base-url <url>] [--out <dir>]
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { STILLS } from "../../src/lab/feed/stills.ts";
import { withDevClient } from "../lib/dev-client.mjs";
import { runProof, waitFor } from "../prove-run.mjs";

const READY_MS = 60_000;
const { values } = parseArgs({
  options: {
    "base-url": { type: "string" },
    port: { type: "string", default: "4199" },
    out: { type: "string", default: fileURLToPath(new URL("../../asset-sources/lab/feed", import.meta.url)) },
    record: { type: "string" },
  },
});
if (!values.record) throw new Error("--record <evidence-dir> is required");
mkdirSync(values.out, { recursive: true });
mkdirSync(values.record, { recursive: true });

/** Drawn: every player named, and every painting on the frame decoded. */
const DRAWN = `document.querySelector('[data-still="ready"]') !== null &&
  [...document.images].every((image) => image.complete && image.naturalWidth > 0)`;

await withDevClient({ base: values["base-url"], port: values.port, out: values.record }, (baseUrl) =>
  runProof(
    { parent: values.record, name: "capture-feed", baseUrl, where: (record) => ({ still: record.name }) },
    async (b, _out, records) => {
      for (const still of STILLS) {
        b.run("set", "viewport", String(still.size.width), String(still.size.height));
        b.run("open", `${baseUrl}${still.draw}`, "--ignore-https-errors");
        const ready = await waitFor(b, DRAWN, READY_MS);
        const file = join(values.out, `${still.name}.png`);
        if (ready) b.run("screenshot", file);
        records.push({ name: still.name, ready, presses: [], file: ready ? file : null });
        console.log(`${still.name}: ${ready ? file : "never drew"}`);
      }
    },
  ),
);
