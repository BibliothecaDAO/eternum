import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { copyFiles, copyFor, fillCopy, FIGURES, loadCopy, type Figures } from "./comeback-copy";

const FILE = `Subject: {left} LORDS left. {daysLeft}.
Preheader: 1 in {goldenOneIn} is golden.
Action: Back to your realm

**Your realm claims {claimLabor} Labor
and {claimEssence} Essence.**

{players} players hunt {pool} LORDS.

{prizes}

> Season 0 ends {endsAt}.

{button}

Bring friends.

[Your link is on your You page.](/profile)
`;

const figures = Object.fromEntries(FIGURES.map((name) => [name, `<${name}>`])) as Figures;

let dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true });
  dirs = [];
});

/** A copy folder holding campaign, D, N and P, with the given files changed or added (null leaves one out). */
function folder(files: Record<string, string | null> = {}) {
  const dir = mkdtempSync(join(tmpdir(), "copy-"));
  dirs.push(dir);
  const all: Record<string, string | null> = {
    campaign: "devcon-s0-comeback\n",
    "D.txt": FILE,
    "N.txt": FILE,
    "P.txt": FILE,
    ...files,
  };
  for (const [name, content] of Object.entries(all)) if (content !== null) writeFileSync(join(dir, name), content);
  return dir;
}

describe("a copy folder", () => {
  it("reads into the words an email says, figures filled in", () => {
    const copy = loadCopy(folder());
    expect(copy.campaign).toBe("devcon-s0-comeback");
    expect(fillCopy(copyFor(copy, "D", false), figures)).toEqual({
      subject: "<left> LORDS left. <daysLeft>.",
      preheader: "1 in <goldenOneIn> is golden.",
      action: "Back to your realm",
      blocks: [
        { kind: "text", style: "bold", text: "Your realm claims <claimLabor> Labor and <claimEssence> Essence." },
        { kind: "text", style: "plain", text: "<players> players hunt <pool> LORDS." },
        { kind: "prizes" },
        { kind: "text", style: "callout", text: "Season 0 ends <endsAt>." },
        { kind: "button" },
        { kind: "text", style: "plain", text: "Bring friends." },
        { kind: "link", text: "Your link is on your You page.", path: "/profile" },
      ],
    });
  });

  it("gives a golden reader the golden file when there is one, and the variant's file otherwise", () => {
    const copy = loadCopy(folder({ "D.golden.txt": FILE.replace("Bring friends.", "Already golden.") }));
    const lastText = (key: "D" | "N", golden: boolean) => fillCopy(copyFor(copy, key, golden), figures).blocks[5];
    expect(lastText("D", true)).toEqual({ kind: "text", style: "plain", text: "Already golden." });
    expect(lastText("D", false)).toEqual({ kind: "text", style: "plain", text: "Bring friends." });
    expect(lastText("N", true)).toEqual({ kind: "text", style: "plain", text: "Bring friends." });
    expect(copyFiles(copy).map(({ key, golden }) => `${key}${golden ? " golden" : ""}`)).toEqual([
      "D",
      "D golden",
      "N",
      "P",
    ]);
  });

  it.each([
    ["an unknown placeholder", { "N.txt": FILE.replace("{pool}", "{pot}") }, "copy N.txt: unknown placeholder {pot}"],
    ["a stray brace", { "P.txt": FILE.replace("{pool}", "{pool") }, "copy P.txt: stray brace"],
    ["a missing variant file", { "P.txt": null }, "copy: missing file P.txt"],
    ["a missing campaign file", { campaign: null }, "copy: missing file campaign"],
    ["an unknown file", { "D.gold.txt": FILE }, "copy: unknown file D.gold.txt"],
    ["a campaign key that is not plain", { campaign: "x'; DROP" }, "copy campaign: lowercase letters"],
    ["a missing header", { "D.txt": FILE.replace(/^Action: .*\n/m, "") }, "copy D.txt: missing Action header"],
    ["an unknown header", { "D.txt": FILE.replace("Action:", "Button:") }, "copy D.txt: the first lines are"],
    ["no button", { "D.txt": FILE.replace("{button}", "Go.") }, "copy D.txt: needs exactly one {button}"],
    ["two buttons", { "D.txt": `${FILE}\n{button}\n` }, "copy D.txt: needs exactly one {button}"],
    ["a button inside a sentence", { "D.txt": `${FILE}\nPress {button}.\n` }, "unknown placeholder {button}"],
    ["an inline link", { "D.txt": `${FILE}\nSee [here](/profile).\n` }, "copy D.txt: unsupported markup"],
  ])("refuses %s before anything is sent", (_, files, message) => {
    expect(() => loadCopy(folder(files))).toThrow(message);
  });

  it("refuses a placeholder whose figure has no value", () => {
    const copy = loadCopy(folder());
    const { players: _, ...withoutPlayers } = figures;
    expect(() => fillCopy(copyFor(copy, "P", false), withoutPlayers as Figures)).toThrow(
      "copy P.txt: {players} has no value",
    );
  });
});
