/**
 * The HUD chat's geometry, measured in a real browser on the lab's chat (/lab/kit/chat: the real HudChatWindow and chat
 * shell over a room of forty messages, the last a long one, with unread messages):
 *
 * - open, at 1440×900: the pane keeps its height, its composer and every control stay inside the pane and the
 *   viewport, and the history scrolls inside the pane without moving the composer;
 * - closed, at 1440×900: the strip stays inside the HUD's column, its last message truncated, its unread count in view;
 * - closed and folded on a phone held upright (390×844): the strip is its icon and its unread count alone;
 * - opened from the strip, at 1440×900 and 390×844, each frame recorded from the press: the pane's first frame shows the
 *   newest message and the history never slides after; a message arriving (the lab's **A message arrives**) keeps a
 *   reader on the newest there with no jump offered; one arriving while the reader scrolled up leaves the history where
 *   it was and offers **New messages**, which shows the newest and goes;
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
 * - places, at 1440×900 and on a phone (390×844), in the open pane: the room's places are chips, painted; the lab realm
 *   shared today and a Well open, the army gone since is struck through and opens nothing, and the realm's number in
 *   another game names that game and opens nothing; the place button shares the realm selected on the map, over the
 *   field, and the message sent comes back carrying it as a chip that opens. (Opening one moves the game's route, which
 *   the lab has not; the chat's tests press it, and the game proof's chat-place task in a game.)
 *
 * - a player's card, at 1440×900 and on a phone (390×844), in the open pane: beside the tabs, how many players are
 *   online; Aldric's name pressed opens his card under his message, inside the pane and the screen, with his realm as a
 *   place that opens, Message and Mute; Mute leaves his messages as his name and "muted" and lists him in Messages
 *   under Muted, with Unmute; Unmute brings them back, and Message opens his conversation.
 *
 * - the app's chat, on the app lab's pages (/lab/app/<screen>/<page>, the real shell over its fixtures and the lab's
 *   answered chat sockets): at 1440×900, the bar's Chat opens the pane over Play, inside the screen, with Global (its
 *   history, a field) and Messages, and Escape closes it; on a phone (390×844), the Chat tab leads to /chat (the lab's
 *   tabs lead to the app's own addresses, so the lab's /chat page is opened by its address), lit there, the chat
 *   filling the page from the top band to the tabs, its field above them, the page never scrolling; the same page grown
 *   to 1440×900, and opened there, draws one chat and no pane, the bar's Chat the place lit; on a Blitz lobby, at both sizes, the lobby's chat on its page has Lobby first, then Global and Messages,
 *   the Lobby room read-only for a wallet not registered (no field, who writes there said) and Global written in, and
 *   on a desktop no bar Chat over it.
 * - the Frontier phone's Chat page (/lab/kit/hud/chat, 390×844): the page fills the band from the strip to the place
 *   bar, the map band gone behind it, its field above the bar.
 *
 * - a phone's on-screen keyboard (390×844, a 336 px keyboard staged by lib/stage-keyboard.js, in a session of its own):
 *   on the app's Chat page (/lab/app/home/chat), Frontier's chat page (/lab/kit/unified/frontier, its place bar's Chat)
 *   and Blitz's compact HUD (/lab/kit/unified/blitz, its Chat tab), the field is focused, the keyboard opens, a message
 *   is typed and sent: the field stays whole above the keyboard with the focus, the message sent shows just above it,
 *   the chat's tabs stay on screen, and the bars for moving between places step aside; and Frontier's Withdraw sheet
 *   (/lab/kit/hud/withdraw), upright with that keyboard and sideways (844×390) with a 200 px one: an amount typed, its
 *   field stands whole above the keyboard, its confirm too once the sheet is scrolled to it, and the keyboard closed,
 *   the sheet stands where it stood; the keyboard closed, they are back. `keyboard` as a third
 *   argument runs these records alone.
 *
 * Writes a screenshot of each and the measures with each check to <out-dir>/run-<start>/hud-chat.json (the keyboard's to
 * hud-chat-keyboard.json); exits 1 when a check fails.
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
    // The controls drawn: a message's Reply is drawn only once the message is clicked or holds the keyboard.
    controls: pane ? [...pane.querySelectorAll("button, input, textarea")].filter((c) => c.getClientRects().length > 0).map(rect) : [],
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

/** The open pane's history: its scroll, the furthest it goes, whether the newest message shows whole, and the jump. */
const HISTORY = `(() => {
  const list = document.querySelector('[data-lab="chat"] section[aria-label="Chat"] ul');
  const scroller = list?.parentElement;
  const newest = list?.querySelector("li:last-child");
  const box = scroller?.getBoundingClientRect();
  const row = newest?.getBoundingClientRect();
  return {
    top: scroller ? Math.round(scroller.scrollTop) : null,
    furthest: scroller ? scroller.scrollHeight - scroller.clientHeight : null,
    newest: newest?.textContent ?? null,
    newestInView: Boolean(box && row && row.top >= box.top - 1 && row.bottom <= box.bottom + 1),
    jump: document.querySelector('[data-lab="chat"] [aria-label="New messages"]') !== null,
  };
})()`;

/** Records the history on every frame from the pane's first until 1.2 s after it, into window.__historyFrames. */
const RECORD_FRAMES = `(() => {
  window.__historyFrames = [];
  let first = null;
  const frame = () => {
    const history = ${HISTORY};
    if (history.top !== null) {
      first ??= performance.now();
      window.__historyFrames.push({ at: Math.round(performance.now() - first), ...history });
    }
    if (first === null || performance.now() - first < 1200) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return true;
})()`;

