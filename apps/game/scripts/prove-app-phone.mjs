/**
 * `prove:app <base-url> <out-dir> phone`: every surface that had a Back link or a row arrow, as a phone plays it
 * (the owner, 2 November 2026: "test the Back fixes on mobile as well"). 390×844 with a phone's touch, and an iPhone's
 * safe area through DevTools (a 47 px notch, a 34 px home indicator), so `env(safe-area-inset-*)` holds what a phone
 * gives. Each surface is shot, and checked: no Back control, nothing seen standing in the notch or over the home
 * indicator, and where it applies:
 *
 * - a page: the system back (Android's gesture, iOS's edge swipe: the history's back) leaves it for the page before;
 * - a sheet: a finger's drag down its head closes it; opened again, the system back closes it once and the page stays,
 *   and the next back leaves the page;
 * - the inline Name: a tap opens the field with the focus; with the on-screen keyboard up the field and Claim name stand
 *   above it and the place bar steps aside; a tap beside the row puts it back;
 * - Frontier's Season board: every realm on it, the player's own row waiting at the foot of its scroll and a tap there
 *   bringing its place to the middle, its prizes folded in one line that a tap opens and folds, more of the board in
 *   sight than the podium left, and after a flick to the board's end the columns' names still on top;
 * - Frontier's Chat while typing, under the owner's keyboard (533 px: his phone leaves 311 px above it): its rooms' tabs
 *   in the head row beside its cross, a pinch-zoom with nothing typed taken for no keyboard, the strip and the place bar
 *   stepped aside while typing, the field above the keyboard and the history in sight, and the strip back once the
 *   keyboard goes.
 *
 * Headless Chrome draws no on-screen keyboard: it is played as the page meets one, its visual viewport shortened by a
 * phone keyboard's 336 px and resized (use-keyboard-inset.ts reads it from there). Taps and drags are DevTools touch
 * events, which the page receives as touch pointers, as from a finger.
 */
import { join } from "node:path";

import { openPageDevTools } from "./client-playtest/browser-session.mjs";
import { sleep, waitFor } from "./prove-run.mjs";

const PHONE = ["390", "844"];
const SAFE_AREA = { top: 47, bottom: 34 };
const KEYBOARD_PX = 336;
/** The owner's phone: Brave's bars and SwiftKey with its suggestion and autofill rows leave 311 px of the page's 844. */
const OWNER_KEYBOARD_PX = 533;
const READY_MS = 30_000;
const SETTLE_MS = 2_000;
const DRAWN = `document.querySelector("[data-layout], [data-kit-frame], .ui-panel, .ui-menu, [data-lab]") !== null`;

const app = (screen, page) => `/lab/app/${screen}/${page}?capture=1`;

/**
 * The surfaces, each with the page before it (where the system back leaves to), how it is opened (presses by a
 * control's words or label) and opened again after a drag closed it (`reopen`, else the same presses), what shows it
 * drawn (`ready`), and its kind: a page, a sheet (with what its head is), a view in a page or sheet, or the inline Name.
 */
