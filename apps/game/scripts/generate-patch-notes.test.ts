// @vitest-environment node
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, expect, it } from "vitest";

const generator = fileURLToPath(new URL("./generate-patch-notes.mjs", import.meta.url));
const FRONT = '---\ntitle: "Season one"\nsummary: "Frontier opens: a new land."\n---\n';
const RELEASE = `${FRONT}
## All modes

### New

- {move} **The next order**: Give a moving army its next order; it leaves as soon as the first one
  lands.

## Blitz

### Balance

- {wheat} **Wheat on the march**: Moving costs wheat per troop. \`0.03 → 0.05\`

### Fixes

- {move} **Selection holds**: Your army stays selected.
`;

let directory: string;
beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), "patch-notes-contract-"));
  mkdirSync(path.join(directory, "content/patch-notes"), { recursive: true });
  mkdirSync(path.join(directory, "asset-sources/facets"), { recursive: true });
  writeFileSync(
    path.join(directory, "asset-sources/facets/semantic-map.json"),
    JSON.stringify({ move: {}, wheat: {} }),
  );
  writeFileSync(path.join(directory, "content/patch-notes/AGENTS.md"), "# Not a release\n");
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));

const generate = (files: Record<string, string>) => {
  for (const [name, source] of Object.entries(files))
    writeFileSync(path.join(directory, "content/patch-notes", name), source);
  return spawnSync(process.execPath, [generator], { cwd: directory, encoding: "utf8" });
};

const output = () => readFileSync(path.join(directory, "src/shell/generated/patch-notes.ts"), "utf8");
const notesOf = (source: string) =>
  JSON.parse(source.match(/export const patchNotes = ([\s\S]+) as const satisfies readonly PatchNote\[\];\n$/)![1]);

it("reads each release into its sections, newest first, and writes the same file when run again", () => {
  const older = `${FRONT}\n## Eternum\n\n### New\n\n- {move} **Old**: An older change.\n`;
  expect(generate({ "2026-10-29.md": RELEASE, "2026-06-05.md": older }).status).toBe(0);
  const first = output();
  expect(notesOf(first)).toStrictEqual([
    {
      date: "2026-10-29",
      title: "Season one",
      summary: "Frontier opens: a new land.",
      modes: {
        all: [
          {
            kind: "new",
            icon: "move",
            title: "The next order",
            line: "Give a moving army its next order; it leaves as soon as the first one lands.",
          },
        ],
        frontier: [],
        blitz: [
          {
            kind: "balance",
            icon: "wheat",
            title: "Wheat on the march",
            line: "Moving costs wheat per troop.",
            from: "0.03",
            to: "0.05",
          },
          { kind: "fix", icon: "move", title: "Selection holds", line: "Your army stays selected." },
        ],
        eternum: [],
      },
    },
    {
      date: "2026-06-05",
      title: "Season one",
      summary: "Frontier opens: a new land.",
      modes: {
        all: [],
        frontier: [],
        blitz: [],
        eternum: [{ kind: "new", icon: "move", title: "Old", line: "An older change." }],
      },
    },
  ]);
  expect(generate({}).status).toBe(0);
  expect(output()).toBe(first);
});

it.each([
  ["a file not named for a real day", "2026-02-30.md", RELEASE, "named for its day"],
  ["a missing summary", "2026-10-29.md", '---\ntitle: "T"\n---\n', "summary"],
  ["an unknown mode", "2026-10-29.md", RELEASE.replace("## Blitz", "## Duel"), 'unknown mode "Duel"'],
  [
    "modes out of order",
    "2026-10-29.md",
    `${FRONT}\n## Blitz\n\n### New\n\n- {move} **A**: a.\n\n## Frontier\n\n### New\n\n- {move} **B**: b.\n`,
    'mode "Frontier" is out of order',
  ],
  ["an unknown kind", "2026-10-29.md", RELEASE.replace("### Fixes", "### Notes"), 'unknown kind "Notes"'],
  [
    "kinds out of order",
    "2026-10-29.md",
    `${FRONT}\n## Blitz\n\n### Fixes\n\n- {move} **A**: a.\n\n### New\n\n- {move} **B**: b.\n`,
    'kind "New" is out of order',
  ],
  ["an unknown icon", "2026-10-29.md", RELEASE.replace("{wheat}", "{barley}"), 'unknown icon "barley"'],
  ["a change without its name", "2026-10-29.md", RELEASE.replace("**Selection holds**: ", ""), "a change reads"],
  [
    "prose between the changes",
    "2026-10-29.md",
    RELEASE.replace("### Fixes", "Some prose.\n\n### Fixes"),
    "only ## modes",
  ],
])("refuses %s, naming the file", (_, name, source, diagnostic) => {
  const result = generate({ [name]: source });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(`content/patch-notes/${name}`);
  expect(result.stderr).toContain(diagnostic);
});