/** The reader scrolls the history to `top`: the position moves and the list hears its scroll, as a wheel's does. */
const scrollHistoryTo = (top) => `(() => {
  const scroller = document.querySelector('[data-lab="chat"] section[aria-label="Chat"] ul').parentElement;
  scroller.scrollTop = ${top};
  return Math.round(scroller.scrollTop);
})()`;

/** Opening from the strip: the first frame drawn shows the newest message, and no later frame moves the history. */
const openingChecks = (frames) => [
  {
    check: "the pane's first frame shows the newest message",
    ok: frames.length > 0 && frames[0].newestInView && frames[0].top === frames[0].furthest,
  },
  {
    check: "the history never slides after it opens",
    ok: frames.length > 0 && frames.every((frame) => frame.top === frames[0].top),
  },
];

const arrivalChecks = ({ atNewest, scrolledUp, readAt, jumped }) => [
  {
    check: "a message arriving keeps a reader on the newest there, with no jump offered",
    ok: atNewest.newestInView && atNewest.newest?.includes("Arrived just now") && !atNewest.jump,
  },
  {
    check: "a message arriving while the reader scrolled up leaves the history where it was, and offers the jump",
    ok: scrolledUp.top === readAt && !scrolledUp.newestInView && scrolledUp.jump,
  },
  {
    check: "the jump shows the newest message and goes",
    ok: jumped.newestInView && jumped.top === jumped.furthest && !jumped.jump,
  },
];

/** Chat opened from its strip as a player opens it, then two messages arriving: at the newest, and scrolled up. */
const proveOpening = async (b, out, records, baseUrl, viewport) => {
  const size = viewport.join("×");
  const record = { state: `opened from the strip, ${size}`, ready: false, presses: [], checks: [] };
  records.push(record);
  record.ready = await open(b, `${baseUrl}/lab/kit/chat?state=closed`, viewport);
  if (!record.ready) return;
  b.evaluate(RECORD_FRAMES);
  const opened = clickAsPlayer(b, '[aria-label="Chat strip"]');
  await waitFor(b, "window.__historyFrames.at(-1)?.at >= 1200", READY_MS);
  const frames = b.evaluate("window.__historyFrames");
  record.measures = { opened, frames };
  record.checks.push(...openingChecks(frames));
  b.run("screenshot", join(out, `opened-${size}.png`));

  clickAsPlayer(b, '[data-lab="arrive"]');
  await sleep(500);
  const atNewest = b.evaluate(HISTORY);
  const readAt = b.evaluate(scrollHistoryTo(400));
  await sleep(300);
  clickAsPlayer(b, '[data-lab="arrive"]');
  await sleep(500);
  const scrolledUp = b.evaluate(HISTORY);
  b.run("screenshot", join(out, `scrolled-up-arrival-${size}.png`));
  clickAsPlayer(b, '[aria-label="New messages"]');
  await sleep(500);
  const jumped = b.evaluate(HISTORY);
  b.run("screenshot", join(out, `jumped-${size}.png`));
  record.measures = { ...record.measures, atNewest, readAt, scrolledUp, jumped };
  record.checks.push(...arrivalChecks({ atNewest, scrolledUp, readAt, jumped }));
};

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
  const last = [...document.querySelectorAll('[data-lab="chat"] section[aria-label="Chat"] li[data-message-id]')].at(-1);
  return last
    ? {
        // The run's head names its sender: a button for another player (their card), plain words for the player.
        sender: last.querySelector("p")?.firstElementChild?.textContent ?? null,
        words: [...last.querySelectorAll("p")].at(-1)?.textContent ?? null,
        mentions: [...last.querySelectorAll("[data-mention]")].map((m) => m.textContent),
      }
    : null;
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
      record.measures.sent?.sender === "Maelis" &&
      record.measures.sent.words === "@Corwin hold the gate" &&
      record.measures.sent.mentions.join() === "@Corwin",
  });
  b.run("screenshot", join(out, `mentions-sent-${tag}.png`));
};

/** The pane's places: each chip in the history, the place button, and the place over the field. */
const PLACES = `(() => {
  const pane = document.querySelector('[data-lab="chat"] section[aria-label="Chat"]');
  const chip = (element) => {
    const image = element.querySelector("img");
    return {
      id: element.closest("li[data-message-id]")?.getAttribute("data-message-id") ?? null,
      name: element.getAttribute("data-place"),
      elsewhere: element.hasAttribute("data-elsewhere"),
      words: element.textContent,
      struck: getComputedStyle(element).textDecorationLine.includes("line-through"),
      opens: !(element.querySelector("button")?.disabled ?? true),
      painted: Boolean(image && image.complete && image.naturalWidth > 0),
    };
  };
  const share = pane?.querySelector('button[aria-label="Share the selected place"]');
  const picked = pane?.querySelector("form [data-place]");
  const last = [...(pane?.querySelectorAll("li[data-message-id]") ?? [])].at(-1);
  const lastChip = last?.querySelector("[data-place]");
  return {
    chips: [...(pane?.querySelectorAll("li[data-message-id] [data-place]") ?? [])].map(chip),
    share: share ? { enabled: !share.disabled } : null,
    picked: picked ? chip(picked) : null,
    last: last ? { words: [...last.querySelectorAll("p")].at(-1)?.textContent ?? null, chip: lastChip ? chip(lastChip) : null } : null,
  };
})()`;

