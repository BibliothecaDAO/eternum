import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BANNED_WORDS } from "@bibliothecadao/types";
import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { describe, expect, it } from "vitest";

import {
  PLAIN_WORDS_RULE,
  PLAIN_WORDS_STRICT_RULE,
  plainWordsGuardConfigs,
  readBannedWords,
} from "./plain-words-guards.mjs";
import { scanSource } from "../../../scripts/words/check.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const BASE = {
  files: ["**/*.{ts,tsx}"],
  languageOptions: { parser: tseslint.parser },
  linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: "off" },
};
const guard = new ESLint({ cwd: REPO, overrideConfigFile: true, overrideConfig: [BASE, ...plainWordsGuardConfigs] });

const hits = async (path, source) => {
  const [result] = await guard.lintText(source, { filePath: resolve(REPO, path) });
  return result.messages
    .filter((message) => message.fatal || message.severity === 2)
    .map((message) => ({
      ruleId: message.ruleId,
      message: message.message,
    }));
};

const SCREEN = "apps/game/src/ui/features/world/zz-plain-words-probe.tsx";
const CORE = "packages/core/src/systems/zz-plain-words-probe.ts";

describe("plain-words guard reads one source of truth", () => {
  it("parses BANNED_WORDS directly from packages/types/src/words/voice.ts", () => {
    expect(readBannedWords()).toEqual(
      BANNED_WORDS.map(({ banned, use, pattern, zeroTolerance }) => ({
        banned,
        use,
        pattern,
        zeroTolerance: Boolean(zeroTolerance),
      })),
    );
  });
});

