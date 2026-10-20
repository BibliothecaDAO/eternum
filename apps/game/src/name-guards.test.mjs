// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { describe, expect, it } from "vitest";

import { nameGuardConfigs } from "../scripts/name-guards.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const eslint = new ESLint({
  cwd: REPO,
  overrideConfigFile: true,
  overrideConfig: [
    {
      files: ["**/*.{ts,tsx}"],
      languageOptions: { parser: tseslint.parser },
      // As CI's lint guards run: a source's own eslint comments switch nothing off.
      linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: "off" },
    },
    ...nameGuardConfigs,
  ],
});

/** The guards' messages for a source at a real path in the client, as CI's lint guards run them. */
const hits = async (path, source) => {
  const [result] = await eslint.lintText(source, { filePath: resolve(REPO, "apps/game/src", path) });
  // What CI's lint guards count: errors (a warning, such as an inline comment switched off, is not a hit).
  return result.messages.filter((message) => message.fatal || message.severity === 2).map((message) => message.message);
};

const UI = "ui/features/military/battle/battle-lab/zz-guard-fixture.tsx";
const memoOf = (head, read, expression, deps) => `
import { useMemo } from "react";
${head}
export const Line = ({ address }: { address: string }) => {
  ${read}
  return <span>{useMemo(() => ${expression}, [${deps}])}</span>;
};`;

describe("only the imperative consumers import an imperative reader (review-player-name-one-rule-3, finding 2)", () => {
  const memo = (from) =>
    `import { useMemo } from "react";
import { getPlayerDisplayName } from "${from}";
export const Name = () => <span>{useMemo(() => getPlayerDisplayName("0x123"), [])}</span>;`;

  it.each([
    ["the alias", "@/services/identity/player-profiles"],
    ["a relative path", "../../../../../services/identity/player-profiles"],
    ["a path with its extension", "../../../../../services/identity/player-profiles.ts"],
  ])("rejects an import by %s", async (_, from) => {
    expect(await hits(UI, memo(from))).toEqual([expect.stringMatching(/^React code reads a player's name/)]);
  });

  it("rejects the whole module, aliased or renamed", async () => {
    expect(
      await hits(UI, `import * as profiles from "../../../../../services/identity/player-profiles";`),
    ).toHaveLength(1);
    expect(
      await hits(UI, `import { readPlayerName as nameOf } from "@/services/identity/player-profiles";`),
    ).toHaveLength(1);
  });

  it("holds every module to it but the imperative consumers: a service a screen calls, a new folder", async () => {
    const reader = `import { getPlayerDisplayName } from "@/services/identity/player-profiles";\nexport const x = getPlayerDisplayName;`;
    // A service that wraps the reader is how a screen read it stale before (the Faith board's builder).
    expect(await hits("services/leaderboard/zz-guard-fixture.ts", reader)).toHaveLength(1);
    expect(await hits("zz-new-folder/zz-guard-fixture.ts", reader)).toHaveLength(1);
    for (const consumer of [
      "three/managers/zz-guard-fixture.ts",
      "hooks/use-player-profile.ts",
      "services/game-client.ts",
      "sync/fact-views.ts",
    ])
      expect(await hits(consumer, reader), consumer).toEqual([]);
  });
});

describe("a cache that reads a name lists what it read it from (review-player-name-one-rule-3, finding 1)", () => {
  const missing = [expect.stringMatching(/reads a player's name: list it in the dependencies/)];
  const hooks = `import { type PlayerNames, usePlayerDisplayName, usePlayerNames } from "@/hooks/use-player-profile";`;

  it.each([
    ["a plain binding", hooks, "const names = usePlayerNames();", "names.text(address)", "names"],
    ["a typed binding", hooks, "const names: PlayerNames = usePlayerNames();", "names.text(address)", "names"],
    ["a destructured binding", hooks, "const { text } = usePlayerNames();", "text(address)", "text"],
    [
      "an aliased hook",
      `import { usePlayerNames as useNames } from "@/hooks/use-player-profile";`,
      "const names = useNames();",
      "names.text(address)",
      "names",
    ],
    [
      "a relative hooks import",
      `import { usePlayerNames } from "../../../../../hooks/use-player-profile";`,
      "const names = usePlayerNames();",
      "names.text(address)",
      "names",
    ],
    [
      "a value taken from the reader",
      hooks,
      "const names = usePlayerNames(); const say = names.text;",
      "say(address)",
      "say",
    ],
    [
      "a local function that reads it",
      hooks,
      "const names = usePlayerNames(); const line = (a: string) => names.text(a);",
      "line(address)",
      "line",
    ],
    [
      "one player's name",
      hooks,
      'const defender = usePlayerDisplayName("0x1");',
      "`${address} ${defender}`",
      "defender",
    ],
  ])("fails %s left out of the dependencies, and passes it listed", async (_, head, read, expression, dependency) => {
    expect(await hits(UI, memoOf(head, read, expression, "address"))).toEqual(missing);
    expect(await hits(UI, memoOf(head, read, expression, `address, ${dependency}`))).toEqual([]);
  });

  it("holds the live battle's Share text: fixed it passes; typed with its reader left out, it fails", async () => {
    const path = "ui/features/military/battle/battle-lab/battle-lab.tsx";
    const battle = readFileSync(resolve(REPO, "apps/game/src", path), "utf8");
    expect(await hits(path, battle)).toEqual([]);
    // The review's mutant: the reader typed, and dropped from the Share memo's dependencies. Each edit must land.
    const edits = [
      [
        `import { usePlayerNames } from "@/hooks/use-player-profile";`,
        `import { type PlayerNames, usePlayerNames } from "@/hooks/use-player-profile";`,
      ],
      ["const names = usePlayerNames();", "const names: PlayerNames = usePlayerNames();"],
      ["account.address, names, store,", "account.address, store,"],
    ];
    const mutant = edits.reduce((source, [from, to]) => {
      expect(source).toContain(from);
      return source.replace(from, to);
    }, battle);
    expect(await hits(path, mutant)).toEqual(missing);
  });
});
