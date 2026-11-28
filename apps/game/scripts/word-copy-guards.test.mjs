import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { describe, expect, it } from "vitest";

import { copiesAPhrase, readPlayerPhrases, wordCopyGuardConfigs } from "./word-copy-guards.mjs";
import { wordAt } from "./words-table.mjs";
import {
  CLOSE,
  DAY_BANNER_WORDS,
  FIGHT_WORDS,
  NO_TROOPS_AT_HOME,
  WALLET_WORDS,
} from "../src/ui/design-system/kit/words";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const guard = new ESLint({
  cwd: REPO,
  overrideConfigFile: true,
  overrideConfig: [
    { files: ["**/*.{ts,tsx}"], languageOptions: { parser: tseslint.parser }, linterOptions: { noInlineConfig: true } },
    ...wordCopyGuardConfigs,
  ],
});

const hits = async (path, source) => {
  const [result] = await guard.lintText(source, { filePath: resolve(REPO, path) });
  return result.messages.filter((message) => message.fatal || message.severity === 2).length;
};

const TEST = "apps/game/src/ui/features/zz-guard-probe.test.tsx";
const STEPS = "apps/game/scripts/client-playtest/zz-guard-probe-steps.mjs";
const SCREEN = "apps/game/src/ui/features/zz-guard-probe.tsx";
const WORDS_FILE = "apps/game/src/ui/design-system/kit/words.ts";
const TYPES_AMOUNT = "packages/types/src/words/amount.ts";
const TYPES_NOUNS = "packages/types/src/words/nouns.ts";
const CORE_STORY = "packages/core/src/systems/story-event-formatter.ts";
const quoted = (text) => JSON.stringify(text);

describe("the player phrases the guard reads", () => {
  it("are the words modules' whole strings and templates, never keys, imports, developer errors or short words", () => {
    const phrases = readPlayerPhrases([
      [
        'import { x } from "a module path at length";',
        'export const W = { "a long key that is no phrase": "A lantern waits by the gate", tiny: "Close" };',
        "export const late = (n: number) => `Rain falls at ${n}% across the far hills`;",
        'export const fail = () => { throw new Error("A developer message here"); };',
      ].join("\n"),
    ]);
    expect([...phrases.whole]).toEqual(["A lantern waits by the gate"]);
    expect(copiesAPhrase(phrases, "Rain falls at 50% across the far hills")).toBe(true);
    expect(copiesAPhrase(phrases, "Rain falls on the hills")).toBe(false);
    expect(() => readPlayerPhrases(['export const W = { tiny: "Close" };'])).toThrow("No player phrases");
  });
});

describe("the guard", () => {
  it("refuses a phrase a test asserts, finds by, compares or keeps in a table, whole or filled in by hand, and a stand-in for one", async () => {
    expect(await hits(TEST, `expect(text).toContain(${quoted(WALLET_WORDS.createWallet)});`)).toBe(1);
    expect(await hits(TEST, `expect(text).toBe(${quoted(DAY_BANNER_WORDS.productionBane(50))});`)).toBe(1);
    expect(await hits(TEST, `await press(ui, ${quoted(WALLET_WORDS.createWallet)});`)).toBe(1);
    expect(await hits(TEST, `it.each([["wallet", ${quoted(WALLET_WORDS.createWallet)}]])("%s", () => {});`)).toBe(1);
    expect(await hits(STEPS, `const LOST = ${quoted(FIGHT_WORDS.armyLost)};`)).toBe(1);
    expect(await hits(TEST, "expect(line).toEqual(expect.any(String));")).toBe(1);
  });

  it("lets a test read the phrase, name itself, feed a fixture, say a short word, and leaves screens alone", async () => {
    expect(await hits(TEST, "expect(text).toContain(WALLET_WORDS.createWallet);")).toBe(0);
    expect(await hits(TEST, "expect(at).toEqual(expect.stringMatching(/^\\d{4}-/));")).toBe(0);
    expect(await hits(TEST, `it(${quoted(WALLET_WORDS.createWallet)}, () => {});`)).toBe(0);
    expect(await hits(TEST, `settle({ revertReason: ${quoted(WALLET_WORDS.createWallet)} });`)).toBe(0);
    expect(await hits(TEST, `expect(text).toContain(${quoted(CLOSE)});`)).toBe(0);
    expect(await hits(SCREEN, `const label = ${quoted(WALLET_WORDS.createWallet)};`)).toBe(0);
  });
});

describe("the em-dash guard", () => {
  it("refuses em-dashes and hand-typed placeholder copies in words modules, core, and UI components", async () => {
    expect(await hits(WORDS_FILE, 'export const LINE = "Victory \u2014 defeated";')).toBe(1);
    expect(await hits(WORDS_FILE, 'export const EMPTY = "\u2014";')).toBe(1);
    expect(await hits(TYPES_AMOUNT, 'export const missing = () => "\u2014";')).toBe(1);
    expect(await hits(TYPES_NOUNS, 'export const LINE = "Realm \u2014 home";')).toBe(1);
    expect(await hits(CORE_STORY, 'export const title = "Raid \u2014 realm lost";')).toBe(1);
    expect(await hits(CORE_STORY, 'export const line = `${x ?? "\u2014"} wheat`;')).toBe(1);
    expect(await hits(SCREEN, "const tip = `${name} \u2014 ${effect}`;")).toBe(1);
    expect(await hits(SCREEN, 'const tip = "Cancel build \u2014 click again";')).toBe(1);
    expect(await hits(SCREEN, "export const View = () => <span>{a} \u2014 {b}</span>;")).toBe(1);
    expect(await hits(SCREEN, "export const View = () => <span>\u2014</span>;")).toBe(1);
    expect(await hits(SCREEN, 'const fallback = value ?? "\u2014";')).toBe(1);
  });

  it("allows only the single UNKNOWN constant in nouns.ts, references to UNKNOWN, and comments", async () => {
    expect(await hits(TYPES_NOUNS, 'export const UNKNOWN = "\u2014";')).toBe(0);
    expect(await hits(SCREEN, "export const View = () => <span>{UNKNOWN}</span>;")).toBe(0);
    expect(await hits(SCREEN, "const fallback = value ?? UNKNOWN;")).toBe(0);
    expect(await hits(SCREEN, "const title = `Guards: ${UNKNOWN}`;")).toBe(0);
    expect(await hits(SCREEN, "// Note \u2014 comment only\nexport const ok = 1;")).toBe(0);
  });
});

describe("a playtest step's word", () => {
  it("is read from the words table as the screens spell it, and a missing one fails loudly", () => {
    expect(wordAt("FIGHT_WORDS.armyLost")).toBe(FIGHT_WORDS.armyLost);
    expect(wordAt("NO_TROOPS_AT_HOME")).toBe(NO_TROOPS_AT_HOME);
    expect(() => wordAt("FIGHT_WORDS.noSuchWord")).toThrow("No written phrase at FIGHT_WORDS.noSuchWord");
  });
});
