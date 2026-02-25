export type Command = "run" | "worlds" | "auth" | "auth-complete" | "auth-status" | "auth-url" | "doctor" | "init" | "version" | "help" | "unknown";
export type AuthMode = "session" | "privatekey";
export type Verbosity = "quiet" | "actions" | "decisions" | "all";

export interface CliOptions {
  command: Command;
  world?: string;
  headless: boolean;
  json: boolean;
  auth: AuthMode;
  verbosity: Verbosity;
  apiPort?: number;
  apiHost?: string;
  stdin: boolean;
  all: boolean;
  approve: boolean;
  method?: string;
  username?: string;
  password?: string;
  callbackUrl?: string;
  timeout?: number;
  sessionData?: string;
  redirectUrl?: string;
  rawArgs: string[];
}

const COMMANDS = new Set<Command>(["run", "worlds", "auth", "auth-complete", "auth-status", "auth-url", "doctor", "init"]);

const VALID_VERBOSITIES = new Set<Verbosity>(["quiet", "actions", "decisions", "all"]);

function extractFlag(args: string[], flag: string): string | undefined {
  const eqPrefix = `--${flag}=`;
  const eqArg = args.find((a) => a.startsWith(eqPrefix));
  if (eqArg) return eqArg.slice(eqPrefix.length);
  const idx = args.indexOf(`--${flag}`);
  if (idx !== -1 && idx + 1 < args.length && !args[idx + 1].startsWith("--")) {
    return args[idx + 1];
  }
  return undefined;
}

function hasFlag(args: string[], flag: string): boolean {
  return args.some((a) => a === `--${flag}` || a.startsWith(`--${flag}=`));
}

export function parseCliArgs(args: string[]): CliOptions {
  const firstArg = args[0] ?? "";
  let command: Command = "run";
  let positionalWorld: string | undefined;

  if (firstArg === "--version" || firstArg === "-v") {
    command = "version";
  } else if (firstArg === "--help" || firstArg === "-h" || firstArg === "help") {
    command = "help";
  } else if (COMMANDS.has(firstArg as Command)) {
    command = firstArg as Command;
    if (["auth", "auth-complete", "auth-status", "auth-url"].includes(command)) {
      const secondArg = args[1];
      if (secondArg && !secondArg.startsWith("--")) {
        positionalWorld = secondArg;
      }
    }
  } else if (firstArg && !firstArg.startsWith("--")) {
    command = "unknown";
  }

  const world = extractFlag(args, "world") ?? positionalWorld;
  const apiPortStr = extractFlag(args, "api-port");
  const authStr = extractFlag(args, "auth");
  const verbStr = extractFlag(args, "verbosity") as Verbosity | undefined;

  return {
    command,
    world,
    headless: hasFlag(args, "headless"),
    json: hasFlag(args, "json"),
    auth: authStr === "privatekey" ? "privatekey" : "session",
    verbosity: verbStr && VALID_VERBOSITIES.has(verbStr) ? verbStr : "decisions",
    apiPort: apiPortStr ? parseInt(apiPortStr, 10) : undefined,
    apiHost: extractFlag(args, "api-host"),
    stdin: hasFlag(args, "stdin"),
    all: hasFlag(args, "all"),
    approve: hasFlag(args, "approve"),
    method: extractFlag(args, "method"),
    username: extractFlag(args, "username"),
    password: extractFlag(args, "password"),
    callbackUrl: extractFlag(args, "callback-url"),
    timeout: extractFlag(args, "timeout") ? parseInt(extractFlag(args, "timeout")!, 10) : undefined,
    sessionData: extractFlag(args, "session-data"),
    redirectUrl: extractFlag(args, "redirect-url"),
    rawArgs: args,
  };
}
