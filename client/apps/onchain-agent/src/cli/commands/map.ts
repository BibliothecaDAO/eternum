import type { Command } from "commander";

export function registerMapCommands(program: Command) {
  const map = program.command("map").description("Query the game map");

  map
    .command("briefing")
    .description("Get the current game state briefing")
    .action(async () => {
      console.log("axis map briefing — not yet implemented");
    });
}
