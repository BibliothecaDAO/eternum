import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { buildSystemPrompt, loadAgentFiles, TEMPLATES_DIR } from "./soul";

const dataDirs: string[] = [];

afterEach(async () => {
  await Promise.all(dataDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const freshDataDir = async (): Promise<string> => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "agent-soul-"));
  dataDirs.push(dataDir);
  return dataDir;
};

describe("agent files", () => {
  it("seeds the soul and the three starter skills into a fresh data dir, each under 60 lines", async () => {
    const dataDir = await freshDataDir();

    const files = await loadAgentFiles(dataDir);

    expect(files.soul).toContain("# Soul");
    expect(files.skills.map((skill) => skill.name)).toEqual([
      "defending-a-rush",
      "early-game-opening",
      "resource-trading",
    ]);
    expect(await readdir(path.join(dataDir, "skills"))).toHaveLength(3);
    for (const skill of files.skills) {
      expect(skill.body.split("\n").length, skill.name).toBeLessThanOrEqual(60);
      expect(skill.body, skill.name).toMatch(/observe_game|act|simulate/);
    }
    expect((await readFile(path.join(TEMPLATES_DIR, "soul.md"), "utf8")).split("\n").length).toBeLessThanOrEqual(60);
  });

  it("keeps an edited soul on later loads and only fills in missing skills", async () => {
    const dataDir = await freshDataDir();
    await loadAgentFiles(dataDir);
    await writeFile(path.join(dataDir, "soul.md"), "# Soul\n\nI raid at dawn.\n");
    await rm(path.join(dataDir, "skills", "resource-trading"), { recursive: true });

    const files = await loadAgentFiles(dataDir);

    expect(files.soul).toBe("# Soul\n\nI raid at dawn.\n");
    expect(files.skills.map((skill) => skill.name)).toContain("resource-trading");
  });

  it("renders the identity, game, rules, skills, and tool guide in order", async () => {
    const dataDir = await freshDataDir();
    const files = await loadAgentFiles(dataDir);

    const prompt = buildSystemPrompt({
      ...files,
      gameSummary: 'Game 1 "blitz-fresh-01" (blitz) on the madara chain.',
      toolGuide: [{ name: "observe_game", description: "A compact summary." }],
    });

    const order = [
      "# Who I am",
      "# The game",
      'Game 1 "blitz-fresh-01"',
      "# Rules of engagement",
      "Never invent entity ids",
      "<skills>",
      '<skill name="defending-a-rush">',
      "</skills>",
      "# Tools",
      "- observe_game: A compact summary.",
    ].map((needle) => prompt.indexOf(needle));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((left, right) => left - right));
  });
});
