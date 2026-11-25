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
  it("refuses a phrase a test asserts, finds by, compares or keeps in a table, whole or filled in by hand", async () => {
    expect(await hits(TEST, `expect(text).toContain(${quoted(WALLET_WORDS.createWallet)});`)).toBe(1);
    expect(await hits(TEST, `expect(text).toBe(${quoted(DAY_BANNER_WORDS.productionBane(50))});`)).toBe(1);
    expect(await hits(TEST, `await press(ui, ${quoted(WALLET_WORDS.createWallet)});`)).toBe(1);
    expect(await hits(TEST, `it.each([["wallet", ${quoted(WALLET_WORDS.createWallet)}]])("%s", () => {});`)).toBe(1);
    expect(await hits(STEPS, `const LOST = ${quoted(FIGHT_WORDS.armyLost)};`)).toBe(1);
  });

  it("lets a test read the phrase, name itself, feed a fixture, say a short word, and leaves screens alone", async () => {
    expect(await hits(TEST, "expect(text).toContain(WALLET_WORDS.createWallet);")).toBe(0);
    expect(await hits(TEST, `it(${quoted(WALLET_WORDS.createWallet)}, () => {});`)).toBe(0);
    expect(await hits(TEST, `settle({ revertReason: ${quoted(WALLET_WORDS.createWallet)} });`)).toBe(0);
    expect(await hits(TEST, `expect(text).toContain(${quoted(CLOSE)});`)).toBe(0);
    expect(await hits(SCREEN, `const label = ${quoted(WALLET_WORDS.createWallet)};`)).toBe(0);
  });
});

describe("a playtest step's word", () => {
  it("is read from the words table as the screens spell it, and a missing one fails loudly", () => {
    expect(wordAt("FIGHT_WORDS.armyLost")).toBe(FIGHT_WORDS.armyLost);
    expect(wordAt("NO_TROOPS_AT_HOME")).toBe(NO_TROOPS_AT_HOME);
    expect(() => wordAt("FIGHT_WORDS.noSuchWord")).toThrow("No written phrase at FIGHT_WORDS.noSuchWord");
  });
});