describe("plain-words guard refuses banned words in player-facing text", () => {
  it.each([
    ["Found your home in a literal", `export const TITLE = "Found your home";`, PLAIN_WORDS_STRICT_RULE],
    ["Founding as in a template", "export const msg = (o: string) => `Founding as ${o}…`;", PLAIN_WORDS_STRICT_RULE],
    ["Tribe founded in JSX", `export const A = () => <p>Tribe founded</p>;`, PLAIN_WORDS_STRICT_RULE],
    ["Far-Eye in JSX", `export const A = () => <span>Far-Eye</span>;`, PLAIN_WORDS_STRICT_RULE],
    ["far-eye lowercase in string", `export const label = "Use far-eye relic";`, PLAIN_WORDS_STRICT_RULE],
    ["far-eye standalone label", `export const item = { label: "far-eye" };`, PLAIN_WORDS_STRICT_RULE],
    ["Pledge in string", `export const cta = "Pledge to Luminary";`, PLAIN_WORDS_RULE],
    ["Redeem in JSX", `export const A = () => <button>Redeem</button>;`, PLAIN_WORDS_RULE],
    ["Army disbanded in template", "export const msg = (a: string) => `${a} disbanded`;", PLAIN_WORDS_RULE],
    ["did not answer in string", `export const err = "Season did not answer.";`, PLAIN_WORDS_RULE],
    ["Travel blocked in string", `export const msg = "Travel blocked";`, PLAIN_WORDS_RULE],
    ["Travel to the Deep tooltip", `export const A = () => <span title="Travel to the Deep" />;`, PLAIN_WORDS_RULE],
    ["March button", `export const A = () => <button>March</button>;`, PLAIN_WORDS_RULE],
    ["Claim name in string", `export const cta = "Claim name";`, PLAIN_WORDS_RULE],
    ["Claim rewards button", `export const A = () => <button>Claim rewards</button>;`, PLAIN_WORDS_RULE],
    ["Build order in string", `export const title = "Build order";`, PLAIN_WORDS_RULE],
    ["Build-order hyphenated label", `export const title = "Build-order";`, PLAIN_WORDS_RULE],
    ["Spoils with trailing colon in JSX", `export const A = () => <dt>Spoils:</dt>;`, PLAIN_WORDS_RULE],
    ["Establish with trailing period", `export const msg = "Establish.";`, PLAIN_WORDS_RULE],
    ["Re-establish hyphenated label", `export const msg = "Re-establish";`, PLAIN_WORDS_RULE],
    ["Guard dismissed in string", `export const msg = "Guard dismissed";`, PLAIN_WORDS_RULE],
    ["Dismiss guard button", `export const A = () => <button>Dismiss guard</button>;`, PLAIN_WORDS_RULE],
    ["data-tip tooltip", `export const A = () => <span data-tip="Switch on" />;`, PLAIN_WORDS_RULE],
  ])("refuses %s", async (_, source, expectedRule) => {
    const found = await hits(SCREEN, source);
    expect(found).toEqual([{ ruleId: expectedRule, message: expect.stringMatching(/^Plain words:/) }]);
  });

  it("refuses banned words in shared packages too", async () => {
    const found = await hits(CORE, "export const title = (r: string) => `${r} founded`;");
    expect(found).toEqual([{ ruleId: PLAIN_WORDS_STRICT_RULE, message: expect.stringMatching(/^Plain words:/) }]);
  });

  it.each([
    ["Create your Realm", `export const TITLE = "Create your Realm";`],
    ["Not found error screen", `export const A = () => <p>Not found</p>;`],
    ["Sites are found while exploring", `export const A = () => <p>Sites are found at 100%</p>;`],
    ["property key named founding", `export const WORDS = { founding: "Creating your Realm…" };`],
    ["thrown Error message", `export const fail = () => { throw new Error("founding failed"); };`],
    ["console log", `export const log = () => console.warn("Realm founded");`],
    ["equality check against discriminator", `export const isProv = (k: string) => k === "provision";`],
    ["CSS className", `export const A = () => <div className="founding-step far-eye" />;`],
    ["import path", `import { x } from "@/ui/realm-provision-runner"; export const y = x;`],
    ["asset path literal", `export const sound = { url: "/sound/units/march.mp3" };`],
    ["relative path literal", `export const rel = "./claim/index.ts";`],
    ["alias path literal", `export const mod = "@/ui/realm-provision-runner";`],
    ["file extension piece", "export const img = (id: string) => `/images/${id}.png`;"],
  ])("allows %s", async (_, source) => {
    expect(await hits(SCREEN, source)).toEqual([]);
  });

  it("refuses status maps, typed label arrays, satisfies expressions, quoted keys, and visible attributes", async () => {
    expect(await hits(SCREEN, `export const ORDER = { state: "pledge" };`)).toEqual([
      { ruleId: PLAIN_WORDS_RULE, message: expect.stringMatching(/^Plain words:/) },
    ]);
    expect(await hits(SCREEN, `const PHASES: readonly Phase[] = ["pledge", "joined"]; export { PHASES };`)).toEqual([
      { ruleId: PLAIN_WORDS_RULE, message: expect.stringMatching(/^Plain words:/) },
    ]);
    expect(await hits(SCREEN, `export const STATUS = { pending: "claimed", done: "collected" };`)).toEqual([
      { ruleId: PLAIN_WORDS_RULE, message: expect.stringMatching(/^Plain words:/) },
    ]);
    expect(await hits(SCREEN, `export const actionLabel = "pledge" satisfies string;`)).toEqual([
      { ruleId: PLAIN_WORDS_RULE, message: expect.stringMatching(/^Plain words:/) },
    ]);
    expect(await hits(SCREEN, `export const item = { "label": "pledge" };`)).toEqual([
      { ruleId: PLAIN_WORDS_RULE, message: expect.stringMatching(/^Plain words:/) },
    ]);
    expect(
      await hits(SCREEN, `export const item = (done: boolean) => ({ label: done ? "claimed" : "claim" });`),
    ).toEqual([
      { ruleId: PLAIN_WORDS_RULE, message: expect.stringMatching(/^Plain words:/) },
      { ruleId: PLAIN_WORDS_RULE, message: expect.stringMatching(/^Plain words:/) },
    ]);
    expect(await hits(SCREEN, `export const A = () => <span title="travel" />;`)).toEqual([
      { ruleId: PLAIN_WORDS_RULE, message: expect.stringMatching(/^Plain words:/) },
    ]);
    expect(await hits(SCREEN, `export const A = () => <button>march</button>;`)).toEqual([
      { ruleId: PLAIN_WORDS_RULE, message: expect.stringMatching(/^Plain words:/) },
    ]);
  });

  it("uses the exact same player-text walker as scripts/words/check.mjs across every tricky form", async () => {
    const context = {
      nouns: new Set(),
      voiceRules: [{ rule: "No pledge", forbidden: /\bpledg(?:e|ed|ing)\b/i }],
    };
    const cases = [
      [`export const f = () => { throw new Error("Pledge failed"); };`, false],
      [`export const f = () => console.warn("Pledge failed");`, false],
      [`export const A = () => <div className="pledge" data-testid="pledge" />;`, false],
      [`export const ok = (k: string) => k === "Pledge";`, false],
      ['export const src = (moving: boolean) => `/icons/${moving ? "pledge" : "idle"}.svg`;', false],
      ['export const line = (moving: boolean) => `Army ${moving ? "pledge" : "idle"}`;', true],
      [`export const ORDER = { state: "pledge" };`, true],
      [`const PHASES: readonly Phase[] = ["pledge", "joined"]; export { PHASES };`, true],
      [`export const STATUS = { pending: "pledge", done: "joined" };`, true],
      [`export const actionLabel = "pledge" satisfies string;`, true],
      [`export const quoted = { "label": "pledge" };`, true],
      [`export const item = (ok: boolean) => ({ label: ok ? "pledged" : "pledge" });`, true],
      ["export const msg = (a: string) => `${a} pledged`;", true],
      [`export const A = () => <p>Pledge to Luminary</p>;`, true],
      [`export const A = () => <span title="Pledge to Luminary" />;`, true],
    ];
    for (const [source, expected] of cases) {
      const wordsHits = scanSource(source, resolve(REPO, SCREEN), context);
      const guardHits = await hits(SCREEN, source);
      expect(wordsHits.length > 0).toBe(expected);
      expect(guardHits.length > 0).toBe(expected);
    }
  });

  it.each([
    ["voice.ts itself", "packages/types/src/words/voice.ts"],
    ["patch notes", "apps/game/src/shell/generated/patch-notes.ts"],
    ["a test file", "apps/game/src/ui/features/world/zz-probe.test.tsx"],
    ["a debug lab", "apps/game/src/ui/features/debug/zz-probe.tsx"],
  ])("leaves %s alone", async (_, path) => {
    expect(await hits(path, `export const TITLE = "Found your home";`)).toEqual([]);
  });

  it("counts only existing files with positive counts in plain-words-baseline.json", () => {
    const baseline = JSON.parse(readFileSync(resolve(REPO, "apps/game/scripts/plain-words-baseline.json"), "utf8"));
    for (const [file, count] of Object.entries(baseline)) {
      expect(() => readFileSync(resolve(REPO, file)), file).not.toThrow();
      expect(count, file).toBeGreaterThan(0);
    }
  });
});
