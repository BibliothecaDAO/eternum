/**
 * The HUD chat's geometry, measured in a real browser on the lab's chat (/lab/kit/chat: the real HudChatWindow and chat
 * shell over a room of forty messages, the last a long one, with unread messages):
 *
 * - open, at 1440×900: the pane keeps its height, its composer and every control stay inside the pane and the
 *   viewport, and the history scrolls inside the pane without moving the composer;
 * - closed, at 1440×900: the strip stays inside the HUD's column, its last message truncated, its unread count in view;
 * - closed and folded on a phone held upright (390×844): the strip is its icon and its unread count alone;
 * - in the rail (`?state=rail`, the real rail frame, Events panel, the panels lab's real picked-army tile, chat and build
 *   tag over a stand-in map canvas), chat open at 1920×1080, 1440×900, 1440×768 and 1280×720: the details and the open
 *   chat share the column without covering each other, each keeping its least height (the details a header and a body,
 *   the chat 300 px); on a screen too short for both, the panels scroll in their own box above the chat, the strip and
 *   the composer always in the column and every part reachable; the Events name reads whole beside its Log count; and nothing in the column
 *   covers the build tag in the band under it. Closed, at 1920×1080 and 1280×720, the same for the strip and the
 *   details. Then, on one page with chat open from 1440×900, the window is made shorter, height by height down to the
 *   shortest desktop (800, 768, 744, 720): the open chat's foot stays in the column at each, never only where the
 *   page opened. A wheel turned over each panel never reaches the
 *   canvas under them, and turned over the bare map it does. The wheel goes where the browser sends one: to the element
 *   under the point, bubbling from there. agent-browser's own `mouse wheel` always fires at the viewport's corner
 *   (0, 0), whatever the mouse is over, so on the game's page it lands on the map.
 *
 * - mentions, at 1440×900 and on a phone (390×844, with a phone's touch), in the open pane: the history draws "@Aldric"
 *   as a mention and marks the message that mentions the lab's player (Maelis) for them, their name in gold; "@" typed
 *   in the composer lists the game's named players (never the player), each name whole on screen and, on a phone, a
 *   finger's height; "@c" narrows it; a name is picked (on a desktop with ArrowDown and Enter, on a phone with a tap,
 *   the keyboard staying in the field) and written as "@Corwin "; the message sent comes back drawn with its mention.
 *
 *   pnpm --dir apps/game prove:chat <base-url> <out-dir>
 *
 * Writes a screenshot of each and the measures with each check to <out-dir>/run-<start>/hud-chat.json; exits 1 when a
 * check fails.
 */
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { clickAsPlayer, runProof, sleep, waitFor } from "./prove-run.mjs";

const READY_MS = 30_000;
/** Desktop sizes down to the shortest a laptop shows: the rail must hold at each. */
const RAIL_OPEN_SIZES = [
  ["1920", "1080"],
  ["1440", "900"],
  ["1440", "768"],
  ["1280", "720"],
];
/** One open page made shorter, step by step, from 1440×900: the rail holds at each height it passes through. */
const RAIL_RESIZE_HEIGHTS = ["800", "768", "744", "720"];
const RAIL_CLOSED_SIZES = [
  ["1920", "1080"],
  ["1280", "720"],
];
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

/** The rail lab: the column, each of its parts, the build tag, and whether the Events name is cut. */
const RAIL = `(() => {
  const rect = (element) => element ? JSON.parse(JSON.stringify(element.getBoundingClientRect())) : null;
  const rail = document.querySelector('aside[aria-label="Guided rail"]');
  const events = rail?.querySelector('section[aria-label="Events"]');
  const title = events?.querySelector(".ui-panel__title");
  const details = rail?.querySelector('[aria-label="Tile details"]');
  const column = rail?.firstElementChild;
  // What shows of the details: their box, cut by the panels' scroll box they may run past.
  const shown = (() => {
    const box = rect(details);
    const clip = rect(column);
    if (!box || !clip) return null;
    const top = Math.max(box.top, clip.top);
    const bottom = Math.min(box.bottom, clip.bottom);
    return bottom > top ? { ...box, top, bottom, y: top, height: bottom - top } : null;
  })();
  return {
    viewport: { width: innerWidth, height: innerHeight },
    rail: rect(rail),
    column: rect(column),
    detailsShown: shown,
    events: rect(events),
    eventsTitleCut: title ? title.scrollWidth > title.clientWidth : null,
    unread: rect(events?.querySelector('[aria-label="Unread events"]')),
    details: rect(details),
    detailsHold: details?.firstElementChild?.scrollHeight ?? null,
    firstPanelHead: rect(details?.querySelector(".ui-panel__head")),
    tagCovered: (() => {
      const tag = document.querySelector('a[href*="github.com"]');
      const box = tag?.getBoundingClientRect();
      const hit = box && document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return box ? !(hit && tag.parentElement.contains(hit)) : null;
    })(),
    pane: rect(rail?.querySelector('section[aria-label="Chat"]')),
    firstControl: rect(rail?.querySelector('section[aria-label="Chat"] button')),
    composer: rect(rail?.querySelector('section[aria-label="Chat"] input, section[aria-label="Chat"] textarea')),
    chat: rect(rail?.querySelector('[aria-label="Chat strip"]')?.parentElement?.parentElement),
    strip: rect(rail?.querySelector('[aria-label="Chat strip"]')),
    tag: rect(document.querySelector('a[href*="github.com"]')?.parentElement),
  };
})()`;

