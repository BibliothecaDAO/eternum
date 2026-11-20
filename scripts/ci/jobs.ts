import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type Environment = Record<string, string>;
export interface Step {
  name?: string;
  run?: string;
  uses?: string;
  if?: string;
  env?: Environment;
  with?: Environment;
  "working-directory"?: string;
  shell?: string;
}
interface Job {
  "runs-on"?: string;
  steps: Step[];
  env?: Environment;
  services?: Record<string, { image: string; env: Environment }>;
  defaults?: { run?: { "working-directory"?: string } };
  strategy?: { matrix: Record<string, string[] | Environment[]> };
  uses?: string;
}
interface Workflow {
  jobs: Record<string, Job>;
}
export interface ValidationJob {
  id: string;
  area: string;
  workflow: string;
  matrix: Environment;
  job: Job;
}
export const root = resolve(import.meta.dir, "../..");
const workflow = (path: string): Workflow => Bun.YAML.parse(readFileSync(resolve(root, path), "utf8")) as Workflow;

function matrixRows(matrix: Job["strategy"]): Environment[] {
  if (!matrix) return [{}];
  const entries = Object.entries(matrix.matrix);
  if (entries.length !== 1) throw new Error("Validation matrices must have one axis or an include list");
  const [name, values] = entries[0]!;
  return name === "include" ? (values as Environment[]) : (values as string[]).map((value) => ({ [name]: value }));
}

/** Discover every concrete job the PR's validation aggregate requires. */
export function validationJobs(): ValidationJob[] {
  const validation = workflow(".github/workflows/validation.yml");
  return Object.entries(validation.jobs).flatMap(([area, caller]) => {
    if (!caller.uses) {
      if (area !== "scope" && area !== "validation") throw new Error(`Unmapped validation job: ${area}`);
      return [];
    }
    if (!caller.uses.startsWith("./.github/workflows/"))
      throw new Error(`External validation workflow: ${caller.uses}`);
    return Object.entries(workflow(caller.uses).jobs).flatMap(([name, job]) =>
      matrixRows(job.strategy).map((matrix) => ({
        id: [area, name, ...Object.values(matrix).slice(0, 1)].join("/"),
        area,
        workflow: caller.uses.slice(2),
        matrix,
        job,
      })),
    );
  });
}

export function interpolate(value: string, context: Record<string, Environment>): string {
  return String(value)
    .replace(/\$\{\{\s*(\w+)\.([\w-]+)\s*\}\}/g, (_, group, key) => {
      const resolved = context[group]?.[key];
      if (resolved === undefined) throw new Error(`Unsupported expression: ${group}.${key}`);
      return resolved;
    })
    .replace(/\$\{\{.*?\}\}/g, (expression) => {
      throw new Error(`Unsupported expression: ${expression}`);
    });
}

export function selectedStep(step: Step, matrix: Environment): boolean {
  if (!step.if) return true;
  const match = /^matrix\.(\w+) == '([^']+)'$/.exec(step.if);
  if (!match) throw new Error(`Unsupported validation condition: ${step.if}`);
  return matrix[match[1]!] === match[2];
}

export function stepEnvironment(env: Environment = {}, context: Record<string, Environment>): Environment {
  return Object.fromEntries(Object.entries(env).map(([key, value]) => [key, interpolate(value, context)]));
}

/** Runtime pins belong to the workflow, including a numeric YAML Node major. */
export function runtimePin(step: Step): { name: "node" | "bun"; version: string } | undefined {
  if (step.uses === "actions/setup-node@v4") {
    if (!step.with?.["node-version"]) throw new Error("Node setup requires node-version");
    return { name: "node", version: String(step.with["node-version"]) };
  }
  if (step.uses === "oven-sh/setup-bun@v2") {
    return { name: "bun", version: String(step.with?.["bun-version"] ?? "latest") };
  }
  return undefined;
}

export function runtimeMatches(requested: string, actual: string): boolean {
  if (requested === "latest") return true;
  if (!/^\d+(?:\.\d+){0,2}$/.test(requested)) throw new Error(`Unsupported runtime version: ${requested}`);
  const version = actual.trim().replace(/^v/, "");
  return version === requested || (requested.split(".").length < 3 && version.startsWith(`${requested}.`));
}
