// M0 "Pi runtime smoke": one prompt, one tool, one steer() through pi-agent-core.
// Env: OPENROUTER_API_KEY (required unless --offline), OPENROUTER_MODEL (default below).
import { getEnvApiKey, getModels, type Model } from "@mariozechner/pi-ai";
import { fakeStreamFn } from "./fake-stream";
import { buildAgent, runSmoke, type SmokeReport } from "./smoke-agent";

const DEFAULT_MODEL_ID = "openai/gpt-4o-mini";

async function main(): Promise<void> {
  const offline = process.argv.includes("--offline");
  if (!offline) requireOpenRouterKey();
  const agent = buildAgent(resolveModel(), offline ? fakeStreamFn : undefined);
  const report = await runSmoke(agent);
  writeManifest(report, offline);
}

function resolveModel(): Model<any> {
  const modelId = process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL_ID;
  const model = getModels("openrouter").find((candidate) => candidate.id === modelId);
  if (!model) fail(`Unknown OpenRouter model '${modelId}'. Set OPENROUTER_MODEL to an id from pi-ai's registry.`);
  return model;
}

// pi-ai reads OPENROUTER_API_KEY itself; we only check it is present so the failure is loud and early.
function requireOpenRouterKey(): void {
  if (getEnvApiKey("openrouter")) return;
  fail("OPENROUTER_API_KEY is not set. Export it for a live run, or pass --offline to use the scripted model.");
}

function writeManifest(report: SmokeReport, offline: boolean): void {
  const manifest = {
    event: "agent_runner_smoke",
    mode: offline ? "offline" : "live",
    turns: report.turns,
    toolCalls: report.toolCalls,
    steered: report.steered,
    usage: report.usage,
    rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
  };
  console.log(JSON.stringify(manifest));
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

await main();