const SURFACES = [
  {
    name: "settings",
    kind: "page",
    before: app("wallet-ready", "season"),
    path: app("wallet-ready", "profile/settings"),
  },
  { name: "you", kind: "page", before: app("home", "season"), path: app("home", "profile") },
  { name: "whats-new", kind: "page", before: app("home", "profile"), path: app("home", "scroll") },
  { name: "terms", kind: "page", before: app("home", "scroll"), path: app("home", "terms") },
  { name: "player", kind: "page", before: app("season-running", "season"), path: app("season-running", "p/0xb001") },
  { name: "lobby", kind: "page", before: app("entry-choose", ""), path: app("entry-choose", "blitz/slot-blitz-1630") },
  { name: "build-orders", kind: "page", before: app("home", ""), path: app("home", "blitz/build-orders") },
  { name: "devcon", kind: "page", before: app("devcon-flyer", ""), path: app("devcon-flyer", "join/devcon/LAB-CODE") },
  {
    name: "settings-portrait",
    kind: "sheet",
    head: '[role="dialog"] header',
    before: app("wallet-ready", "season"),
    path: app("wallet-ready", "profile/settings"),
    open: ["Portrait"],
  },
  {
    name: "settings-payout",
    kind: "sheet",
    head: '[role="dialog"] header',
    before: app("wallet-ready", "season"),
    path: app("wallet-ready", "profile/settings"),
    open: ["Payout wallet"],
  },
  {
    name: "wallet-picker",
    kind: "sheet",
    head: '[role="dialog"] header',
    before: app("wallet-none", "season"),
    path: app("wallet-none", "profile/settings"),
    open: ["Payout wallet", "I have a wallet"],
  },
  {
    name: "build-orders-editor",
    kind: "sheet",
    head: '[role="dialog"] header',
    before: app("home", ""),
    path: app("home", "blitz/build-orders"),
    open: ["Edit"],
  },
  {
    name: "hud-season-detail",
    kind: "sheet",
    head: "[data-kit-sheet] .ui-frame__head",
    before: "/lab/kit/hud/idle?capture=1",
    path: "/lab/kit/hud/season-detail?capture=1",
    reopen: ["#2 Aldric"],
    // The detail stands on the HUD's Season page, which the next back closes in the game; the lab keeps it standing.
    under: "page",
  },
  {
    name: "kit-sheet",
    kind: "sheet",
    head: '[data-kit-sheet] button[aria-label="Close"]',
    before: "/lab/kit/hud/idle?capture=1",
    path: "/lab/kit/shell?capture=1",
    ready: "document.querySelector('button') !== null",
    open: ["Menu"],
  },
  { name: "hud-menu", kind: "view", path: "/lab/kit/hud/value-menu?capture=1" },
  { name: "army-level-up", kind: "view", path: "/lab/kit/progression?part=army&realm=mid&capture=1" },
  // A touch-first device draws no keys at all: Settings holds no row for them there.
  {
    name: "keyboard-shortcuts",
    kind: "absent",
    path: "/lab/kit/windows/settings?capture=1",
    ready: "document.querySelector('button') !== null",
    absent: `![...document.querySelectorAll(".ui-setting__name")].some((name) => name.textContent === "Keyboard shortcuts")`,
  },
  { name: "visit-leave", kind: "view", path: "/lab/kit/hud/visiting?capture=1" },
  {
    name: "chat-conversation",
    kind: "view",
    path: "/lab/kit/hud/chat?view=conversation&capture=1",
    back: { press: "Messages", shows: `document.querySelectorAll(".ui-row").length > 1` },
  },
  { name: "settings-name", kind: "name", path: app("wallet-ready", "profile/settings") },
  // A player in an Eternum game's standings, from a tribe's members. A phone's window shows the detail in the list's
  // place, so the card has no tribe row beside it and no Back: the lit Tribes tab pressed again steps back to the
  // tribe's members (social-board.tsx's pressTab), and a member opens again from there.
  {
    name: "standings-tribe",
    kind: "flow",
    path: "/lab/kit/standings?capture=1",
    ready: "document.querySelector('[role=tab]') !== null",
    steps: [
      { press: "Tribes" },
      { press: "Ironwood: its members", shows: "members", still: "members" },
      { press: "Lord 0333", shows: "player", still: "player" },
      { press: "Tribes", shows: "members", still: "members-again" },
      { press: "Lord 0444", shows: "player", still: "player-again" },
    ],
  },
  // A player in a Blitz game's standings, whose one tab is Players: the tab still shows, lit, and is the card's way back
  // to the list, as Tribes is in Eternum's.
  {
    name: "standings-blitz",
    kind: "flow",
    path: "/lab/kit/standings?mode=blitz&capture=1",
    ready: "document.querySelector('[data-player-address]') !== null",
    steps: [
      { press: "Lord 0333: their points", shows: "player", still: "player" },
      { press: "Players", shows: "players", still: "players-again" },
      { press: "Lord 0444: their points", shows: "player", still: "player-again" },
    ],
  },
  // Last: the doorway boots the map behind it, which keeps the tab busy for whatever opens next.
  { name: "doorway", kind: "page", before: app("home", ""), path: app("home", "doorway/map") },
  { name: "season-board", kind: "season", path: "/lab/kit/hud/season?capture=1" },
  { name: "chat-typing", kind: "chat-typing", path: "/lab/kit/hud/chat?capture=1" },
];

