export function normalizeVitestTargetArgs(args) {
  if (args.length > 0 && args[0] === "--") {
    return args.slice(1);
  }

  return [...args];
}
