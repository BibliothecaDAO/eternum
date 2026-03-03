import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { access, constants } from "node:fs/promises";
import { dirname } from "node:path";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config";
import { parseCliArgs } from "./cli-args";
import { embeddedData, embeddedEnvExample } from "./embedded-data";
import { loadEnvFiles } from "./env-loader";

declare const BUILD_VERSION: string;
import { runWorlds } from "./commands/worlds";
import { runAuth } from "./commands/auth";

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
  return BUILD_VERSION;
}

function printUsage() {
  console.log(`Usage: ${CLI_COMMAND} <command> [options]

Commands:
  run                       Run agent (TUI mode, default)
  run --headless            Run agent headlessly with JSON output
  worlds                    List discovered worlds
  auth <world|--all>        Generate auth URL and persist artifacts
  auth <world> --status     Check session validity
  auth <world> --redirect-url=<url>  Complete auth with redirect URL
  auth <world> --session-data=<b64>  Complete auth with session data
  auth <world> --method=password      Direct password auth (no browser)
  doctor                    Check configuration
  init                      Initialize data directories

Auth options:
  --status                  Check session validity
  --callback-url=<url>      Public URL for auth callback (remote VPS)
  --redirect-url=<url>      Paste redirect URL to complete auth offline
  --session-data=<base64>   Raw session data to complete auth
  --method=password         Password auth (no browser needed)
  --username=<user>         Username for password auth
  --password=<pass>         Password for password auth
  --all                     Apply to all discovered worlds

Run options:
  --headless                Headless mode (no TUI)
  --world=<name>            Target world
  --auth=session|privatekey Auth strategy (default: session)
  --api-port=<port>         Enable HTTP API
  --api-host=<host>         API bind address (default: 127.0.0.1)
  --stdin                   Enable stdin steering
  --verbosity=<level>       Output verbosity (quiet|actions|decisions|all)

General:
  --json                    JSON output
  --version, -v             Print version
  --help, -h                Print this help`);
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

function writeIfMissing(destinationPath: string, content: string) {
  if (existsSync(destinationPath)) {
    return;
  }
  mkdirSync(dirname(destinationPath), { recursive: true });
  writeFileSync(destinationPath, content, "utf8");
}

export function seedDataDir(dataDir: string) {
  mkdirSync(dataDir, { recursive: true });

  for (const [relativePath, content] of Object.entries(embeddedData)) {
    writeIfMissing(path.join(dataDir, relativePath), content);
  }
}

function seedEnvFile(): string {
  const globalEnvPath = path.join(homedir(), ".eternum-agent", ".env");
  if (existsSync(globalEnvPath)) {
    return globalEnvPath;
  }
  mkdirSync(dirname(globalEnvPath), { recursive: true });
  writeFileSync(globalEnvPath, embeddedEnvExample, "utf8");
  return globalEnvPath;
}

function runInit(world?: string): number {
  const config = loadConfig();

  // Seed base data dir
  seedDataDir(config.dataDir);

  // If a world is specified, also seed the world-scoped data dir
  // (this is where the agent actually reads at runtime)
  if (world) {
    const worldDataDir = path.join(config.dataDir, world);
    seedDataDir(worldDataDir);
    console.log(`Initialized world data directory: ${worldDataDir}`);
  }

  mkdirSync(config.sessionBasePath, { recursive: true });
  const envPath = seedEnvFile();

  console.log(`Initialized data directory: ${config.dataDir}`);
  console.log(`Initialized session directory: ${config.sessionBasePath}`);
  console.log(`Initialized config file: ${envPath}`);
  console.log(`\nNext: edit ${envPath} and set your ANTHROPIC_API_KEY (or OPENAI_API_KEY)`);
  return 0;
}

export async function runCli(args: string[] = process.argv.slice(2)): Promise<number> {
  // Ensure ~/.eternum-agent/.env exists (no-op if already there), then load it
  seedEnvFile();
  loadEnvFiles();

  const opts = parseCliArgs(args);
  const write = (s: string) => console.log(s);

  switch (opts.command) {
    case "version":
      console.log(readVersion());
      return 0;

    case "help":
      printUsage();
      return 0;

    case "doctor":
      return runDoctor();

    case "init":
      return runInit(opts.world);

    case "worlds":
      return runWorlds({ json: opts.json, write });

    case "auth":
      return runAuth({
        world: opts.world,
        status: opts.status,
        all: opts.all,
        method: opts.method,
        username: opts.username,
        password: opts.password,
        callbackUrl: opts.callbackUrl,
        timeout: opts.timeout,
        redirectUrl: opts.redirectUrl,
        sessionData: opts.sessionData,
        json: opts.json,
        write,
      });

    case "run":
      if (opts.headless) {
        if (!opts.world) {
          console.error("--world=<name> is required for headless mode. Run 'axis auth <world>' first.");
          return 1;
        }
        try {
          const { mainHeadless } = await import("./headless");
          await mainHeadless(opts);
          return 0;
        } catch (error) {
          console.error("Fatal error:", error);
          return 1;
        }
      }
      printBanner();
      try {
        const { main } = await import("./index");
        await main();
        return 0;
      } catch (error) {
        console.error("Fatal error:", error);
        return 1;
      }

    default:
      console.error(`Unknown command: ${args[0]}`);
      printUsage();
      return 1;
  }
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