/** A control by its words (first line) or its label, marked for a measured tap; whether one was found. */
const markControl = (words) => `(() => {
  document.querySelector("[data-phone-tap]")?.removeAttribute("data-phone-tap");
  const control = [...document.querySelectorAll("button, a, [role=tab]")].find((each) =>
    each.innerText.trim().split("\\n")[0].trim() === ${JSON.stringify(words)} || each.getAttribute("aria-label") === ${JSON.stringify(words)});
  control?.setAttribute("data-phone-tap", "");
  return control !== undefined;
})()`;

/** The centre of what `selector` finds, scrolled into view first; null when nothing is found. */
const centreOf = (selector) => `(() => {
  const element = document.querySelector(${JSON.stringify(selector)});
  if (!element) return null;
  element.scrollIntoView({ block: "center" });
  const box = element.getBoundingClientRect();
  return { x: Math.round(box.left + box.width / 2), y: Math.round(box.top + box.height / 2) };
})()`;

/**
 * What the screen shows a player now: any Back control, every control seen (its centre hit-tests to it) with its box,
 * and the open sheet, if any.
 */
const SEEN = `(() => {
  const fixedLayer = (element) => {
    for (let node = element; node; node = node.parentElement) if (["fixed", "sticky"].includes(getComputedStyle(node).position)) return true;
    return false;
  };
  const seen = [...document.querySelectorAll("button, a[href], input, [role=tab]")].flatMap((control) => {
    if (control.closest('[aria-hidden="true"]')) return [];
    const box = control.getBoundingClientRect();
    if (box.width === 0 || box.height === 0 || box.bottom <= 0 || box.top >= innerHeight) return [];
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    if (!hit || !(control === hit || control.contains(hit))) return [];
    const words = (control.getAttribute("aria-label") ?? control.innerText ?? "").trim().split("\\n")[0].slice(0, 40);
    return [{ words, centre: Math.round(box.top + box.height / 2), fixed: fixedLayer(control) }];
  });
  return {
    back: document.querySelectorAll('[data-role="back"], button[aria-label="Back"]').length,
    seen,
    sheet: document.querySelector('[role="dialog"], [data-kit-sheet]') !== null,
    path: location.pathname,
    height: innerHeight,
  };
})()`;

/**
 * The checks every surface takes: no Back, and nothing a finger aims at (a control's centre) in the notch or over the
 * home indicator on a layer that stays put there (fixed or sticky); a page's own content scrolls past them, as on a
 * phone.
 */
const restChecks = (shown) => {
  const inInsets = shown.seen.filter(
    (control) => control.fixed && (control.centre < SAFE_AREA.top || control.centre > shown.height - SAFE_AREA.bottom),
  );
  return [
    { check: "no Back control", ok: shown.back === 0 },
    { check: "nothing seen in the notch or over the home indicator", ok: inInsets.length === 0, inInsets },
  ];
};

