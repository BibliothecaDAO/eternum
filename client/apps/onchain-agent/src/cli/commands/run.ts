import type { Command } from "commander";
import { main } from "../../entry/main.js";

export function registerRunCommand(program: Command) {
  program
    .command("run")
    .description("Start the autonomous agent loop")
    .action(async () => {
      await main();
    });
}
