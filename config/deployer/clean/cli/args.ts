export type CliArgs = Record<string, string>;

export function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = {};
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    const value = next && !next.startsWith("--") ? argv[++index] : "true";
    out[key] = value;
  }
  return out;
}

export function resolveOptionalArg(args: CliArgs, flag: string, envKeys: string[]): string | undefined {
  const fromFlag = args[flag];
  if (fromFlag) return fromFlag;

  for (const envKey of envKeys) {
    const value = process.env[envKey];
    if (value) return value;
  }
}