/** A DevTools connection to the session's page: a phone's safe area, taps and drags as touch. */
const phoneDevTools = async (b) => {
  const devTools = await openPageDevTools({ run: (args) => b.run(...args) });
  const insets = { top: SAFE_AREA.top, bottom: SAFE_AREA.bottom, left: 0, right: 0 };
  await devTools.send("Emulation.setSafeAreaInsetsOverride", {
    insets: { ...insets, topMax: insets.top, bottomMax: insets.bottom, leftMax: 0, rightMax: 0 },
  });
  const touch = (type, x, y) =>
    devTools.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
  return {
    close: () => devTools.close(),
    tap: async ({ x, y }) => {
      await touch("touchStart", x, y);
      await touch("touchEnd", x, y);
    },
    /** A finger's drag straight down from `from`, `by` pixels, in steps as a finger moves. */
    dragDown: async ({ x, y }, by) => {
      await touch("touchStart", x, y);
      for (let step = 1; step <= 6; step += 1) await touch("touchMove", x, y + Math.round((by * step) / 6));
      await touch("touchEnd", x, y + by);
    },
  };
};

/** Taps a control by its words, as a finger does; whether it was there. */
const tapControl = async (b, phone, words) => {
  if (!b.evaluate(markControl(words))) return false;
  const centre = b.evaluate(centreOf("[data-phone-tap]"));
  await phone.tap(centre);
  await sleep(900);
  return true;
};

/** The system back: Android's back gesture and iOS's edge swipe both step the history back. */
const systemBack = async (b) => {
  b.evaluate("(history.back(), true)");
  await sleep(1_200);
};

const shoot = (b, out, name) => b.run("screenshot", join(out, `phone-${name}.png`));

const open = async (b, url, record, drawn = DRAWN) => {
  b.run("open", url, "--ignore-https-errors");
  const ready = await waitFor(b, drawn, READY_MS);
  if (!ready) record.ready = false;
  await sleep(SETTLE_MS);
  return ready;
};

/** Presses each of `words` in turn, recording each; whether all were there. */
const pressAll = async (b, phone, record, words = []) => {
  for (const each of words) {
    const there = await tapControl(b, phone, each);
    record.presses.push({ press: each, status: there ? "led" : "not on the page" });
    if (!there) return false;
  }
  return true;
};

const proveSurface = async (b, phone, out, baseUrl, surface) => {
  const record = { name: `phone-${surface.name}`, ready: true, presses: [], checks: [] };
  if (surface.before && !(await open(b, `${baseUrl}${surface.before}`, record))) return record;
  if (!(await open(b, `${baseUrl}${surface.path}`, record, surface.ready))) return record;
  if (!(await pressAll(b, phone, record, surface.open))) return record;
  shoot(b, out, surface.name);
  const shown = b.evaluate(SEEN);
  record.checks.push(...restChecks(shown));
  if (surface.kind === "page") await pagesBack(b, record, surface);
  if (surface.kind === "sheet") await sheetsGestures(b, phone, out, record, surface);
  if (surface.kind === "view" && surface.back) await viewsWayBack(b, phone, record, surface);
  if (surface.kind === "name") await nameWithKeyboard(b, phone, out, record);
  if (surface.kind === "flow") await flowSteps(b, phone, out, record, surface);
  if (surface.kind === "season") await seasonBoard(b, phone, out, record);
  if (surface.kind === "chat-typing") await chatTyping(b, phone, out, record);
  if (surface.kind === "absent")
    record.checks.push({ check: "not drawn on a touch device", ok: b.evaluate(surface.absent) });
  return record;
};

/** A page: the system back leaves it for the page before. */
const pagesBack = async (b, record, surface) => {
  await systemBack(b);
  const after = b.evaluate("location.pathname");
  record.checks.push({
    check: "the system back leaves the page for the page before",
    ok: after === surface.before.split("?")[0],
    after,
  });
};

