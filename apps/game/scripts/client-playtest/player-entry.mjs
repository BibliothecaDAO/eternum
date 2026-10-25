import { existsSync, readFileSync, rmSync } from "node:fs";

/**
 * How a player gets into the steps' game: signed in through Connect as a player is (the bar's Connect, their email,
 * Send code, the code from the mail), then through the home page's card, with the browser's own click on its call to
 * action.
 */

const POLL_MS = 500;
const PAGE_WAIT_MS = 30_000;
// The day's summary shows as the game's HUD mounts, or not at all.
const DAY_SUMMARY_WAIT_MS = 3_000;
// A sign-in code stops working ten minutes after it is sent.
const SIGN_IN_CODE_WAIT_MS = 10 * 60_000;
const EMAIL_FIELD = 'input[type="email"]';
const CODE_FIELD = 'input[autocomplete="one-time-code"]';
const ENTRY_BUTTON = "[data-playtest-entry]";

/**
 * Signs the profile in from the home page, which shows the session in its bar: a signed-in player's place shows them,
 * a signed-out one's reads Connect, which opens the Connect window and its email field. The runner reads no mail: it
 * asks for the code on stderr and waits for whoever runs it to write the code to `codeFile`. Returns "kept" or
 * "signed in"; the home page is to be opened again after.
 */
export async function signInIfSignedOut({ browser, owner, email, baseUrl, codeFile }) {
  browser.run(["open", new URL("/", baseUrl).href]);
  const before = await signInState(browser, owner, email, ["signed-in", "signed-out"]);
  if (before === "signed-in") return "kept";
  browser.run(["click", CONNECT_PLACE]);
  await waitUntil(owner, () => browser.read(isShown(EMAIL_FIELD)), "Connect opened no email field");
  browser.run(["fill", EMAIL_FIELD, email]);
  browser.click("Send code");
  await waitUntil(owner, () => browser.read(isShown(CODE_FIELD)), `no code field after sending a code to ${email}`);
  browser.run(["type", CODE_FIELD, await waitForSignInCode(owner, email, codeFile)]);
  await signInState(browser, owner, email, ["signed-in"]);
  return "signed in";
}

/**
 * Waits for the home page to answer with one of `awaited`: its bar shows the signed-in player, or Connect. A test
 * account is never set up by a run: one Connect asks to claim a name is refused.
 */
async function signInState(browser, owner, email, awaited) {
  let state = null;
  const answered = () => (state = browser.read(SIGN_IN_STATE)) === "claim-name" || awaited.includes(state);
  await waitUntil(owner, answered, `the home page gave ${email} none of ${awaited.join(", ")}`);
  if (state === "claim-name") throw new Error(`${email} has no name: Connect asks to claim one, not a test account`);
  return state;
}

/** The bar's Connect: the You place while no one is signed in (src/shell/frame/tabs.tsx). */
const CONNECT_PLACE = 'button[data-role="tab"]';

const SIGN_IN_STATE = `JSON.stringify(
  [...document.querySelectorAll("button")].some((button) => button.textContent.trim() === "Claim name")
    ? "claim-name"
    : document.querySelector('[data-role="tab"][data-player]')
      ? "signed-in"
      : [...document.querySelectorAll(${JSON.stringify(CONNECT_PLACE)})].some((tab) => tab.textContent.trim() === "Connect")
        ? "signed-out"
        : null,
)`;

async function waitForSignInCode(owner, email, codeFile) {
  rmSync(codeFile, { force: true });
  console.error(JSON.stringify({ signInCode: { email, writeTo: codeFile } }));
  const startedAt = Date.now();
  while (!existsSync(codeFile)) {
    if (Date.now() - startedAt > SIGN_IN_CODE_WAIT_MS) throw new Error(`no sign-in code for ${email} in 10 minutes`);
    await owner.sleep(POLL_MS);
  }
  const code = readFileSync(codeFile, "utf8").trim();
  // A used code is no evidence; it is not kept beside the run's.
  rmSync(codeFile);
  return code;
}

