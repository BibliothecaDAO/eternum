import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { access, constants } from "node:fs/promises";
import { dirname } from "node:path";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config";
import { resolveBundledPath } from "./runtime-paths";

const CLI_COMMAND = "axis";
const PAD = "  ";
const AXIS_ASCII_BANNER = [
  "",
  `${PAD} █████╗ ██╗  ██╗██╗███████╗`,
  `${PAD}██╔══██╗╚██╗██╔╝██║██╔════╝`,
  `${PAD}███████║ ╚███╔╝ ██║███████╗`,
  `${PAD}██╔══██║ ██╔██╗ ██║╚════██║`,
  `${PAD}██║  ██║██╔╝ ██╗██║███████║`,
  `${PAD}╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚══════╝`,
  "",
].join("\n");

function readVersion(): string {
  try {
    const packageJsonPath = resolveBundledPath("package.json");
    const raw = readFileSync(packageJsonPath, "utf8");
    const parsed = JSON.parse(raw) as { version?: string };
    return parsed.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function printUsage() {
  console.log(`Usage: ${CLI_COMMAND} [--version|doctor|init|run]`);
}

function printBanner() {
  console.log(AXIS_ASCII_BANNER);
}

async function ensureDirWritable(dirPath: string): Promise<boolean> {
  try {
    mkdirSync(dirPath, { recursive: true });
    await access(dirPath, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

async function runDoctor(): Promise<number> {
  const config = loadConfig();
  const errors: string[] = [];
  const warnings: string[] = [];

  if (config.worldAddress === "0x0") {
    errors.push("WORLD_ADDRESS is unset (currently 0x0)");
  }

  if (!existsSync(config.manifestPath)) {
    errors.push(`MANIFEST_PATH not found: ${config.manifestPath}`);
  }

  if (!(await ensureDirWritable(config.dataDir))) {
    errors.push(`DATA_DIR not writable: ${config.dataDir}`);
  }

  if (!(await ensureDirWritable(config.sessionBasePath))) {
    errors.push(`SESSION_BASE_PATH not writable: ${config.sessionBasePath}`);
  }

  if (config.modelProvider === "anthropic" && !process.env.ANTHROPIC_API_KEY) {
    warnings.push("ANTHROPIC_API_KEY is not set for MODEL_PROVIDER=anthropic");
  }

  if (config.modelProvider === "openai" && !process.env.OPENAI_API_KEY) {
    warnings.push("OPENAI_API_KEY is not set for MODEL_PROVIDER=openai");
  }

  if (errors.length === 0) {
    console.log("Doctor OK: configuration looks valid.");
    if (warnings.length > 0) {
      for (const warning of warnings) {
        console.log(`Warning: ${warning}`);
      }
    }
    return 0;
  }

  console.log("Doctor found configuration issues:");
  for (const error of errors) {
    console.log(`- ${error}`);
  }
  for (const warning of warnings) {
    console.log(`- Warning: ${warning}`);
  }
  return 1;
}

function copyIfMissing(sourcePath: string, destinationPath: string) {
  if (existsSync(destinationPath)) {
    return;
  }
  mkdirSync(dirname(destinationPath), { recursive: true });
  copyFileSync(sourcePath, destinationPath);
}

function seedDataDir(dataDir: string) {
  mkdirSync(dataDir, { recursive: true });

  const bundledDataDir = resolveBundledPath("data");
  if (!existsSync(bundledDataDir)) {
    const fallbackSoul = path.join(dataDir, "soul.md");
    if (!existsSync(fallbackSoul)) {
      writeFileSync(fallbackSoul, "# Soul\n\nYou are Axis, an Eternum onchain agent.\n", "utf8");
    }
    const fallbackTasksDir = path.join(dataDir, "tasks");
    mkdirSync(fallbackTasksDir, { recursive: true });
    const fallbackHeartbeat = path.join(dataDir, "HEARTBEAT.md");
    if (!existsSync(fallbackHeartbeat)) {
      writeFileSync(fallbackHeartbeat, "version: 1\njobs: []\n", "utf8");
    }
    return;
  }

  copyIfMissing(path.join(bundledDataDir, "soul.md"), path.join(dataDir, "soul.md"));
  copyIfMissing(path.join(bundledDataDir, "HEARTBEAT.md"), path.join(dataDir, "HEARTBEAT.md"));

  const bundledTasksDir = path.join(bundledDataDir, "tasks");
  if (existsSync(bundledTasksDir)) {
    const taskFiles = readdirSync(bundledTasksDir).filter((entry) => entry.endsWith(".md"));
    for (const fileName of taskFiles) {
      copyIfMissing(path.join(bundledTasksDir, fileName), path.join(dataDir, "tasks", fileName));
    }
  }
}

function seedEnvFile() {
  const cwdEnvPath = path.resolve(process.cwd(), ".env");
  if (existsSync(cwdEnvPath)) {
    return;
  }

  const bundledExamplePath = resolveBundledPath(".env.example");
  if (existsSync(bundledExamplePath)) {
    copyIfMissing(bundledExamplePath, cwdEnvPath);
    return;
  }

  writeFileSync(
    cwdEnvPath,
    [
      "RPC_URL=http://localhost:5050",
      "TORII_URL=http://localhost:8080",
      "WORLD_ADDRESS=0x0",
      "MANIFEST_PATH=",
      "CHAIN_ID=0x534e5f5345504f4c4941",
      "MODEL_PROVIDER=anthropic",
      "MODEL_ID=claude-sonnet-4-5-20250929",
    ].join("\n") + "\n",
    "utf8",
  );
}

function runInit(): number {
  const config = loadConfig();

  seedDataDir(config.dataDir);
  mkdirSync(config.sessionBasePath, { recursive: true });
  seedEnvFile();

  console.log(`Initialized data directory: ${config.dataDir}`);
  console.log(`Initialized session directory: ${config.sessionBasePath}`);
  console.log(`Initialized env file (if missing): ${path.resolve(process.cwd(), ".env")}`);
  return 0;
}

export async function runCli(args: string[] = process.argv.slice(2)): Promise<number> {
  const [firstArg] = args;

  if (!firstArg || firstArg === "run") {
    printBanner();
    try {
      const { main } = await import("./index");
      await main();
      return 0;
    } catch (error) {
      console.error("Fatal error:", error);
      return 1;
    }
  }

  if (firstArg === "--version" || firstArg === "-v") {
    console.log(readVersion());
    return 0;
  }

  if (firstArg === "doctor") {
    return runDoctor();
  }

  if (firstArg === "init") {
    return runInit();
  }

  if (firstArg === "help" || firstArg === "--help" || firstArg === "-h") {
    printUsage();
    return 0;
  }

  console.error(`Unknown command: ${firstArg}`);
  printUsage();
  return 1;
}

function isDirectExecution(metaUrl: string): boolean {
  if (!process.argv[1]) {
    return false;
  }

  try {
    const currentModulePath = fileURLToPath(metaUrl);
    return path.resolve(process.argv[1]) === path.resolve(currentModulePath);
  } catch {
    return false;
  }
}

if (isDirectExecution(import.meta.url)) {
  runCli().then((code) => {
    process.exit(code);
  });
}