/** A sheet: a drag down its head closes it; opened again, the system back closes it once, then leaves the page. */
const sheetsGestures = async (b, phone, out, record, surface) => {
  const head = b.evaluate(centreOf(surface.head));
  if (!head) {
    record.checks.push({ check: "the sheet's head is there to drag", ok: false });
    return;
  }
  await phone.dragDown(head, 150);
  await sleep(1_200);
  const dragged = b.evaluate(SEEN);
  record.checks.push({ check: "a finger's drag down its head closes it", ok: !dragged.sheet });
  await pressAll(b, phone, record, surface.reopen ?? surface.open);
  const page = b.evaluate("location.pathname");
  await systemBack(b);
  const backed = b.evaluate(SEEN);
  record.checks.push({
    check: "the system back closes the sheet once, the page staying",
    ok: !backed.sheet && backed.path === page,
    backed: { sheet: backed.sheet, path: backed.path },
  });
  if (surface.under === "page") {
    record.checks.push({
      check: "the Season page stands under it",
      ok: b.evaluate(`document.querySelector("[data-kit-frame]") !== null`),
    });
  } else {
    await systemBack(b);
    const left = b.evaluate("location.pathname");
    record.checks.push({
      check: "the next system back leaves the page",
      ok: left === surface.before.split("?")[0],
      left,
    });
  }
  shoot(b, out, `${surface.name}-after-back`);
};

const NO_CARD = `!document.querySelector('[aria-label="Player details"]')`;

/** What a flow's step must show, in words and as the page answers it. */
const SHOWS = {
  members: {
    words: "the tribe's members",
    test: `${NO_CARD} && [...document.querySelectorAll("button")].some((each) => each.innerText.trim() === "Lord 0333")`,
  },
  players: {
    words: "the players' list",
    test: `${NO_CARD} && document.querySelectorAll("[data-player-address]").length > 1`,
  },
  player: { words: "the player's card", test: `!${NO_CARD}` },
};

/** A flow's taps in turn, each as a finger presses it, then what it must show, and a still where it names one. */
const flowSteps = async (b, phone, out, record, surface) => {
  for (const step of surface.steps) {
    const there = await tapControl(b, phone, step.press);
    record.presses.push({ press: step.press, status: there ? "led" : "not on the page" });
    if (!there) return;
    if (step.shows)
      record.checks.push({
        check: `${step.press} shows ${SHOWS[step.shows].words}`,
        ok: b.evaluate(SHOWS[step.shows].test),
      });
    if (step.still) shoot(b, out, `${surface.name}-${step.still}`);
  }
};

/** A view's own way back, pressed as a finger presses it (chat: the lit Messages tab back to the list). */
const viewsWayBack = async (b, phone, record, surface) => {
  const there = await tapControl(b, phone, surface.back.press);
  record.presses.push({ press: surface.back.press, status: there ? "led" : "not on the page" });
  record.checks.push({ check: `${surface.back.press} leads back`, ok: there && b.evaluate(surface.back.shows) });
};

/** The on-screen keyboard as the page meets it: its visual viewport shortened by the keyboard and resized. */
const keyboardUp = (height) => `(() => {
  Object.defineProperty(visualViewport, "height", { configurable: true, get: () => ${height} });
  visualViewport.dispatchEvent(new Event("resize"));
  return document.documentElement.dataset.keyboard ?? null;
})()`;

/** A pinch-zoom as the page meets one: its visual viewport scaled up, showing that much less of the page. */
const zoomedIn = (scale) => `(() => {
  const height = innerHeight / ${scale};
  Object.defineProperty(visualViewport, "height", { configurable: true, get: () => height });
  Object.defineProperty(visualViewport, "scale", { configurable: true, get: () => ${scale} });
  visualViewport.dispatchEvent(new Event("resize"));
  return document.documentElement.dataset.keyboard ?? null;
})()`;

const ZOOM_OUT = `(() => {
  delete visualViewport.height;
  delete visualViewport.scale;
  visualViewport.dispatchEvent(new Event("resize"));
  return true;
})()`;

const KEYBOARD_DOWN = `(() => {
  delete visualViewport.height;
  visualViewport.dispatchEvent(new Event("resize"));
  return document.documentElement.dataset.keyboard ?? null;
})()`;