/** Places on one device: the history's chips read, the selected realm shared over the field, and the message sent. */
const provePlaces = async (b, out, record, phone) => {
  const tag = phone ? "phone" : "desktop";
  record.measures = { history: b.evaluate(PLACES) };
  const { chips, share } = record.measures.history;
  const of = (id) => chips.find((chip) => chip.id === id);
  const [elsewhere, well, gone, today] = ["lab-29", "lab-30", "lab-31", "lab-32"].map(of);
  record.checks.push(
    {
      check: "the room's places are chips, each painted",
      ok: chips.length >= 4 && chips.every((chip) => chip.painted),
    },
    { check: "the realm shared today opens, and is not struck through", ok: Boolean(today?.opens) && !today.struck },
    { check: "the Well shared today opens, named as the map names it", ok: well?.name === "Well" && well.opens },
    {
      check: "the army gone since is struck through and opens nothing",
      ok: gone?.name === "Iron Wardens" && gone.struck && !gone.opens,
    },
    {
      check: "the realm's number in another game names that game, and opens nothing here",
      ok:
        elsewhere?.elsewhere === true &&
        elsewhere.name === "Moondeep" &&
        elsewhere.words.includes("in Frontier 4") &&
        !elsewhere.struck &&
        !elsewhere.opens,
    },
    { check: "the place button can share the realm selected on the map", ok: share?.enabled === true },
  );
  b.run("screenshot", join(out, `places-history-${tag}.png`));

  const pressed = clickAsPlayer(b, '[data-lab="chat"] button[aria-label="Share the selected place"]');
  record.presses.push({ press: "the place button", status: pressed ?? "led" });
  await sleep(300);
  record.measures.picked = b.evaluate(PLACES).picked;
  record.checks.push({
    check: "the selected realm goes over the field, named and painted as in the room",
    ok: Boolean(today) && record.measures.picked?.name === today.name && record.measures.picked.painted,
  });
  b.run("screenshot", join(out, `places-picked-${tag}.png`));

  b.run("type", COMPOSER, "hold here");
  b.run("press", "Enter");
  await sleep(500);
  record.measures.sent = b.evaluate(PLACES);
  record.checks.push(
    {
      check: "the message sent comes back with its words and the place as a chip that opens",
      ok:
        Boolean(today) &&
        record.measures.sent.last?.words?.startsWith("hold here") === true &&
        record.measures.sent.last.chip?.name === today.name &&
        record.measures.sent.last.chip.opens,
    },
    { check: "the field holds no place after sending", ok: record.measures.sent.picked === null },
  );
  b.run("screenshot", join(out, `places-sent-${tag}.png`));
};

/** The pane's player card, its online count, and Aldric's rows: what a press on his name and the card's buttons show. */
const CARD = `(() => {
  const pane = document.querySelector('[data-lab="chat"] section[aria-label="Chat"]');
  const rect = (element) => (element ? JSON.parse(JSON.stringify(element.getBoundingClientRect())) : null);
  const card = pane?.querySelector("[data-player-card]");
  const buttons = [...(card?.querySelectorAll("button") ?? [])];
  const chip = card?.querySelector("[data-place]");
  const aldric = [...(pane?.querySelectorAll("li[data-message-id]") ?? [])].filter(
    (row) => row.querySelector("p button")?.textContent === "Aldric",
  );
  return {
    viewport: { width: innerWidth, height: innerHeight },
    pane: rect(pane),
    online: document.querySelector('[data-lab="chat"] [data-online]')?.textContent ?? null,
    card: card
      ? {
          box: rect(card),
          after: card.previousElementSibling?.querySelector("p button")?.textContent ?? null,
          words: card.textContent,
          buttons: buttons.map((button) => ({ words: button.textContent, box: rect(button) })),
          realm: chip ? { name: chip.getAttribute("data-place"), opens: !(chip.querySelector("button")?.disabled ?? true) } : null,
        }
      : null,
    aldric: aldric.map((row) => row.textContent),
    conversation: document.querySelector('[data-lab="chat"] header')?.textContent ?? null,
  };
})()`;

const ALDRIC_NAME = '[data-lab="chat"] li[data-message-id] p button';

/** Messages' Muted group: who it lists, its Unmute buttons, and whether each stands whole in the pane. */
const MUTED_GROUP = `(() => {
  const pane = document.querySelector('[data-lab="chat"] section[aria-label="Chat"]');
  const rect = (element) => (element ? JSON.parse(JSON.stringify(element.getBoundingClientRect())) : null);
  const group = pane?.querySelector('section[aria-label="Muted"]');
  return {
    pane: rect(pane),
    words: group?.textContent ?? null,
    unmute: [...(group?.querySelectorAll("button") ?? [])].map((button) => ({ words: button.textContent, box: rect(button) })),
  };
})()`;
const chatTab = (words) => `(() => {
  const tab = [...document.querySelectorAll('[data-lab="chat"] [role="tab"]')].find((t) => t.textContent.startsWith(${JSON.stringify(words)}));
  if (!tab) return false;
  tab.click();
  return true;
})()`;
const openAldricCard = `(() => {
  const name = [...document.querySelectorAll(${JSON.stringify(ALDRIC_NAME)})].findLast((button) => button.textContent === "Aldric");
  if (!name) return false;
  name.scrollIntoView({ block: "center" });
  name.click();
  return true;
})()`;
const cardPress = (words) => `(() => {
  const button = [...document.querySelectorAll('[data-lab="chat"] [data-player-card] button')].find((b) => b.textContent === ${JSON.stringify(words)});
  if (!button) return false;
  button.click();
  return true;
})()`;

