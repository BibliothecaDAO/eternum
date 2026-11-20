import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";

import {
  continueWithoutWallet,
  findHomeCardEntry,
  CONNECT_PLACE,
  markHomeCardEntryExpression,
  signInIfSignedOut,
} from "./player-entry.mjs";
import { STEP_SETS } from "./steps.mjs";

/**
 * The runner's sign-in and entry find the app's controls by what they do, as the app marks them: Connect by
 * `data-action="connect"` (src/shell/frame/tabs.tsx), a game's step by its card (`data-play-item`) and its verb's name
 * (`data-play-verb`, src/shell/play/play-item.tsx), whatever their words or positions (playtest 29 October 2026, B1 and
 * B2: the first header tab became Chat, and the card's heading became its lockup's image).
 */
const page = (html) => {
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`, { runScripts: "outside-only" });
  dom.window.__playtest = { step: (name) => JSON.stringify({ step: name, t: 7 }) };
  return dom;
};

const FRONTIER_GAME = { chainId: "0x1ab9", gameId: 1 };
const frontierCard = STEP_SETS.actions.game.card;
const blitzCard = STEP_SETS["blitz-orders"].game.card;

describe("the runner's Connect", () => {
  it("is the bar's Connect, not the first place in it", () => {
    const dom = page(`<header>
      <button data-role="tab">Chat</button>
      <button data-role="tab" data-action="connect">Connect</button>
    </header>`);
    expect(dom.window.document.querySelector(CONNECT_PLACE).textContent).toBe("Connect");
  });
});

describe("the runner's entry", () => {
  const home = (verb, { disabled = false } = {}) =>
    page(`<div data-play-item="0x1ab9:2"><button data-play-verb="resume">Resume</button></div>
      <div data-play-item="0x1ab9:1"><h3><img alt="Frontier"></h3>
        <button data-play-verb="${verb}"${disabled ? " disabled" : ""}>${verb === "resume" ? "Resume" : "Watch"}</button>
      </div>`);

  it("presses the game's own card's verb by its name, and marks it for the browser's click", () => {
    const dom = home("resume");
    const entry = JSON.parse(dom.window.eval(markHomeCardEntryExpression(frontierCard, FRONTIER_GAME)));
    expect(entry).toEqual({ step: "enter", t: 7, entry: "Resume" });
    const marked = [...dom.window.document.querySelectorAll("[data-playtest-entry]")];
    expect(marked.map((button) => button.closest("[data-play-item]").dataset.playItem)).toEqual(["0x1ab9:1"]);
  });

  it("waits while the verb is disabled, or is not one the steps take", () => {
    expect(
      JSON.parse(
        home("resume", { disabled: true }).window.eval(markHomeCardEntryExpression(frontierCard, FRONTIER_GAME)),
      ),
    ).toBeNull();
    expect(JSON.parse(home("watch").window.eval(markHomeCardEntryExpression(frontierCard, FRONTIER_GAME)))).toBeNull();
  });

  it("enters a seated Blitz by its Enter, which Frontier's steps never press", () => {
    const seated = () => page(`<div data-play-item="0x1ab9:1"><button data-play-verb="enter">Enter</button></div>`);
    expect(JSON.parse(seated().window.eval(markHomeCardEntryExpression(blitzCard, FRONTIER_GAME)))).toMatchObject({
      entry: "Enter",
    });
    expect(JSON.parse(seated().window.eval(markHomeCardEntryExpression(frontierCard, FRONTIER_GAME)))).toBeNull();
  });
});

it("refuses an expired saved state without sending another email code", async () => {
  const browser = { run: vi.fn(), read: () => "signed-out", click: vi.fn() };
  await expect(
    signInIfSignedOut({
      browser,
      owner: { throwIfCancelled() {} },
      email: "saved@test",
      baseUrl: "https://dev.test",
      requireExisting: true,
    }),
  ).rejects.toThrow("no sign-in code was sent");
  expect(browser.run.mock.calls).toEqual([[["open", "https://dev.test/"]]]);
  expect(browser.click).not.toHaveBeenCalled();
});

describe("the optional wallet invitation", () => {
  it("closes the invitation before returning an already enabled home-card entry", async () => {
    const dom = page(`<div data-play-item="0x1ab9:1"><button data-play-verb="resume">Resume</button></div>
      <section role="dialog" aria-label="Your wallet"><button aria-label="Close">Close</button></section>`);
    const run = vi.fn(([action, selector]) => {
      expect(action).toBe("click");
      dom.window.document.querySelector(selector).closest("section").remove();
    });
    const browser = {
      read: (expression) => {
        const value = dom.window.eval(expression);
        return typeof value === "string" ? JSON.parse(value) : value;
      },
      run,
    };
    const entry = await findHomeCardEntry(browser, { sleep: vi.fn() }, 1_000, {
      card: frontierCard,
      game: FRONTIER_GAME,
    });
    expect(entry).toEqual({ step: "enter", t: 7, entry: "Resume" });
    expect(run).toHaveBeenCalledOnce();
    expect(dom.window.document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("closes the wallet prompt through its close control and records that it was shown", async () => {
    const dom = page(
      '<section role="dialog" aria-label="Your wallet"><button aria-label="Close">Close</button></section>',
    );
    const run = vi.fn(([action, selector]) => {
      expect(action).toBe("click");
      dom.window.document.querySelector(selector).closest("section").remove();
    });
    const browser = { read: (expression) => dom.window.eval(expression), run };
    expect(await continueWithoutWallet(browser, { sleep: vi.fn() })).toBe(true);
    expect(run).toHaveBeenCalledOnce();
    expect(dom.window.document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("leaves other dialogs open", async () => {
    const dom = page(
      '<section role="dialog" aria-label="Your name"><button aria-label="Close">Close</button></section>',
    );
    const browser = { read: (expression) => dom.window.eval(expression), run: vi.fn() };
    expect(await continueWithoutWallet(browser, { sleep: vi.fn() })).toBe(false);
    expect(browser.run).not.toHaveBeenCalled();
    expect(dom.window.document.querySelector('[role="dialog"]')).not.toBeNull();
  });
});
