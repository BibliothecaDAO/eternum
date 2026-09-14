import { copyFile, mkdir, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  renderGameSection,
  renderIdentitySection,
  renderRulesOfEngagementSection,
  renderSkillsSection,
  renderToolGuideSection,
  type SkillText,
  type ToolGuideEntry,
} from "./prompt";

export interface AgentFiles {
  soul: string;
  skills: SkillText[];
}

interface SystemPromptInput extends AgentFiles {
  gameSummary: string;
  toolGuide: ToolGuideEntry[];
}

/** Re-reads the agent's files on every call, so learnings written mid-game reach the next prompt build. */
export interface SystemPromptSource {
  current(): Promise<string>;
}

export const TEMPLATES_DIR = fileURLToPath(new URL("../templates/", import.meta.url));
const SOUL_FILE = "soul.md";
const SKILLS_DIR = "skills";
const SKILL_FILE = "SKILL.md";

/** The agent's soul and skills from its data dir; a fresh data dir is seeded from the templates first. */
export async function loadAgentFiles(dataDir: string, templatesDir: string = TEMPLATES_DIR): Promise<AgentFiles> {
  await seedMissingAgentFiles(dataDir, templatesDir);
  return {
    soul: await readFile(path.join(dataDir, SOUL_FILE), "utf8"),
    skills: await readSkills(path.join(dataDir, SKILLS_DIR)),
  };
}

export const buildSystemPrompt = (input: SystemPromptInput): string =>
  [
    renderIdentitySection(input.soul),
    renderGameSection(input.gameSummary),
    renderRulesOfEngagementSection(),
    renderSkillsSection(input.skills),
    renderToolGuideSection(input.toolGuide),
  ].join("\n\n");

export const createSystemPromptSource = (input: {
  dataDir: string;
  gameSummary: string;
  toolGuide: ToolGuideEntry[];
  templatesDir?: string;
}): SystemPromptSource => ({
  current: async () =>
    buildSystemPrompt({
      ...(await loadAgentFiles(input.dataDir, input.templatesDir)),
      gameSummary: input.gameSummary,
      toolGuide: input.toolGuide,
    }),
});

/** Seeds file by file, so an agent that already has a soul keeps it and only gains skills it lacks. */
const seedMissingAgentFiles = async (dataDir: string, templatesDir: string): Promise<void> => {
  await seedFile(path.join(templatesDir, SOUL_FILE), path.join(dataDir, SOUL_FILE));
  for (const name of await listSkillNames(path.join(templatesDir, SKILLS_DIR))) {
    await seedFile(
      path.join(templatesDir, SKILLS_DIR, name, SKILL_FILE),
      path.join(dataDir, SKILLS_DIR, name, SKILL_FILE),
    );
  }
};

const seedFile = async (from: string, to: string): Promise<void> => {
  if (await exists(to)) return;
  await mkdir(path.dirname(to), { recursive: true });
  await copyFile(from, to);
};

const readSkills = async (skillsDir: string): Promise<SkillText[]> => {
  const skills: SkillText[] = [];
  for (const name of await listSkillNames(skillsDir)) {
    skills.push({ name, body: await readFile(path.join(skillsDir, name, SKILL_FILE), "utf8") });
  }
  return skills;
};

const listSkillNames = async (skillsDir: string): Promise<string[]> => {
  if (!(await exists(skillsDir))) return [];
  const entries = await readdir(skillsDir, { withFileTypes: true });
  const names: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory() && (await exists(path.join(skillsDir, entry.name, SKILL_FILE)))) names.push(entry.name);
  }
  return names.sort();
};

const exists = (file: string): Promise<boolean> =>
  stat(file).then(
    () => true,
    () => false,
  );
