/**
 * The Frontier Feed as a player meets it: the lab's game on prod's recorded day (`/lab/game?scenario=day-later`), on a
 * desktop (1440 × 900) and a phone (390 × 844). On each: the Feed opened as a player opens it (the desktop's rail, the
 * phone's place, past the day card), its rows measured (each row's height, and how far apart its words' baselines
 * sit), its × pressed and its place pressed to open it again, each press a player's click, and a screenshot at each
 * step.
 *
 *   pnpm --dir apps/game prove:frontier-feed --out <fresh-dir> [--port 4199 | --base-url <url>]
 *
 * The record is `<out>/run-<start>/frontier-feed.json`; a row whose words leave one baseline, rows of more than one
 * height, a press that did not land (a missing ×, a covered place), or a Feed that does not close or open again are
 * problems, and the command exits 1.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { withDevClient } from "./lib/dev-client.mjs";
import { clickAsPlayer, runProof, sleep, waitFor } from "./prove-run.mjs";

const READY_MS = 120_000;
const DEVICES = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "phone", width: 390, height: 844 },
];

/** The Feed's panel: the desktop rail's home, or the phone's page. */
export const FEED = `[...document.querySelectorAll('[aria-label="Feed"], [aria-label="Log"]')].find((el) => el.querySelector(".ui-event"))`;

/**
 * Each of the first 20 rows: its height, and the spread of its words' baselines (the bottom of each word's line box,
 * the time cue left out: it is a smaller label set on its own).
 */
const MEASURE = `(() => {
  const feed = ${FEED};
  if (!feed) return null;
  const rows = [...feed.querySelectorAll(".ui-event")].slice(0, 20);
  return rows.map((row) => {
    const bottoms = [];
    const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent.trim() || node.parentElement.closest(".ui-event__time")) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) bottoms.push(rect.bottom);
    }
    return {
      text: row.textContent.replace(/\\s+/g, " ").trim().slice(0, 80),
      height: Math.round(row.getBoundingClientRect().height),
      spread: bottoms.length ? Math.round((Math.max(...bottoms) - Math.min(...bottoms)) * 10) / 10 : 0,
    };
  });
})()`;

/** Marks the first visible control named `label` (a place by its word, a bubble or the × by its label) to press. */
const mark = (label) => `(() => {
  document.querySelectorAll("[data-proof-press]").forEach((el) => el.removeAttribute("data-proof-press"));
  const named = (el) => el.getAttribute("aria-label") === "${label}" || el.textContent.trim().startsWith("${label}");
  const control = [...document.querySelectorAll("button")].find((el) => named(el) && el.getClientRects().length > 0);
  control?.setAttribute("data-proof-press", "");
  return Boolean(control);
})()`;

/**
 * Presses the control named `label` as a player does, through the browser's own click, so a control that is missing or
 * covered is not pressed: "led", "missing", or what the browser said.
 */
export const press = (b, label) => {
  if (!b.evaluate(mark(label))) return "missing";
  return clickAsPlayer(b, "[data-proof-press]") ?? "led";
};

/**
 * Closes the open Feed with its × and opens it again from its place, as a player does, into `record`: a Feed without
 * its ×, a press that does not land, or a Feed that does not close or come back is a problem. The closed rail's
 * screenshot goes to `shot`.
 */
export const closeAndReopen = async (b, shot, record, settleMs = 1_000) => {
  const closed = press(b, "Close the feed");
  record.presses.push({ press: "the Feed's ×", status: closed });
  if (closed !== "led") return;
  await sleep(settleMs);
  b.run("screenshot", shot);
  record.checks.push({ check: "the × closes the Feed", ok: b.evaluate(`${FEED} === undefined`) });
  record.presses.push({ press: "the Feed's place, to open it again", status: press(b, "Feed") });
  await sleep(settleMs);
  record.checks.push({ check: "the Feed's place opens it again", ok: b.evaluate(`${FEED} !== undefined`) });
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({
    options: { "base-url": { type: "string" }, port: { type: "string", default: "4199" }, out: { type: "string" } },
  });
  if (!values.out) throw new Error("--out <fresh-dir> is required");
  mkdirSync(values.out, { recursive: true });
  await withDevClient({ base: values["base-url"], port: values.port, out: values.out }, (baseUrl) =>
    runProof(
      { parent: values.out, name: "frontier-feed", baseUrl, where: (record) => ({ device: record.name }) },
      async (b, out, records) => {
        for (const device of DEVICES) {
          const record = { name: device.name, ready: false, presses: [], checks: [] };
          records.push(record);
          b.run("set", "viewport", String(device.width), String(device.height));
          b.run("open", `${baseUrl}/lab/game?scenario=day-later`, "--ignore-https-errors");
          if (device.name === "phone") {
            await waitFor(b, `document.querySelector('nav[aria-label="Places"]')`, READY_MS);
            // The phone's place for the Feed: "Feed", or "Log" before the two were made one.
            const pressed = press(b, "Feed");
            record.presses.push({
              press: "the phone's Feed place",
              status: pressed === "missing" ? press(b, "Log") : pressed,
            });
          }
          record.ready = await waitFor(b, `${FEED} !== undefined`, READY_MS);
          if (!record.ready) continue;
          await sleep(3_000);
          // The recorded day can open on its "Day 2 done" card over the Feed; a player continues past it first, and the
          // HUD takes no press until its dawn has lifted (day-end-screen.tsx: the moment ends, its layer goes).
          if (b.evaluate(mark("Continue")))
            record.presses.push({ press: "the day card's Continue", status: press(b, "Continue") });
          await waitFor(b, `document.querySelector("[data-day-end]") === null`, READY_MS);
          await sleep(1_000);
          b.run("screenshot", join(out, `${device.name}-open.png`));
          record.feedBox = b.evaluate(`JSON.stringify(${FEED}.getBoundingClientRect())`);
          record.rows = b.evaluate(MEASURE);
          const heights = [...new Set(record.rows.map((row) => row.height))];
          const spread = Math.max(...record.rows.map((row) => row.spread));
          record.checks.push({ check: "every row's words on one baseline", ok: spread <= 1, spread });
          record.checks.push({ check: "every row one height", ok: heights.length === 1, heights });
          await closeAndReopen(b, join(out, `${device.name}-closed.png`), record);
        }
      },
    ),
  );
}