/**
 * Enters the steps' game from its card on the home page, closing what opens over the page first: the card's call to
 * action (Frontier's Resume or Play free, a seated Blitz's Enter) once it is enabled, clicked by the browser as a
 * player's pointer is. Boot is measured from that click as the page received it.
 */
export async function enterAsPlayer(browser, owner, timeoutMs, { card, game }) {
  // Orders tap tiles at the default zoom's offsets; a zoom an earlier session left in this profile is cleared first.
  const clearedZoom = browser.read(CLEAR_STORED_ZOOM_EXPRESSION);
  const startedAt = Date.now();
  let entry = null;
  while (!(entry = browser.read(markHomeCardEntryExpression(card, game)))) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`No card for ${card.heading ?? `game ${game.gameId}`} to enter on the home page`);
    }
    browser.press("Escape");
    await owner.sleep(POLL_MS);
  }
  browser.run(["click", ENTRY_BUTTON]);
  const click = browser.read(trustedPointerDownSince(entry.t));
  if (!click) throw new Error(`the click on ${entry.entry} never reached the page`);
  return { ...entry, t: click.t, clearedZoom };
}

/**
 * A new day opens on the last one's summary card, over the map; a player reads it and continues. Returns whether it
 * was shown.
 */
export async function continuePastTheDaySummary(browser, owner) {
  const shown = () =>
    browser.read(`[...document.querySelectorAll("button")].some((button) => button.textContent.trim() === "Continue")`);
  const startedAt = Date.now();
  while (!shown()) {
    if (Date.now() - startedAt > DAY_SUMMARY_WAIT_MS) return false;
    await owner.sleep(POLL_MS);
  }
  browser.click("Continue");
  return true;
}

const CLEAR_STORED_ZOOM_EXPRESSION = `JSON.stringify((() => {
  const stored = localStorage.getItem("eternum-camera-zoom");
  localStorage.removeItem("eternum-camera-zoom");
  return stored;
})())`;

/**
 * Marks the enter step and tags the card's call to action for the browser's click: the card titled `card.heading`, or
 * else the play item naming the game (`data-play-item` ends in its chain and game). Returns the mark with the button's
 * label, or null while the card is not shown or its button is still disabled.
 */
const markHomeCardEntryExpression = (card, game) => `JSON.stringify((() => {
  const heading = ${JSON.stringify(card.heading)};
  const namesGame = (element) => {
    const [chainId, gameId] = (element.dataset.playItem ?? "").split(":").slice(-2);
    try {
      return BigInt(chainId) === BigInt(${JSON.stringify(String(game.chainId))}) && Number(gameId) === ${Number(game.gameId)};
    } catch {
      return false;
    }
  };
  const title = heading === null
    ? [...document.querySelectorAll("[data-play-item]")].find(namesGame)
    : [...document.querySelectorAll("h1, h2, h3, h4")].find((element) => element.textContent.trim() === heading);
  let found = title;
  while (found && !found.querySelector("button")) found = found.parentElement;
  const enter = new RegExp(${JSON.stringify(card.enter)});
  const button = found && [...found.querySelectorAll("button")].find((element) => !element.disabled && enter.test(element.textContent.trim()));
  if (!button) return null;
  document.querySelectorAll("${ENTRY_BUTTON}").forEach((element) => delete element.dataset.playtestEntry);
  button.dataset.playtestEntry = "";
  return { ...JSON.parse(window.__playtest.step("enter")), entry: button.textContent.trim() };
})())`;

const trustedPointerDownSince = (t) => `JSON.stringify(
  JSON.parse(window.__playtest.read(${t})).inputs.find((input) => input.type === "pointerdown" && input.trusted) ?? null,
)`;

const isShown = (selector) => `Boolean(document.querySelector(${JSON.stringify(selector)}))`;

async function waitUntil(owner, check, failure) {
  const startedAt = Date.now();
  while (!check()) {
    if (Date.now() - startedAt > PAGE_WAIT_MS) throw new Error(failure);
    await owner.sleep(POLL_MS);
  }
}
