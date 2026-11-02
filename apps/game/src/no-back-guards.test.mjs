// @vitest-environment node
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { describe, expect, it } from "vitest";

import { noBackGuardConfigs } from "../scripts/no-back-guards.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const BASE = {
  files: ["**/*.tsx"],
  languageOptions: { parser: tseslint.parser },
  // As CI's lint guards run: a source's own eslint comments switch nothing off.
  linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: "off" },
};
const guard = new ESLint({ cwd: REPO, overrideConfigFile: true, overrideConfig: [BASE, ...noBackGuardConfigs] });

/** The guard's errors for a screen's source at a real path in the client, as CI's lint guards count them. */
const hits = async (source, path = "shell/zz-guard-fixture.tsx") => {
  const [result] = await guard.lintText(source, { filePath: resolve(REPO, "apps/game/src", path) });
  return result.messages.filter((message) => message.fatal || message.severity === 2).map((message) => message.message);
};

describe("no screen brings back a Back link or a row arrow", () => {
  it.each([
    ["a Back link", `export const A = () => <a href="/" data-role="back">Home</a>;`],
    ["a chevron at a row's end", `export const A = () => <Icon name="chevron-right" size={18} />;`],
    ["a chevron Back", `export const A = () => <HudIconButton icon="chevron-left" label="Up" />;`],
    ["a row's opens prop", `export const A = () => <HudRow title="Research" opens onClick={go} />;`],
    ["a menu item that opens", `export const items = [{ label: "Build", opens: true }];`],
    ["a Back prop", `export const A = () => <PageFrame back="/profile" title="Settings" />;`],
    ["a Back label", `export const A = () => <button aria-label="Back" />;`],
    ["Back as a button's words", `export const A = () => <button type="button">Back</button>;`],
    ["the Back word", `export const A = () => <span>{BACK}</span>;`],
    [
      // The setting row's arrow as it stood before the change, word for word (review-no-back-1, P2-4).
      "the former setting row's arrow",
      `export const A = ({ control, onClick, href }) => (
        <AppRow trail={<>{control ?? ((onClick || href) && <Icon name="arrow-right" size={18} />)}</>} onClick={onClick} />
      );`,
    ],
    [
      "a new row ending on an arrow",
      `export const A = () => <AppRow title="Market" onClick={go} trail={<Icon name="arrow-right" size={18} />} />;`,
    ],
    [
      "a list row's trailing arrow",
      `export const A = () => <ListRow title="Market" onClick={go} trailing={<SemanticIcon name="arrow-right" />} />;`,
    ],
    [
      "a wallet row's arrow beside its pending word",
      `export const A = ({ pending }) => <button>{pending ? "Opening…" : <SemanticIcon name="arrow-right" size={22} />}</button>;`,
    ],
  ])("refuses %s", async (_, source) => {
    const found = await hits(source);
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((message) => message.startsWith("No Back link or row arrow"))).toBe(true);
  });

  it.each([
    [
      "a pager's previous and next",
      `export const A = () => (
        <nav>
          <HudIconButton icon="arrow-left" label="Day 3" onClick={earlier} />
          <HudIconButton icon="arrow-right" label="Day 5" onClick={later} />
        </nav>
      );`,
    ],
    [
      "the arrow between two numbers",
      `export const A = () => <p><s>1,744</s><Icon name="arrow-right" size={16} /><b>1,780</b></p>;`,
    ],
    [
      "a verb's icon beside its words",
      `export const A = () => <a href="https://avnu.fi"><SemanticIcon name="arrow-right" />Swap</a>;`,
    ],
    ["a fold's chevron down", `export const A = () => <Icon name="chevron-down" />;`],
    ["Back inside other words", `export const A = () => <p>Back in your wallet</p>;`],
  ])("keeps %s", async (_, source) => {
    expect(await hits(source)).toEqual([]);
  });

  it("leaves the debug tools and tests alone", async () => {
    const chevron = `export const A = () => <Icon name="chevron-right" />;`;
    expect(await hits(chevron, "ui/features/debug/zz-guard-fixture.tsx")).toEqual([]);
    expect(await hits(chevron, "shell/zz-guard-fixture.test.tsx")).toEqual([]);
  });
});
