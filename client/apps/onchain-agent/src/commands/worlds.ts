import { discoverAllWorlds } from "../world/discovery";

interface WorldsOptions {
  json: boolean;
  write: (s: string) => void;
}

export async function runWorlds(options: WorldsOptions): Promise<number> {
  const worlds = await discoverAllWorlds();

  if (options.json) {
    options.write(JSON.stringify(worlds, null, 2));
    return 0;
  }

  if (worlds.length === 0) {
    options.write("No active worlds found.\n");
    return 0;
  }

  options.write("Discovered worlds:\n");
  for (const world of worlds) {
    options.write(`  [${world.chain}] ${world.name} (${world.status})\n`);
  }
  return 0;
}