/** The inline Name: tapped open with the field's focus, typed above the keyboard, and put back by a tap beside it. */
const nameWithKeyboard = async (b, phone, out, record) => {
  const tapped = await tapControl(b, phone, "Name");
  record.presses.push({ press: "Name", status: tapped ? "led" : "not on the page" });
  if (!tapped) return;
  record.checks.push({
    check: "the tap opens the field with the focus",
    ok: b.evaluate(`document.activeElement?.matches("form input") ?? false`),
  });
  const shown = Number(PHONE[1]) - KEYBOARD_PX;
  const keyboard = b.evaluate(keyboardUp(shown));
  await sleep(600);
  const typing = b.evaluate(`(() => {
    const visible = (element) => { const box = element?.getBoundingClientRect(); return !!box && box.top >= ${SAFE_AREA.top} && box.bottom <= ${shown}; };
    const claim = [...document.querySelectorAll("form button")].find((each) => each.innerText.trim() === "Claim name");
    const bar = document.querySelector('[data-band="tabs"]');
    return { field: visible(document.querySelector("form input")), claim: visible(claim), barHidden: !bar || getComputedStyle(bar).display === "none" };
  })()`);
  record.checks.push(
    { check: "the on-screen keyboard is met", ok: keyboard === "open" },
    { check: "the field and Claim name stand above the keyboard", ok: typing.field && typing.claim, typing },
    { check: "the place bar steps aside while typing", ok: typing.barHidden },
  );
  shoot(b, out, "settings-name-keyboard");
  b.evaluate(KEYBOARD_DOWN);
  const beside = b.evaluate(centreOf("h1"));
  await phone.tap(beside ?? { x: 195, y: 70 });
  await sleep(600);
  record.checks.push({
    check: "a tap beside the row puts it back",
    ok: b.evaluate(`document.querySelector("form input") === null`),
  });
};

/** Rows of the board in sight under the podium's tiles before they folded: next at 466be253e5f, played by this proof. */
const ROWS_UNDER_TILES = 3;

/**
 * What the Season page shows: the board's rows wholly in sight inside its scroll (the player's own row too) and how
 * many it holds, the folded prizes' line and whether it is open, the podium's tiles, whether the columns' names stand
 * at the top of the scroll, and where the player's own row stands: at the scroll's foot, or in its middle.
 */
const SEASON_SEEN = `(() => {
  const page = document.querySelector('section[aria-label="Season"]');
  const scroll = page?.querySelector(".overflow-y-auto");
  const box = scroll?.getBoundingClientRect();
  const whole = (element) => {
    const r = element.getBoundingClientRect();
    const own = element.closest(".overflow-y-auto")?.getBoundingClientRect() ?? { top: 0, bottom: innerHeight };
    return r.height > 0 && r.top >= own.top - 0.5 && r.bottom <= Math.min(own.bottom, innerHeight) + 0.5;
  };
  const rows = [...(page?.querySelectorAll(".ui-table-row") ?? [])].filter(whole).length;
  const line = page?.querySelector('button[aria-label="Season prizes"]');
  const head = scroll?.querySelector(".ui-table-head");
  const own = scroll?.querySelector(".ui-table-row[data-own]")?.getBoundingClientRect();
  return {
    rows,
    total: page?.querySelectorAll(".ui-table-row").length ?? 0,
    own: own && {
      atFoot: Math.abs(own.bottom - box.bottom) < 1.5,
      middle: Math.abs((own.top + own.bottom) / 2 - (box.top + box.bottom) / 2) < own.height,
      centre: { x: Math.round(own.left + own.width / 2), y: Math.round(own.top + own.height / 2) },
    },
    line: line ? { open: line.getAttribute("aria-expanded") === "true", height: Math.round(line.getBoundingClientRect().height) } : null,
    tiles: page?.querySelectorAll('ol[aria-label="Season prizes"] li[data-place]').length ?? 0,
    headOnTop: head ? Math.abs(head.getBoundingClientRect().top - box.top) < 1 : false,
  };
})()`;