/** Each place the wheel turns over, as the middle of what shows of it: the map's own, then each panel's. */
const WHEEL_TARGETS = `(() => {
  // What shows of an element: its box, cut by the viewport and by the rail's panel scroll box when it is inside it.
  const middle = (element) => {
    if (!element) return null;
    const box = element.getBoundingClientRect();
    const scroll = document.querySelector('aside[aria-label="Guided rail"]')?.firstElementChild;
    const clip = scroll && scroll.contains(element) ? scroll.getBoundingClientRect() : { top: 0, bottom: innerHeight };
    const [left, right] = [Math.max(box.left, 0), Math.min(box.right, innerWidth)];
    const [top, bottom] = [Math.max(box.top, clip.top, 0), Math.min(box.bottom, clip.bottom, innerHeight)];
    return right > left && bottom > top ? [Math.round((left + right) / 2), Math.round((top + bottom) / 2)] : null;
  };
  const pane = document.querySelector('section[aria-label="Chat"]');
  const history = pane && [...pane.querySelectorAll("*")].find((element) =>
    /(auto|scroll)/.test(getComputedStyle(element).overflowY) && element.scrollHeight > element.clientHeight + 1);
  return {
    map: [Math.round(innerWidth / 3), Math.round(innerHeight / 2)],
    "Events": middle(document.querySelector('section[aria-label="Events"] .ui-panel__head')),
    "tile details": middle(document.querySelector('[aria-label="Tile details"]')),
    "chat history": middle(history),
    "chat strip": middle(document.querySelector('[aria-label="Chat strip"]')),
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

/** The history's mentions: another player's and the lab player's own, their rows and colours, and the history's box. */
const MENTIONS = `(() => {
  const pane = document.querySelector('[data-lab="chat"] section[aria-label="Chat"]');
  const rect = (element) => element ? JSON.parse(JSON.stringify(element.getBoundingClientRect())) : null;
  const scroller = pane && [...pane.querySelectorAll("*")].find((element) =>
    /(auto|scroll)/.test(getComputedStyle(element).overflowY) && element.scrollHeight > element.clientHeight + 1);
  const read = (name) => {
    const mention = pane?.querySelector('[data-mention="' + name + '"]');
    const row = mention?.closest("li");
    return mention ? {
      text: mention.textContent,
      marked: row.hasAttribute("data-mentions-me"),
      color: getComputedStyle(mention).color,
      rowGround: getComputedStyle(row).backgroundColor,
      box: rect(mention),
    } : null;
  };
  const gold = pane ? getComputedStyle(pane).getPropertyValue("--hud-gold").trim().split(/\\s+/).join(", ") : "";
  return { other: read("Aldric"), mine: read("Maelis"), gold: "rgb(" + gold + ")", history: rect(scroller) };
})()`;

/** The composer and its list of players: what is typed, whether it keeps the keyboard, and each name as shown. */
const LIST = `(() => {
  const input = document.querySelector('[data-lab="chat"] input[aria-label="Message"]');
  const items = [...document.querySelectorAll('[aria-label="Mention a player"] [role="option"]')];
  return {
    viewport: { width: innerWidth, height: innerHeight },
    coarse: matchMedia("(pointer: coarse)").matches,
    value: input?.value ?? null,
    expanded: input?.getAttribute("aria-expanded") ?? null,
    focused: document.activeElement === input,
    active: document.getElementById(input?.getAttribute("aria-activedescendant") ?? "")?.textContent ?? null,
    names: items.map((item) => item.textContent),
    items: items.map((item) => {
      const box = item.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return { ...JSON.parse(JSON.stringify(box)), reached: Boolean(hit && item.contains(hit)) };
    }),
  };
})()`;

/** The last message's row: its words and its mentions. */
const LAST = `(() => {
  const rows = [...document.querySelectorAll('[data-lab="chat"] section[aria-label="Chat"] li')].filter((row) => row.querySelector("p"));
  const last = rows.at(-1);
  return last ? { text: last.textContent, mentions: [...last.querySelectorAll("[data-mention]")].map((m) => m.textContent) } : null;
})()`;

const historyChecks = (read) => [
  {
    check: "another player's mention reads as a mention, its message not marked",
    ok: read.other?.text === "@Aldric" && read.other.marked === false,
  },
  {
    check: "the message that mentions the player is marked for them, their name in gold",
    ok:
      read.mine?.text === "@Maelis" &&
      read.mine.marked === true &&
      read.mine.rowGround !== "rgba(0, 0, 0, 0)" &&
      read.mine.color === read.gold &&
      read.other?.color !== read.gold,
  },
  {
    check: "both mentions are in view in the history",
    ok: inside(read.other?.box ?? null, read.history) && inside(read.mine?.box ?? null, read.history),
  },
];

/** The list of players: these names, each whole on screen where the pointer reaches it, a finger's height on a phone. */
const listChecks = (list, names, phone) => [
  { check: `the list names ${names.join(", ")}`, ok: JSON.stringify(list.names) === JSON.stringify(names) },
  { check: "the field says its list is open", ok: list.expanded === "true" },
  {
    check: "each name is whole on screen, and the pointer reaches it",
    ok:
      list.items.length === names.length &&
      list.items.every(
        (item) =>
          item.reached && item.top >= 0 && item.bottom <= list.viewport.height && item.right <= list.viewport.width,
      ),
  },
  ...(phone
    ? [
        { check: "the phone's touch is on", ok: list.coarse === true },
        { check: "each name is a finger's height (44 px)", ok: list.items.every((item) => item.height >= 43.5) },
      ]
    : []),
];

/** The game's named players the room's list opens with: the first six by name; Maelis, the player, never. */
const FIRST_SIX = ["Aldric", "Brannoc", "Caradoc", "Corwin", "Gwenllian", "Isolde"];
const COMPOSER = '[data-lab="chat"] input[aria-label="Message"]';

/** Mentions on one device: the history read, the list opened, narrowed, a name picked, and the message sent. */
const proveMentions = async (b, out, record, phone) => {
  const tag = phone ? "phone" : "desktop";
  record.measures = { history: b.evaluate(MENTIONS) };
  record.checks.push(...historyChecks(record.measures.history));
  b.run("screenshot", join(out, `mentions-history-${tag}.png`));

  const opened = clickAsPlayer(b, COMPOSER);
  record.presses.push({ press: "the composer", status: opened ?? "led" });
  b.run("type", COMPOSER, "@");
  await sleep(300);
  record.measures.all = b.evaluate(LIST);
  record.checks.push(...listChecks(record.measures.all, FIRST_SIX, phone));
  b.run("screenshot", join(out, `mentions-list-${tag}.png`));

  b.run("type", COMPOSER, "c");
  await sleep(300);
  record.measures.narrowed = b.evaluate(LIST);
  record.checks.push(...listChecks(record.measures.narrowed, ["Caradoc", "Corwin"], phone));

  if (phone) {
    const tapped = clickAsPlayer(b, '[aria-label="Mention a player"] [role="option"]:nth-child(2)');
    record.presses.push({ press: "Corwin, tapped", status: tapped ?? "led" });
  } else {
    b.run("press", "ArrowDown");
    record.measures.chosen = b.evaluate(LIST);
    record.checks.push({
      check: "ArrowDown makes Corwin the field's active option, the one selected",
      ok: record.measures.chosen.active === "Corwin" && record.measures.chosen.focused === true,
    });
    b.run("press", "Enter");
    record.presses.push({ press: "ArrowDown, Enter", status: "led" });
  }
  await sleep(300);
  record.measures.picked = b.evaluate(LIST);
  record.checks.push(
    {
      check: 'the pick writes "@Corwin " and closes the list',
      ok: record.measures.picked.value === "@Corwin " && record.measures.picked.names.length === 0,
    },
    { check: "the keyboard stays in the field", ok: record.measures.picked.focused === true },
  );

  b.run("type", COMPOSER, "hold the gate");
  b.run("press", "Enter");
  await sleep(500);
  record.measures.sent = b.evaluate(LAST);
  record.checks.push({
    check: "the message sent comes back drawn with its mention",
    ok:
      record.measures.sent?.text.endsWith("<Maelis> @Corwin hold the gate") &&
      record.measures.sent.mentions.join() === "@Corwin",
  });
  b.run("screenshot", join(out, `mentions-sent-${tag}.png`));
};

const above = (upper, lower, slack = 1) => upper !== null && lower !== null && upper.bottom <= lower.top + slack;

/** The rail with chat open: the details and chat share the column, the Events name whole, the tag under the column. */
const railOpenChecks = (rail) => [
  { check: "the rail is drawn with the details and the open chat", ok: rail.details !== null && rail.pane !== null },
  { check: "what shows of the details ends above the chat", ok: above(rail.detailsShown, rail.chat) },
  ...detailsChecks(rail),
  {
    check: "the chat keeps its least height (300 px, strip included)",
    ok: rail.chat !== null && rail.chat.height >= 299,
  },
  { check: "the open chat's composer is in view, inside the rail", ok: inside(rail.composer, rail.rail) },
  {
    check: "the chat keeps its first control at the top and its composer at the foot, both inside it",
    ok: inside(rail.firstControl, rail.pane) && inside(rail.composer, rail.pane),
  },
  { check: "the Events name reads whole", ok: rail.eventsTitleCut === false },
  { check: "the Events count is inside the panel", ok: inside(rail.unread, rail.events) },
  ...tagChecks(rail),
];

/** The details' least height: `details-least` (120 px), or all they hold when that is less, with their first header. */
const detailsChecks = (rail) => [
  {
    check: "the details keep a header and a body: 120 px, or all they hold",
    ok:
      rail.details !== null &&
      rail.detailsHold !== null &&
      rail.details.height >= Math.min(120, rail.detailsHold) - 1 &&
      inside(rail.firstPanelHead, rail.details),
  },
];

/** The build tag in the band under the column: the rail and the strip end above it, and nothing draws over it. */
const tagChecks = (rail) => [
  { check: "the build tag is drawn", ok: rail.tag !== null && rail.tag.width > 0 },
  { check: "the rail ends above the build tag", ok: above(rail.rail, rail.tag) },
  { check: "the strip is in the rail, above the build tag", ok: inside(rail.strip, rail.rail) },
  { check: "nothing draws over the build tag", ok: rail.tagCovered === false },
  { check: "the build tag is on screen", ok: rail.tag !== null && rail.tag.bottom <= rail.viewport.height + 1 },
];

/** The column's two ends, as its own scroll shows them: Next up's head at its top, the strip at its bottom. */
const REACH = `(() => {
  const rail = document.querySelector('aside[aria-label="Guided rail"]');
  const column = rail.firstElementChild;
  const rect = (element) => element ? JSON.parse(JSON.stringify(element.getBoundingClientRect())) : null;
  const was = column.scrollTop;
  column.scrollTop = 0;
  const top = rect(rail.querySelector("section .ui-panel__head"));
  column.scrollTop = column.scrollHeight;
  const bottom = rect(rail.querySelector('[aria-label="Chat strip"]'));
  column.scrollTop = was;
  return { rail: rect(rail), scrolls: column.scrollHeight - column.clientHeight, top, bottom };
})()`;

const reachChecks = (reach) => [
  {
    check: "every part is reachable: Next up's head at the column's top, the strip at its bottom",
    ok: inside(reach.top, reach.rail) && inside(reach.bottom, reach.rail),
  },
];

/** The wheel over each place, as the canvas under them counted it: only the bare map's reaches it. */
const wheelChecks = (wheel) =>
  Object.entries(wheel).map(([place, reached]) =>
    place === "map"
      ? { check: "the wheel over the bare map reaches the canvas", ok: reached === 3 }
      : { check: `the wheel over ${place} never reaches the canvas`, ok: reached === 0 },
  );

/**
 * Turns the wheel three notches over each place, as the browser sends one: to the element under the point, bubbling
 * up from it. Counts what the canvas receives.
 */
const turnWheelOver = (b) => {
  b.evaluate(
    // One listener a page, however many times a page is measured (a resized page is measured at each height).
    `(() => { window.__mapWheels = 0; if (!window.__mapWheelsCounted) { window.__mapWheelsCounted = true; document.querySelector('canvas[data-lab="map"]').addEventListener("wheel", () => { window.__mapWheels += 1; }); } return true; })()`,
  );
  const reached = {};
  for (const [place, point] of Object.entries(b.evaluate(WHEEL_TARGETS))) {
    reached[place] =
      point === null
        ? null
        : b.evaluate(`(() => {
            const [x, y] = ${JSON.stringify(point)};
            const before = window.__mapWheels;
            for (let notch = 0; notch < 3; notch += 1) {
              document.elementFromPoint(x, y).dispatchEvent(
                new WheelEvent("wheel", { bubbles: true, cancelable: true, clientX: x, clientY: y, deltaY: 120 }),
              );
            }
            return window.__mapWheels - before;
          })()`);
  }
  return reached;
};

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

      for (const [viewport, phone] of [
        [["1440", "900"], false],
        [["390", "844"], true],
      ]) {
        const mention = { state: `mentions, ${viewport.join("×")}`, ready: false, presses: [], checks: [] };
        records.push(mention);
        mention.ready = await open(b, `${baseUrl}/lab/kit/chat?state=open`, viewport);
        if (mention.ready) await proveMentions(b, out, mention, phone);
      }

      const strip = { state: "closed, 1440×900", ready: false, presses: [], checks: [] };
      records.push(strip);
      strip.ready = await open(b, `${baseUrl}/lab/kit/chat?state=closed`, ["1440", "900"]);
      if (strip.ready) {
        strip.measures = b.evaluate(STRIP);
        strip.checks.push(...stripChecks(strip.measures));
        b.run("screenshot", join(out, "chat-strip.png"));
      }

      for (const viewport of RAIL_OPEN_SIZES) {
        const size = viewport.join("×");
        const rail = { state: `rail, chat open, ${size}`, ready: false, presses: [], checks: [] };
        records.push(rail);
        rail.ready = await open(b, `${baseUrl}/lab/kit/chat?state=rail`, viewport);
        if (rail.ready) {
          rail.measures = b.evaluate(RAIL);
          rail.measures.reach = b.evaluate(REACH);
          rail.checks.push(...railOpenChecks(rail.measures), ...reachChecks(rail.measures.reach));
          b.run("screenshot", join(out, `rail-open-${size}.png`));
          rail.measures.wheel = turnWheelOver(b);
          rail.checks.push(...wheelChecks(rail.measures.wheel));
        }
      }

      // One page, chat open, made shorter: the rail's structure, not where the page opened, keeps the chat's foot in.
      const resized = { state: "rail, chat open, 1440×900", ready: false, presses: [], checks: [] };
      resized.ready = await open(b, `${baseUrl}/lab/kit/chat?state=rail`, ["1440", "900"]);
      for (const height of RAIL_RESIZE_HEIGHTS) {
        const size = `1440×${height}`;
        const step = {
          state: `rail, chat open, resized from 1440×900 to ${size}`,
          ready: false,
          presses: [],
          checks: [],
        };
        records.push(step);
        if (!resized.ready) continue;
        b.run("set", "viewport", "1440", height);
        await sleep(SETTLE_MS);
        step.ready = true;
        step.measures = b.evaluate(RAIL);
        step.measures.reach = b.evaluate(REACH);
        step.checks.push(...railOpenChecks(step.measures), ...reachChecks(step.measures.reach));
        b.run("screenshot", join(out, `rail-resized-${size}.png`));
        step.measures.wheel = turnWheelOver(b);
        step.checks.push(...wheelChecks(step.measures.wheel));
      }

      for (const viewport of RAIL_CLOSED_SIZES) {
        const size = viewport.join("×");
        const closed = { state: `rail, chat closed, ${size}`, ready: false, presses: [], checks: [] };
        records.push(closed);
        closed.ready = await open(b, `${baseUrl}/lab/kit/chat?state=rail&chat=closed`, viewport);
        if (closed.ready) {
          closed.measures = b.evaluate(RAIL);
          closed.measures.reach = b.evaluate(REACH);
          closed.checks.push(
            ...detailsChecks(closed.measures),
            ...tagChecks(closed.measures),
            ...reachChecks(closed.measures.reach),
          );
          b.run("screenshot", join(out, `rail-closed-${size}.png`));
        }
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