/** The card on one device: the online count, Aldric's card opened from his name, Mute and Unmute, then Message. */
const proveCard = async (b, out, record, phone) => {
  const tag = phone ? "phone" : "desktop";
  record.measures = { closed: b.evaluate(CARD) };
  record.checks.push({
    check: "beside the tabs, the players online: 2",
    ok: record.measures.closed.online === "2 online",
  });

  const opened = b.evaluate(`(() => {
    const name = [...document.querySelectorAll(${JSON.stringify(ALDRIC_NAME)})].findLast((button) => button.textContent === "Aldric");
    if (!name) return false;
    name.scrollIntoView({ block: "center" });
    name.click();
    return true;
  })()`);
  record.presses.push({ press: "Aldric's name", status: opened ? "led" : "missing" });
  await sleep(400);
  const open = b.evaluate(CARD);
  record.measures.open = open;
  const words = (open.card?.buttons ?? []).map((button) => button.words);
  record.checks.push(
    {
      check: "his card opens under his message",
      ok: open.card?.after === "Aldric" && open.card.words.includes("Aldric"),
    },
    { check: "it shows his realm as a place that opens", ok: Boolean(open.card?.realm?.opens) },
    { check: "it offers Message and Mute", ok: words.includes("Message") && words.includes("Mute") },
    {
      check: "the card and each of its buttons are whole inside the pane and the screen",
      ok:
        open.card !== null &&
        inside(open.card.box, open.pane) &&
        open.card.box.right <= open.viewport.width &&
        open.card.buttons.every((button) => inside(button.box, open.card.box)),
    },
  );
  b.run("screenshot", join(out, `card-${tag}.png`));

  record.presses.push({ press: "Mute", status: b.evaluate(cardPress("Mute")) ? "led" : "missing" });
  await sleep(300);
  record.measures.muted = b.evaluate(CARD);
  record.checks.push({
    check: "muted, his messages read as his name and muted, the card offering Unmute",
    ok:
      record.measures.muted.aldric.length > 0 &&
      record.measures.muted.aldric.every((row) => row.includes("muted")) &&
      record.measures.muted.card?.buttons.some((button) => button.words === "Unmute") === true,
  });
  b.run("screenshot", join(out, `card-muted-${tag}.png`));

  // Muted, he stands in Messages under Muted, with Unmute: reachable wherever he last wrote, or never wrote in a room.
  record.presses.push({ press: "Messages", status: b.evaluate(chatTab("Messages")) ? "led" : "missing" });
  await sleep(300);
  record.measures.mutedGroup = b.evaluate(MUTED_GROUP);
  const group = record.measures.mutedGroup;
  record.checks.push({
    check: "Messages lists him under Muted, with an Unmute whole inside the pane",
    ok:
      group.words?.includes("Aldric") === true &&
      group.unmute.length === 1 &&
      group.unmute[0].words === "Unmute" &&
      inside(group.unmute[0].box, group.pane),
  });
  b.run("screenshot", join(out, `card-muted-messages-${tag}.png`));
  record.presses.push({ press: "Global", status: b.evaluate(chatTab("Global")) ? "led" : "missing" });
  await sleep(300);
  record.presses.push({ press: "Aldric's name, again", status: b.evaluate(openAldricCard) ? "led" : "missing" });
  await sleep(300);

  record.presses.push({ press: "Unmute", status: b.evaluate(cardPress("Unmute")) ? "led" : "missing" });
  await sleep(300);
  record.measures.unmuted = b.evaluate(CARD);
  record.checks.push({
    check: "unmuted, his messages read again",
    ok: record.measures.unmuted.aldric.some((row) => !row.includes("muted")),
  });

  record.presses.push({ press: "Message", status: b.evaluate(cardPress("Message")) ? "led" : "missing" });
  await sleep(300);
  record.measures.written = b.evaluate(CARD);
  record.checks.push({
    check: "Message opens his conversation",
    ok: record.measures.written.conversation?.includes("Aldric") === true,
  });
  b.run("screenshot", join(out, `card-message-${tag}.png`));
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

/** The app's chat where it stands: its box, its tabs, its rows, its field, and the frame's bands around it. */
const APP_CHAT = `(() => {
  const rect = (element) => element ? JSON.parse(JSON.stringify(element.getBoundingClientRect())) : null;
  const chat = document.querySelector('section[aria-label="Chat"]') ?? document.querySelector('[data-band="body"] [data-hud-mode="app"]');
  const band = (name) => rect(document.querySelector('[data-band="' + name + '"]'));
  const place = document.querySelector('[data-band="bar"] button[data-role="tab"], [data-band="bar"] a[href$="/chat"], [data-band="tabs"] a[href$="/chat"]');
  return {
    viewport: { width: innerWidth, height: innerHeight },
    scrolls: document.scrollingElement.scrollHeight > innerHeight + 1,
    path: location.pathname,
    chats: document.querySelectorAll('[data-hud-mode="app"] [role="tablist"]').length,
    pane: document.querySelector('section[aria-label="Chat"]') !== null,
    chat: rect(chat),
    tabs: chat ? [...chat.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent) : [],
    current: chat ? chat.querySelector('[role="tab"][aria-selected="true"]')?.textContent ?? null : null,
    rows: chat ? chat.querySelectorAll("li[data-message-id]").length : 0,
    field: rect(chat?.querySelector('input[aria-label="Message"]')),
    words: chat?.textContent ?? "",
    place: place ? { words: place.textContent, href: place.getAttribute("href"), count: place.querySelector("[data-count]")?.textContent ?? null, current: place.getAttribute("aria-current") } : null,
    top: band("top"),
    body: band("body"),
    nav: band("tabs"),
  };
})()`;
const APP_CHAT_PLACE = '[data-band="bar"] button[data-role="tab"]';
const READ_ONLY = "Players registered in this Blitz write here.";
const LOBBY = "/lab/app/entry-choose/blitz/slot-blitz-1630?capture=1";

const openApp = async (b, url, viewport, ready) => {
  b.run("set", "viewport", ...viewport);
  b.run("open", url, "--ignore-https-errors");
  const shown = await waitFor(b, ready, READY_MS);
  await sleep(SETTLE_MS);
  return shown;
};
const pressTab = (words) => `(() => {
  const tab = [...document.querySelectorAll('section[aria-label="Chat"] [role="tab"]')].find((t) => t.textContent === ${JSON.stringify(words)});
  if (!tab) return false;
  tab.click();
  return true;
})()`;

/** The desktop's pane: the bar's Chat (its unread counted), the pane over Play, Escape. */
const proveAppPane = async (b, out, record) => {
  const press = clickAsPlayer(b, APP_CHAT_PLACE);
  record.presses.push({ press: "Chat, in the bar", status: press === null ? "led" : press });
  await sleep(600);
  const open = b.evaluate(APP_CHAT);
  record.measures = { open };
  record.checks.push(
    { check: "the bar's Chat is lit while the pane is open", ok: open.place?.current === "page" },
    {
      check: "the pane is whole inside the screen",
      ok:
        open.chat !== null &&
        inside(open.chat, { left: 0, top: 0, right: open.viewport.width, bottom: open.viewport.height }),
    },
    {
      check: "its tabs are Global, then Messages",
      ok: JSON.stringify(open.tabs) === JSON.stringify(["Global", "Messages"]),
    },
    {
      check: "Global shows its history and a field to write in",
      ok: open.rows >= 3 && open.field !== null && inside(open.field, open.chat),
    },
    { check: "the page stays under it: Play is still the page", ok: open.path.endsWith("/home") },
  );
  b.run("screenshot", join(out, "app-chat-pane.png"));
  b.run("press", "Escape");
  await sleep(300);
  record.measures.closed = b.evaluate(APP_CHAT);
  record.checks.push({ check: "Escape closes the pane", ok: record.measures.closed.chat === null });
};

/** The phone's Chat page, the chat filling it from the top band to the tabs. */
const proveAppPhonePage = async (b, out, record) => {
  const page = b.evaluate(APP_CHAT);
  record.measures = { page };
  record.checks.push(
    {
      check: "the Chat tab leads to /chat, and is lit there",
      ok: page.place?.href === "/chat" && page.place.current === "page",
    },
    {
      check: "its tabs are Global, then Messages",
      ok: JSON.stringify(page.tabs) === JSON.stringify(["Global", "Messages"]),
    },
    {
      check: "the chat fills the page: from the top band's foot to within 8 px of the tabs",
      ok:
        page.chat !== null &&
        page.top !== null &&
        page.nav !== null &&
        Math.abs(page.chat.top - page.top.bottom) <= 1 &&
        page.chat.bottom <= page.nav.top &&
        page.nav.top - page.chat.bottom <= 8,
    },
    {
      check: "its field stands above the tabs, inside the screen",
      ok: page.field !== null && page.field.bottom <= page.nav.top && page.nav.bottom <= page.viewport.height + 1,
    },
    { check: "the page itself never scrolls", ok: !page.scrolls },
  );
  b.run("screenshot", join(out, "app-chat-phone.png"));
};

/** Chat's own page on a desktop: one chat, the page's, no pane over it, the bar's Chat the place lit there. */
const proveDesktopChatPage = (b, out, record, still) => {
  const page = b.evaluate(APP_CHAT);
  record.measures = { page };
  record.checks.push(
    { check: "one chat is drawn, the page's, with no pane over it", ok: page.chats === 1 && !page.pane },
    {
      check: "its tabs are Global, then Messages",
      ok: JSON.stringify(page.tabs) === JSON.stringify(["Global", "Messages"]),
    },
    {
      check: "the bar's Chat is the place lit there, a way to /chat, not a pane to open",
      ok: page.place?.href === "/chat" && page.place.current === "page",
    },
  );
  b.run("screenshot", join(out, still));
};

/** A Blitz lobby's chat on its page: Lobby first, read-only for a wallet not registered; Global written in. */
const proveLobbyChat = async (b, out, record, phone) => {
  b.evaluate(
    `(() => { document.querySelector('section[aria-label="Chat"]')?.scrollIntoView({ block: "center" }); return true; })()`,
  );
  await sleep(300);
  const lobby = b.evaluate(APP_CHAT);
  record.measures = { lobby };
  record.checks.push(
    {
      check: "its tabs are Lobby, Global, then Messages, on Lobby",
      ok: JSON.stringify(lobby.tabs) === JSON.stringify(["Lobby", "Global", "Messages"]) && lobby.current === "Lobby",
    },
    { check: "Lobby shows its history", ok: lobby.rows >= 3 },
    {
      check: "a wallet not registered reads Lobby with no field, told who writes there",
      ok: lobby.field === null && lobby.words.includes(READ_ONLY),
    },
    {
      check: "the chat is whole across the screen",
      ok: lobby.chat !== null && lobby.chat.left >= 0 && lobby.chat.right <= lobby.viewport.width,
    },
  );
  if (!phone)
    record.checks.push({
      check: "the page shows its chat, so the bar offers no Chat over it",
      ok: lobby.place === null,
    });
  b.run("screenshot", join(out, `app-chat-lobby-${phone ? "phone" : "desktop"}.png`));
  record.presses.push({ press: "Global", status: b.evaluate(pressTab("Global")) ? "led" : "missing" });
  await sleep(500);
  record.measures.global = b.evaluate(APP_CHAT);
  record.checks.push({
    check: "Global, on the same chat, is written in",
    ok: record.measures.global.field !== null && !record.measures.global.words.includes(READ_ONLY),
  });
};

/** The Frontier phone's Chat page: the whole band from the strip to the place bar. */
const FRONTIER_PAGE = `(() => {
  const rect = (element) => element ? JSON.parse(JSON.stringify(element.getBoundingClientRect())) : null;
  const hud = document.querySelector('[aria-label="Frontier HUD"]');
  const page = hud?.querySelector("[data-page]");
  return {
    viewport: innerHeight,
    top: rect(hud?.querySelector("[data-hud-top]")),
    page: rect(page),
    chat: rect(hud?.querySelector("[data-page-fills]")),
    map: rect(hud?.querySelector("[data-map-band]")),
    field: rect(hud?.querySelector('[data-page-fills] input[aria-label="Message"]')),
    bar: rect(page?.nextElementSibling),
  };
})()`;
const frontierPageChecks = (m) => [
  {
    check: "the page stands on the place bar",
    ok: m.page !== null && m.bar !== null && m.bar.top - m.page.bottom <= 8 && m.page.bottom <= m.bar.top,
  },
  {
    check: "it reaches up to the strip: within 14 px of its foot",
    ok: m.top !== null && m.page !== null && m.page.top >= m.top.bottom && m.page.top - m.top.bottom <= 14,
  },
  {
    check: "the chat fills the page",
    ok: m.chat !== null && Math.abs(m.chat.top - m.page.top) <= 1 && Math.abs(m.chat.bottom - m.page.bottom) <= 1,
  },
  { check: "the map band is gone behind it", ok: m.map !== null && m.map.height === 0 },
  {
    check: "its field stands above the place bar",
    ok: m.field !== null && m.field.bottom <= m.bar.top && m.bar.bottom <= m.viewport + 1,
  },
];

/** The staged keyboard's height: a phone's, upright (a 390 px wide Android keyboard with its suggestion row). */
const KEYBOARD_PX = 336;
const KEYBOARD_SCRIPT = fileURLToPath(new URL("./lib/stage-keyboard.js", import.meta.url));
/** The phone's three chats: the app's page, Frontier's page from its place bar, Blitz's compact HUD from its tab. */
const KEYBOARD_PAGES = [
  { name: "app", path: "/lab/app/home/chat?capture=1", open: null },
  {
    name: "frontier",
    path: "/lab/kit/unified/frontier?capture=1",
    open: 'nav[aria-label="Places"] button',
  },
  { name: "blitz", path: "/lab/kit/unified/blitz?capture=1", open: 'nav[aria-label="HUD tabs"] button' },
];
const FIELD = 'input[aria-label="Message"]';
/** Chat as the player sees it with the keyboard: the field, the last message, what is left of the screen. */
const KEYBOARD_VIEW = `(() => {
  const rect = (element) => (element ? JSON.parse(JSON.stringify(element.getBoundingClientRect())) : null);
  const shown = (element) => element.getClientRects().length > 0;
  const field = [...document.querySelectorAll(${JSON.stringify(FIELD)})].find(shown) ?? null;
  const rows = [...document.querySelectorAll("li[data-message-id]")].filter(shown);
  return {
    visible: window.visualViewport.height,
    field: rect(field),
    focused: field !== null && document.activeElement === field,
    last: rect(rows.at(-1)),
    lastWords: rows.at(-1)?.textContent ?? null,
    tabs: rect([...document.querySelectorAll('[role="tablist"]')].find(shown) ?? null),
    // The bars for moving between places, by what they are: the app's tabs, Frontier's places, Blitz's tabs and actions.
    bars: [...document.querySelectorAll('[data-band="tabs"], nav[aria-label="Places"], nav[aria-label="HUD tabs"], nav[aria-label="Structure actions"]')].filter(shown).length,
  };
})()`;
const pressChatPlace = (selector) => `(() => {
  const place = [...document.querySelectorAll(${JSON.stringify(selector)})].find((button) => button.textContent.includes("Chat"));
  if (!place) return false;
  place.click();
  return true;
})()`;

/** Frontier's Withdraw sheet, its amount typed with the keyboard open: upright on a phone, and held sideways. */
const SHEET_PAGES = [
  { name: "upright", viewport: ["390", "844"], keyboard: KEYBOARD_PX },
  { name: "sideways", viewport: ["844", "390"], keyboard: 200 },
];
const SHEET_FIELD = ".ui-sheet input";
/** The open sheet as the player sees it: its box, its amount field, its confirm, and what is left of the screen. */
const SHEET_VIEW = `(() => {
  const rect = (element) => (element ? JSON.parse(JSON.stringify(element.getBoundingClientRect())) : null);
  const sheet = document.querySelector(".ui-sheet");
  const field = sheet?.querySelector("input") ?? null;
  return {
    visible: window.visualViewport.height,
    sheet: rect(sheet),
    field: rect(field),
    focused: field !== null && document.activeElement === field,
    confirm: rect(sheet?.querySelector('button[type="submit"]') ?? null),
  };
})()`;
const onScreen = (box, visible) => box !== null && box.top >= 0 && box.bottom <= visible && box.height > 0;

const proveSheetKeyboard = async (b, out, record, page) => {
  const closed = b.evaluate(SHEET_VIEW);
  const press = clickAsPlayer(b, SHEET_FIELD);
  record.presses.push({ press: "the amount", status: press === null ? "led" : press });
  b.evaluate(`window.__keyboard(${page.keyboard})`);
  await sleep(500);
  b.run("type", SHEET_FIELD, "100");
  await sleep(300);
  const open = b.evaluate(SHEET_VIEW);
  // The confirm as a player reaches it: the sheet's body scrolled to it, as a finger scrolls it.
  b.evaluate(
    `(() => { document.querySelector('.ui-sheet button[type="submit"]')?.scrollIntoView({ block: "nearest" }); return true; })()`,
  );
  await sleep(200);
  open.confirm = b.evaluate(SHEET_VIEW).confirm;
  record.measures = { closed, open };
  record.checks.push(
    {
      check: "the amount field stands whole above the keyboard, still focused",
      ok: onScreen(open.field, open.visible) && open.focused,
    },
    {
      check: "the confirm is in reach: scrolled to in the sheet, whole above the keyboard",
      ok: onScreen(open.confirm, open.visible),
    },
    { check: "the sheet ends above the keyboard, its top on screen", ok: onScreen(open.sheet, open.visible) },
  );
  b.run("screenshot", join(out, `keyboard-withdraw-${page.name}.png`));
  b.evaluate("window.__keyboard(0)");
  await sleep(500);
  const after = b.evaluate(SHEET_VIEW);
  record.measures.after = after;
  record.checks.push({
    check: "the keyboard closed, the sheet stands where it stood",
    ok: after.sheet !== null && closed.sheet !== null && Math.abs(after.sheet.bottom - closed.sheet.bottom) <= 1,
  });
};

/** One phone chat with the keyboard: open it, focus the field, open the keyboard, send a message; then close it. */
const proveKeyboard = async (b, out, record, page) => {
  if (page.open) {
    record.presses.push({ press: "Chat", status: b.evaluate(pressChatPlace(page.open)) ? "led" : "missing" });
    await waitFor(b, `document.querySelector(${JSON.stringify(FIELD)}) !== null`, READY_MS);
    await sleep(800);
  }
  const press = clickAsPlayer(b, FIELD);
  record.presses.push({ press: "the field", status: press === null ? "led" : press });
  b.evaluate(`window.__keyboard(${KEYBOARD_PX})`);
  await sleep(500);
  const words = `hold the ${page.name} gate`;
  b.run("type", FIELD, words);
  b.run("press", "Enter");
  await sleep(800);
  const open = b.evaluate(KEYBOARD_VIEW);
  record.measures = { open };
  record.checks.push(
    {
      check: "the field stands whole above the keyboard, still focused",
      ok: open.field !== null && open.field.top >= 0 && open.field.bottom <= open.visible && open.focused,
    },
    {
      check: "the message sent shows above the field, above the keyboard",
      ok:
        open.last !== null &&
        open.field !== null &&
        open.lastWords?.includes(words) === true &&
        open.last.top >= 0 &&
        open.last.bottom <= open.visible &&
        open.last.bottom <= open.field.top + 1,
    },
    { check: "the chat's tabs stay on screen above it", ok: open.tabs !== null && open.tabs.top >= 0 },
    { check: "the bars for moving between places step aside", ok: open.bars === 0 },
  );
  b.run("screenshot", join(out, `keyboard-${page.name}.png`));
  b.evaluate("window.__keyboard(0)");
  await sleep(500);
  const closed = b.evaluate(KEYBOARD_VIEW);
  record.measures.closed = closed;
  record.checks.push({
    check: "the keyboard closed, the bars are back and the field at the foot again",
    ok: closed.bars > 0 && closed.field !== null && closed.field.bottom > open.field.bottom,
  });
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const baseUrl = (process.argv[2] ?? "https://127.0.0.1:4176").replace(/\/$/, "");
  const keyboardOnly = process.argv[4] === "keyboard";
  if (!keyboardOnly)
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

        for (const [viewport, phone] of [
          [["1440", "900"], false],
          [["390", "844"], true],
        ]) {
          const places = { state: `places, ${viewport.join("×")}`, ready: false, presses: [], checks: [] };
          records.push(places);
          places.ready = await open(b, `${baseUrl}/lab/kit/chat?state=open`, viewport);
          if (places.ready) await provePlaces(b, out, places, phone);
        }

        for (const [viewport, phone] of [
          [["1440", "900"], false],
          [["390", "844"], true],
        ]) {
          const card = { state: `player card, ${viewport.join("×")}`, ready: false, presses: [], checks: [] };
          records.push(card);
          card.ready = await open(b, `${baseUrl}/lab/kit/chat?state=open`, viewport);
          if (card.ready) await proveCard(b, out, card, phone);
        }

        const strip = { state: "closed, 1440×900", ready: false, presses: [], checks: [] };
        records.push(strip);
        strip.ready = await open(b, `${baseUrl}/lab/kit/chat?state=closed`, ["1440", "900"]);
        if (strip.ready) {
          strip.measures = b.evaluate(STRIP);
          strip.checks.push(...stripChecks(strip.measures));
          b.run("screenshot", join(out, "chat-strip.png"));
        }

        for (const viewport of [
          ["1440", "900"],
          ["390", "844"],
        ]) {
          await proveOpening(b, out, records, baseUrl, viewport);
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

        const appPane = { state: "app, Chat pane, 1440×900", ready: false, presses: [], checks: [] };
        records.push(appPane);
        appPane.ready = await openApp(
          b,
          `${baseUrl}/lab/app/home?capture=1`,
          ["1440", "900"],
          `document.querySelector('${APP_CHAT_PLACE}') !== null`,
        );
        if (appPane.ready) await proveAppPane(b, out, appPane);

        const phonePage = { state: "app, Chat page, 390×844", ready: false, presses: [], checks: [] };
        records.push(phonePage);
        phonePage.ready = await openApp(
          b,
          `${baseUrl}/lab/app/home/chat?capture=1`,
          ["390", "844"],
          `document.querySelector('[data-band="body"] input[aria-label="Message"]') !== null`,
        );
        if (phonePage.ready) await proveAppPhonePage(b, out, phonePage);

        // The same page, its window grown to a desktop's: the page stays Chat's, one chat.
        const grown = { state: "app, Chat page, 390×844 grown to 1440×900", ready: false, presses: [], checks: [] };
        records.push(grown);
        if (phonePage.ready) {
          b.run("set", "viewport", "1440", "900");
          grown.ready = await waitFor(b, `document.querySelector('[data-band="bar"]') !== null`, READY_MS);
          await sleep(SETTLE_MS);
          if (grown.ready) proveDesktopChatPage(b, out, grown, "app-chat-page-grown-desktop.png");
        }

        const desktopPage = { state: "app, Chat page, 1440×900", ready: false, presses: [], checks: [] };
        records.push(desktopPage);
        desktopPage.ready = await openApp(
          b,
          `${baseUrl}/lab/app/home/chat?capture=1`,
          ["1440", "900"],
          `document.querySelector('[data-band="body"] input[aria-label="Message"]') !== null`,
        );
        if (desktopPage.ready) proveDesktopChatPage(b, out, desktopPage, "app-chat-page-desktop.png");

        for (const [viewport, phone] of [
          [["1440", "900"], false],
          [["390", "844"], true],
        ]) {
          const lobby = {
            state: `app, Blitz lobby chat, ${viewport.join("×")}`,
            ready: false,
            presses: [],
            checks: [],
          };
          records.push(lobby);
          lobby.ready = await openApp(
            b,
            `${baseUrl}${LOBBY}`,
            viewport,
            `document.querySelector('section[aria-label="Chat"] li[data-message-id]') !== null`,
          );
          if (lobby.ready) await proveLobbyChat(b, out, lobby, phone);
        }

        const frontier = { state: "Frontier phone, Chat page, 390×844", ready: false, presses: [], checks: [] };
        records.push(frontier);
        frontier.ready = await openApp(
          b,
          `${baseUrl}/lab/kit/hud/chat?capture=1`,
          ["390", "844"],
          `document.querySelector("[data-page-fills]") !== null`,
        );
        if (frontier.ready) {
          frontier.measures = b.evaluate(FRONTIER_PAGE);
          frontier.checks.push(...frontierPageChecks(frontier.measures));
          b.run("screenshot", join(out, "frontier-chat-page-phone.png"));
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

  // The keyboard's records, in a session of their own: its stand-in for the visual viewport touches no other record.
  const before = process.exitCode;
  process.env.AGENT_BROWSER_INIT_SCRIPTS = KEYBOARD_SCRIPT;
  await runProof(
    {
      parent: resolve(process.argv[3] ?? ".context/hud-chat"),
      name: "hud-chat-keyboard",
      baseUrl,
      where: (record) => ({ state: record.state }),
    },
    async (b, out, records) => {
      for (const page of KEYBOARD_PAGES) {
        const record = { state: `keyboard, ${page.name}, 390×844`, ready: false, presses: [], checks: [] };
        records.push(record);
        record.ready = await openApp(
          b,
          `${baseUrl}${page.path}`,
          ["390", "844"],
          "typeof window.__keyboard === 'function'",
        );
        if (record.ready) await proveKeyboard(b, out, record, page);
      }
      for (const page of SHEET_PAGES) {
        const record = {
          state: `keyboard, Withdraw sheet, ${page.name}, ${page.viewport.join("×")}`,
          ready: false,
          presses: [],
          checks: [],
        };
        records.push(record);
        record.ready = await openApp(
          b,
          `${baseUrl}/lab/kit/hud/withdraw?capture=1`,
          page.viewport,
          `typeof window.__keyboard === 'function' && document.querySelector(${JSON.stringify(SHEET_FIELD)}) !== null`,
        );
        if (record.ready) await proveSheetKeyboard(b, out, record, page);
      }
    },
  );
  if (before) process.exitCode = before;
}