/** Every realm of the HUD lab's season (hud-lab.tsx: eleven rivals, the player twelfth, 75 more). */
const SEASON_REALMS = 87;

/**
 * Frontier's Season board on a phone: every realm on it, the player's own row waiting at the foot and a tap there
 * bringing its place to the middle; the prizes folded, opened and folded by a tap, then the board flicked to its end.
 */
const seasonBoard = async (b, phone, out, record) => {
  const rest = b.evaluate(SEASON_SEEN);
  record.checks.push(
    {
      check: `every realm stands on the board (${SEASON_REALMS})`,
      ok: rest.total === SEASON_REALMS,
      total: rest.total,
    },
    {
      check: "the player's own row waits at the foot of the board's scroll",
      ok: rest.own?.atFoot === true,
      own: rest.own,
    },
  );
  shoot(b, out, "season-board-own-at-foot");
  if (rest.own) await phone.tap(rest.own.centre);
  await sleep(900);
  const found = b.evaluate(SEASON_SEEN);
  record.checks.push({
    check: "a tap on it there brings its place to the middle of the scroll, no detail opened",
    ok: found.own?.middle === true && found.own.atFoot === false && found.total === SEASON_REALMS,
    own: found.own,
  });
  shoot(b, out, "season-board-own-found");
  b.evaluate(
    `(() => { document.querySelector('section[aria-label="Season"] .overflow-y-auto').scrollTop = 0; return true; })()`,
  );
  await sleep(600);
  record.checks.push(
    {
      check: "the prizes stand folded in one line",
      ok: rest.line?.open === false && rest.line.height <= 56 && rest.tiles === 0,
      rest,
    },
    {
      check: `more of the board in sight than the tiles left (${ROWS_UNDER_TILES} rows)`,
      ok: rest.rows > ROWS_UNDER_TILES,
      rows: rest.rows,
    },
  );
  const opened = (await tapControl(b, phone, "Season prizes")) && b.evaluate(SEASON_SEEN);
  record.checks.push({
    check: "a tap on the line opens the podium's three tiles",
    ok: opened?.line?.open === true && opened.tiles === 3,
    opened,
  });
  shoot(b, out, "season-board-opened");
  const folded = (await tapControl(b, phone, "Season prizes")) && b.evaluate(SEASON_SEEN);
  record.checks.push({ check: "another tap folds it again", ok: folded?.line?.open === false && folded.tiles === 0 });
  b.evaluate(
    `(() => { const s = document.querySelector('section[aria-label="Season"] .overflow-y-auto'); s.scrollTop = s.scrollHeight; return true; })()`,
  );
  await sleep(600);
  const flicked = b.evaluate(SEASON_SEEN);
  record.checks.push(
    { check: "flicked to the board's end, the columns' names stay on top", ok: flicked.headOnTop, flicked },
    {
      check: "and the board has the page: more rows in sight than at rest",
      ok: flicked.rows > rest.rows,
      rows: flicked.rows,
    },
  );
  shoot(b, out, "season-board-flicked");
};

/** What Chat shows while typing: its head row's tabs and cross, the strip and place bar, the field and the history. */
const chatSeen = (floor) => `(() => {
  const page = document.querySelector('section[aria-label="Chat"]');
  const head = page?.querySelector(".ui-frame__head");
  const gone = (element) => {
    if (!element || element.getBoundingClientRect().height === 0) return true;
    for (let part = element; part; part = part.parentElement) if (getComputedStyle(part).display === "none") return true;
    return false;
  };
  const field = page?.querySelector("textarea, input");
  const fieldBox = field?.getBoundingClientRect();
  const history = page?.querySelector("ul.mt-auto")?.closest(".overflow-y-auto")?.getBoundingClientRect();
  return {
    headTabs: head ? head.querySelectorAll('[role="tab"]').length : 0,
    headClose: Boolean(head?.querySelector('button[aria-label="Close"]')),
    stripGone: gone(document.querySelector("[data-hud-top]")),
    barGone: gone(document.querySelector('nav[aria-label="Places"]')),
    field: Boolean(fieldBox && fieldBox.height > 0 && fieldBox.bottom <= ${floor} + 0.5),
    historyPx: history ? Math.max(0, Math.round(Math.min(history.bottom, ${floor}) - Math.max(history.top, 0))) : 0,
  };
})()`;

