import { existsSync, readFileSync, rmSync } from "node:fs";

import { STEPS_GAME } from "./steps.mjs";

/**
 * How a player gets into the steps' game: signed in through the sign-in page as a player is (their email, Send code,
 * the code from the mail), then through the home page's card, with the browser's own click on its call to action.
 */

const POLL_MS = 500;
const PAGE_WAIT_MS = 30_000;
// A sign-in code stops working ten minutes after it is sent.
const SIGN_IN_CODE_WAIT_MS = 10 * 60_000;
const EMAIL_FIELD = 'input[type="email"]';
const CODE_FIELD = 'input[autocomplete="one-time-code"]';
const ENTRY_BUTTON = "[data-playtest-entry]";

/**
 * Signs the profile in when the home page shows it signed out, and keeps it as it is otherwise. The runner reads no
 * mail: it asks for the code on stdout and waits for whoever runs it to write the code to `codeFile`. Returns "kept" or
 * "signed in"; the home page is to be opened again after a sign-in.
 */
export async function signInIfSignedOut({ browser, owner, email, baseUrl, codeFile }) {
  if ((await identityShown(browser, owner)) === "signed-in") return "kept";
  browser.run(["open", new URL("/sign-in", baseUrl).href]);
  await waitUntil(owner, () => browser.read(isShown(EMAIL_FIELD)), "the sign-in page shows no email field");
  browser.run(["fill", EMAIL_FIELD, email]);
  browser.click("Send code");
  await waitUntil(owner, () => browser.read(isShown(CODE_FIELD)), `no code field after sending a code to ${email}`);
  browser.run(["type", CODE_FIELD, await waitForSignInCode(owner, email, codeFile)]);
  await waitUntil(owner, () => browser.read(`location.pathname !== "/sign-in"`), `the code did not sign ${email} in`);
  return "signed in";
}

/** The rail's foot as the home page settles: the player's portrait once signed in, Sign in otherwise. */
export async function identityShown(browser, owner) {
  let identity = null;
  await waitUntil(owner, () => (identity = browser.read(IDENTITY_EXPRESSION)), "the home page shows no identity");
  return identity;
}

const IDENTITY_EXPRESSION = `JSON.stringify(
  document.querySelector('a[href="/profile"]:not([data-role="tab"]) img')
    ? "signed-in"
    : [...document.querySelectorAll("button")].some((button) => button.textContent.trim() === "Sign in")
      ? "signed-out"
      : null,
)`;

async function waitForSignInCode(owner, email, codeFile) {
  rmSync(codeFile, { force: true });
  console.log(JSON.stringify({ signInCode: { email, writeTo: codeFile } }));
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
 * action (Resume or Play free) once it is enabled, clicked by the browser as a player's pointer is. Boot is measured
 * from that click as the page received it.
 */
export async function enterAsPlayer(browser, owner, timeoutMs) {
  // Orders tap tiles at the default zoom's offsets; a zoom an earlier session left in this profile is cleared first.
  const clearedZoom = browser.read(CLEAR_STORED_ZOOM_EXPRESSION);
  const startedAt = Date.now();
  let entry = null;
  while (!(entry = browser.read(markHomeCardEntryExpression(STEPS_GAME.homeCard)))) {
    if (Date.now() - startedAt > timeoutMs) throw new Error(`No ${STEPS_GAME.homeCard} card to enter on the home page`);
    browser.press("Escape");
    await owner.sleep(POLL_MS);
  }
  browser.run(["click", ENTRY_BUTTON]);
  const click = browser.read(trustedPointerDownSince(entry.t));
  if (!click) throw new Error(`the click on ${entry.entry} never reached the page`);
  return { ...entry, t: click.t, clearedZoom };
}

const CLEAR_STORED_ZOOM_EXPRESSION = `JSON.stringify((() => {
  const stored = localStorage.getItem("eternum-camera-zoom");
  localStorage.removeItem("eternum-camera-zoom");
  return stored;
})())`;

/**
 * Marks the enter step and tags the call to action inside the home page's card for `heading` for the browser's click;
 * returns the mark with the button's label, or null while the card is not shown or its button is still disabled.
 */
const markHomeCardEntryExpression = (heading) => `JSON.stringify((() => {
  const title = [...document.querySelectorAll("h1, h2, h3, h4")].find((element) => element.textContent.trim() === ${JSON.stringify(heading)});
  let card = title;
  while (card && !card.querySelector("button")) card = card.parentElement;
  const button = card && [...card.querySelectorAll("button")].find((element) => !element.disabled && /^(Resume|Play)/.test(element.textContent.trim()));
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
