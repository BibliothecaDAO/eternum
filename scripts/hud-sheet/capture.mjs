/**
 * The HUD sheet's captures (`pnpm hud:capture <evidence-dir> <base-url> [--page <path>] [element ...]`): opens a lab
 * page (/lab/kit unless `--page` names another, such as /lab/kit/area-d) in a real browser at 1920 wide and saves each
 * sheet element on it (every one, or those named) as `<name>.png` in a new run directory under the evidence directory,
 * with the run's record beside them. Each element is also checked for ring badges drawn over each other or over a
 * neighbouring ring, and for a row of actions whose verb is not alone at its right edge or whose other buttons are not
 * at its left; the run is incomplete when one is. The lab must be served at the base URL; the command
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

/**
 * Every two things drawn over each other among the rings in `selector`: two badges, or a badge and another ring's well.
 * A badge sits on its own ring's rim by design, so only its own well is left out.
 */
const ringsOverlapping = (selector) => `(() => {
  const parts = [...document.querySelectorAll(${JSON.stringify(`${selector} .ui-ring`)})].flatMap((ring, at) =>
    [...ring.querySelectorAll(".ui-ring__badge, .ui-ring__face")].map((part) => ({
      at,
      badge: part.classList.contains("ui-ring__badge"),
      what: part.classList.contains("ui-ring__badge") ? part.textContent : "well " + (ring.getAttribute("aria-label") ?? at),
      box: part.getBoundingClientRect(),
    })),
  );
  const over = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  return parts.flatMap((a, i) =>
    parts
      .slice(i + 1)
      .filter((b) => (a.badge || b.badge) && (a.at !== b.at || (a.badge && b.badge)) && over(a.box, b.box))
      .map((b) => [a.what, b.what]),
  );
})()`;

/**
 * Every row of actions in `selector` whose buttons stand out of place: the verb (its last button) must end at the row's
 * right edge, and its other buttons must start at its left edge, packed there (the sheet's .ui-actions).
 */
const actionsOutOfPlace = (selector) => `(() => {
  const misplaced = [];
  for (const row of document.querySelectorAll(${JSON.stringify(`${selector} .ui-actions`)})) {
    const buttons = [...row.children].filter((child) => child.matches("button") && child.getBoundingClientRect().width > 0);
    if (buttons.length === 0) continue;
    const style = getComputedStyle(row);
    const box = row.getBoundingClientRect();
    const left = box.left + parseFloat(style.paddingLeft);
    const right = box.right - parseFloat(style.paddingRight);
    const verb = buttons.at(-1).getBoundingClientRect();
    if (Math.abs(verb.right - right) > 1) misplaced.push(buttons.at(-1).innerText + " ends " + Math.round(right - verb.right) + " px from the right edge");
    const others = buttons.slice(0, -1).map((button) => button.getBoundingClientRect());
    if (others.length > 0 && Math.abs(others[0].left - left) > 1) misplaced.push(buttons[0].innerText + " starts " + Math.round(others[0].left - left) + " px from the left edge");
  }
  return misplaced;
})()`;

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
      const overlapping = b.evaluate(ringsOverlapping(selector));
      record.checks.push({ check: "ring badges clear", ok: overlapping.length === 0, overlapping });
      const misplaced = b.evaluate(actionsOutOfPlace(selector));
      record.checks.push({
        check: "each verb alone at the right, the way out at the left",
        ok: misplaced.length === 0,
        misplaced,
      });
      record.ready = true;
    }
  },
);