/**
 * History in sight while typing under the owner's keyboard and this proof's notch: next at 466be253e5f left none (as the
 * owner's screenshot shows); with the strip aside and the tabs in the head row, 119 px, two or three lines.
 */
const HISTORY_TYPING_PX = 100;

/** Frontier's Chat on a phone: read, then typed in under the owner's keyboard, then read again once it goes. */
const chatTyping = async (b, phone, out, record) => {
  const reading = b.evaluate(chatSeen(Number(PHONE[1])));
  record.checks.push({
    check: "the rooms' tabs stand in the head row beside its cross",
    ok: reading.headTabs >= 2 && reading.headClose,
    reading,
  });
  // A pinch-zoom shows less of the page too, with nothing typed: no keyboard, and the strip stays.
  const zoomed = b.evaluate(zoomedIn(2));
  await sleep(400);
  const zoomRead = b.evaluate(chatSeen(Number(PHONE[1])));
  b.evaluate(ZOOM_OUT);
  await sleep(400);
  record.checks.push({
    check: "a pinch-zoom with nothing typed is no keyboard: the strip stays",
    ok: zoomed === null && !zoomRead.stripGone,
    zoomed,
  });
  const field = b.evaluate(centreOf('section[aria-label="Chat"] textarea, section[aria-label="Chat"] input'));
  if (field) await phone.tap(field);
  const floor = Number(PHONE[1]) - OWNER_KEYBOARD_PX;
  const keyboard = b.evaluate(keyboardUp(floor));
  await sleep(800);
  const typing = b.evaluate(chatSeen(floor));
  record.checks.push(
    { check: "the owner's keyboard is met", ok: keyboard === "open" },
    { check: "the strip and the place bar step aside while typing", ok: typing.stripGone && typing.barGone, typing },
    { check: "the field stands above the keyboard", ok: typing.field },
    {
      check: `at least ${HISTORY_TYPING_PX} px of history in sight above it`,
      ok: typing.historyPx >= HISTORY_TYPING_PX,
      historyPx: typing.historyPx,
    },
  );
  shoot(b, out, "chat-typing-keyboard");
  b.evaluate(KEYBOARD_DOWN);
  await sleep(600);
  record.checks.push({
    check: "the strip is back once the keyboard goes",
    ok: !b.evaluate(chatSeen(Number(PHONE[1]))).stripGone,
  });
};

/** One surface's record, its own failure kept in it rather than ending the run. */
const proveOne = async (b, phone, out, baseUrl, surface) => {
  try {
    return await proveSurface(b, phone, out, baseUrl, surface);
  } catch (error) {
    return { name: `phone-${surface.name}`, ready: false, presses: [], error: String(error.message ?? error) };
  }
};

/** Every surface, played as a phone. */
export const phoneRecords = async (b, baseUrl, out) => {
  b.run("set", "viewport", ...PHONE);
  // DevTools attaches to the page the session shows: one is opened first, and the tab keeps it from page to page.
  b.run("open", `${baseUrl}${app("home", "")}`, "--ignore-https-errors");
  await waitFor(b, DRAWN, READY_MS);
  const phone = await phoneDevTools(b);
  const records = [];
  try {
    for (const surface of SURFACES) records.push(await proveOne(b, phone, out, baseUrl, surface));
  } finally {
    phone.close();
  }
  return records;
};
