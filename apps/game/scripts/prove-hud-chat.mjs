/**
 * The HUD chat's geometry, measured in a real browser on the lab's chat (/lab/kit/chat: the real HudChatWindow and chat
 * shell over a room of forty messages, the last a long one, with unread messages):
 *
 * - open, at 1440×900: the pane keeps its height, its composer and every control stay inside the pane and the
 *   viewport, and the history scrolls inside the pane without moving the composer;
 * - closed, at 1440×900: the strip stays inside the HUD's column, its last message truncated, its unread count in view;
 * - closed and folded on a phone held upright (390×844): the strip is its icon and its unread count alone.
 *
 *   pnpm --dir apps/game prove:chat <base-url> <out-dir>
 *
 * Writes a screenshot of each and the measures with each check to <out-dir>/run-<start>/hud-chat.json; exits 1 when a
 * check fails.
 */
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runProof, sleep, waitFor } from "./prove-run.mjs";

const READY_MS = 30_000;
const SETTLE_MS = 1_500;

/** The open pane: its box, its composer's, and the one element inside it that scrolls the history. */
const OPEN = `(() => {
  const pane = document.querySelector('[data-lab="chat"] section[aria-label="Chat"]');
  const composer = pane?.querySelector("input, textarea");
  const scroller = pane && [...pane.querySelectorAll("*")].find((element) => {
    const style = getComputedStyle(element);
    return /(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1;
  });
  const rect = (element) => element ? JSON.parse(JSON.stringify(element.getBoundingClientRect())) : null;
  return {
    viewport: innerHeight,
    pane: rect(pane),
    composer: rect(composer),
    scroller: rect(scroller),
    controls: pane ? [...pane.querySelectorAll("button, input, textarea")].map(rect) : [],
    scrollHeight: scroller?.scrollHeight ?? null,
    clientHeight: scroller?.clientHeight ?? null,
  };
})()`;

/** The strip: the column, the button, its words and its unread count. */
const STRIP = `(() => {
  const column = document.querySelector('[data-lab="chat"]');
  const button = column?.querySelector('[aria-label="Chat strip"]');
  const words = button?.querySelector("span.truncate");
  const unread = button?.querySelector('[aria-label^="Unread chat messages"]');
  const rect = (element) => element ? JSON.parse(JSON.stringify(element.getBoundingClientRect())) : null;
  return {
    viewport: { width: innerWidth, height: innerHeight },
    column: rect(column),
    button: rect(button),
    words: rect(words),
    truncated: words ? words.scrollWidth > words.clientWidth : null,
    unread: rect(unread),
  };
})()`;

const inside = (inner, outer, slack = 1) =>
  inner !== null &&
  outer !== null &&
  inner.left >= outer.left - slack &&
  inner.right <= outer.right + slack &&
  inner.top >= outer.top - slack &&
  inner.bottom <= outer.bottom + slack;

const openChecks = (before, after) => [
  { check: "the pane is drawn with its composer", ok: before.pane !== null && before.composer !== null },
  { check: "the composer stays inside the pane", ok: inside(before.composer, before.pane) },
  {
    check: "every control of the pane stays inside it, side to side",
    ok:
      before.controls.length > 0 &&
      before.controls.every(
        (control) => control.left >= before.pane.left - 1 && control.right <= before.pane.right + 1,
      ),
  },
  {
    check: "the composer stays inside the viewport",
    ok: before.composer !== null && before.composer.bottom <= before.viewport,
  },
  {
    check: "the history scrolls inside the pane",
    ok: before.scroller !== null && before.scrollHeight > before.clientHeight && inside(before.scroller, before.pane),
  },
  {
    check: "scrolling the history leaves the composer where it is",
    ok: before.composer !== null && after.composer !== null && Math.abs(before.composer.top - after.composer.top) < 1,
  },
];

const stripChecks = (strip) => [
  { check: "the strip stays inside the column", ok: inside(strip.button, strip.column) },
  { check: "its last message is truncated", ok: strip.truncated === true },
  {
    check: "its unread count is inside the strip and on screen",
    ok:
      inside(strip.unread, strip.button) &&
      strip.unread.right <= strip.viewport.width &&
      strip.unread.bottom <= strip.viewport.height,
  },
];

const foldedChecks = (strip) => [
  { check: "the folded strip is its icon and count alone", ok: strip.button !== null && strip.button.width <= 120 },
  { check: "its words are for assistive technology only", ok: strip.words !== null && strip.words.width <= 1 },
  { check: "its unread count is on screen", ok: strip.unread !== null && strip.unread.right <= strip.viewport.width },
];

const open = async (b, url, viewport) => {
  b.run("set", "viewport", ...viewport);
  b.run("open", url, "--ignore-https-errors");
  const ready = await waitFor(b, `document.querySelector('[aria-label="Chat strip"]') !== null`, READY_MS);
  await sleep(SETTLE_MS);
  return ready;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const baseUrl = (process.argv[2] ?? "https://127.0.0.1:4176").replace(/\/$/, "");
  await runProof(
    {
      parent: resolve(process.argv[3] ?? ".context/hud-chat"),
      name: "hud-chat",
      baseUrl,
      where: (record) => ({ state: record.state }),
    },
    async (b, out, records) => {
      const pane = { state: "open, 1440×900", ready: false, presses: [], checks: [] };
      records.push(pane);
      pane.ready = await open(b, `${baseUrl}/lab/kit/chat?state=open`, ["1440", "900"]);
      if (pane.ready) {
        const before = b.evaluate(OPEN);
        b.evaluate(`(() => { const pane = document.querySelector('[data-lab="chat"] section[aria-label="Chat"]');
          const scroller = pane && [...pane.querySelectorAll("*")].find((element) => /(auto|scroll)/.test(getComputedStyle(element).overflowY) && element.scrollHeight > element.clientHeight + 1);
          if (scroller) scroller.scrollTop = 0; return true; })()`);
        await sleep(300);
        const after = b.evaluate(OPEN);
        pane.measures = { before, after };
        pane.checks.push(...openChecks(before, after));
        b.run("screenshot", join(out, "chat-open.png"));
      }

      const strip = { state: "closed, 1440×900", ready: false, presses: [], checks: [] };
      records.push(strip);
      strip.ready = await open(b, `${baseUrl}/lab/kit/chat?state=closed`, ["1440", "900"]);
      if (strip.ready) {
        strip.measures = b.evaluate(STRIP);
        strip.checks.push(...stripChecks(strip.measures));
        b.run("screenshot", join(out, "chat-strip.png"));
      }

      const folded = { state: "closed and folded, 390×844", ready: false, presses: [], checks: [] };
      records.push(folded);
      folded.ready = await open(b, `${baseUrl}/lab/kit/chat?state=closed&fold=1`, ["390", "844"]);
      if (folded.ready) {
        folded.measures = b.evaluate(STRIP);
        folded.checks.push(...foldedChecks(folded.measures));
        b.run("screenshot", join(out, "chat-strip-folded.png"));
      }
    },
  );
}
