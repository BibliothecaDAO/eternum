// @vitest-environment node
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";
import { describe, expect, it } from "vitest";

import { nameGuardConfigs } from "../scripts/name-guards.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const BASE = {
  files: ["**/*.{ts,tsx}"],
  languageOptions: { parser: tseslint.parser },
  // As CI's lint guards run: a source's own eslint comments switch nothing off.
  linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: "off" },
};
const boundary = new ESLint({ cwd: REPO, overrideConfigFile: true, overrideConfig: [BASE, ...nameGuardConfigs] });

/** The boundary's errors for a source at a real path in the client, as CI's lint guards count them. */
const hits = async (path, source) => {
  const [result] = await boundary.lintText(source, { filePath: resolve(REPO, "apps/game/src", path) });
  return result.messages.filter((message) => message.fatal || message.severity === 2).map((message) => message.message);
};

const UI = "ui/features/military/battle/battle-lab/zz-guard-fixture.tsx";
const SERVICE = "services/leaderboard/zz-guard-fixture.ts";

describe("only the imperative consumers reach an imperative name reader, by resolved module", () => {
  it.each([
    ["the alias", UI, "@/services/identity/player-profiles"],
    ["a relative path from a screen (review 3)", UI, "../../../../../services/identity/player-profiles"],
    ["a path with its extension", UI, "../../../../../services/identity/player-profiles.ts"],
    ["a relative path from a sibling service (review 4)", SERVICE, "../identity/player-profiles"],
    ["the alias from a new folder", "zz-new-folder/zz-guard-fixture.ts", "@/services/identity/player-profiles"],
  ])("rejects an import by %s", async (_, path, from) => {
    const source = `import { getPlayerDisplayName } from "${from}";\nexport const cachedName = getPlayerDisplayName;`;
    expect(await hits(path, source)).toEqual([expect.stringMatching(/^Only the imperative consumers/)]);
  });

  it.each([
    ["a namespace import", `import * as profiles from "../identity/player-profiles";`],
    ["a renamed import", `import { readPlayerName as nameOf } from "../identity/player-profiles";`],
    ["a renamed re-export", `export { getPlayerDisplayName as nameOf } from "../identity/player-profiles";`],
    ["a re-export of the whole module", `export * from "../identity/player-profiles";`],
    ["a dynamic import", `export const later = () => import("../identity/player-profiles");`],
  ])("rejects %s", async (_, source) => {
    expect(await hits(SERVICE, source)).toHaveLength(1);
  });

  it("leaves the module's other exports, and the imperative consumers, alone", async () => {
    expect(await hits(UI, `import { identityProfiles } from "@/services/identity/player-profiles";`)).toEqual([]);
    const reader = `import { getPlayerDisplayName } from "@/services/identity/player-profiles";\nexport const x = getPlayerDisplayName;`;
    for (const consumer of [
      "three/managers/zz-guard-fixture.ts",
      "hooks/use-player-profile.ts",
      "services/game-client.ts",
      "sync/fact-views.ts",
    ])
      expect(await hits(consumer, reader), consumer).toEqual([]);
  });
});

/**
 * The reviews' dependency controls, read by React's own exhaustive-deps (the repo's rule), not a parser of ours: what
 * it reports for a cache that holds a name without listing the reader. It runs in editors and `pnpm lint`, not CI's
 * lint guards (the client has 59 missing-dependency reports today, many of them effects keyed on purpose).
 */
describe("a cache that holds a name, as React's exhaustive-deps reads it", () => {
  const react = new ESLint({
    cwd: REPO,
    overrideConfigFile: true,
    overrideConfig: [
      { ...BASE, plugins: { "react-hooks": reactHooks }, rules: { "react-hooks/exhaustive-deps": "error" } },
    ],
  });
  const reported = async (head, body) => {
    const source = `${head}\nexport const Line = ({ address }: { address: string }) => {\n${body}\n};`;
    const [result] = await react.lintText(source, { filePath: resolve(REPO, "apps/game/src", UI) });
    return result.messages.map((message) => message.message);
  };
  const hooks = `import { useMemo } from "react";\nimport { type PlayerNames, usePlayerNames } from "@/hooks/use-player-profile";`;

  it.each([
    [
      "a typed binding (review 3)",
      hooks,
      "const names: PlayerNames = usePlayerNames();\nreturn useMemo(() => names.text(address), [address]);",
      /missing dependency: 'names'/,
    ],
    [
      "a namespace import of the hooks (review 4)",
      `import { useMemo } from "react";\nimport * as playerProfiles from "@/hooks/use-player-profile";`,
      "const names = playerProfiles.usePlayerNames();\nreturn useMemo(() => names.text(address), [address]);",
      /missing dependency: 'names'/,
    ],
    [
      "a value derived from the reader (review 4)",
      hooks,
      "const names = usePlayerNames();\nconst shown = names.text(address);\nreturn useMemo(() => shown, []);",
      /missing dependency: 'shown'/,
    ],
    [
      "a callback passed by reference (review 4)",
      hooks,
      "const names = usePlayerNames();\nconst line = () => names.text(address);\nreturn useMemo(line, [address]);",
      /missing dependency: 'names'/,
    ],
  ])("reports %s", async (_, head, body, expected) => {
    expect(await reported(head, body)).toEqual([expect.stringMatching(expected)]);
  });

  it("does not see a cache imported under another name (review 4): the design's known gap", async () => {
    const head = `import { useMemo as useCached } from "react";\nimport { usePlayerNames } from "@/hooks/use-player-profile";`;
    expect(
      await reported(head, "const names = usePlayerNames();\nreturn useCached(() => names.text(address), [address]);"),
    ).toEqual([]);
  });
});
