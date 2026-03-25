/**
 * CLI subcommands under `axis map` — structured queries against the game world.
 *
 * Also registers top-level `axis status` and `axis automation` commands.
 */

import type { Command } from "commander";
import { bootstrap } from "../../entry/bootstrap-runtime.js";

// ── Shared output helpers ─────────────────────────────────────────────

/** Print a tool result (has `success` + `message`) respecting --json. */
function output(result: { success: boolean; message: string }, json: boolean): never {
  if (json) {
    console.log(JSON.stringify(result));
  } else if (result.success) {
    console.log(result.message);
  } else {
    console.error(result.message);
  }
  process.exit(result.success ? 0 : 1);
}

/** Print any structured data respecting --json. */
function outputData(data: unknown, json: boolean): never {
  console.log(json ? JSON.stringify(data) : JSON.stringify(data, null, 2));
  process.exit(0);
}

// ── Map subcommands ───────────────────────────────────────────────────

export function registerMapCommands(program: Command) {
  const map = program.command("map").description("Query the game map");

  map
    .command("briefing")
    .description("Get the current game state briefing")
    .action(async () => {
      const json = !!program.opts().json;
      const { mapCtx, mapLoop } = await bootstrap();
      mapLoop.stop();
      if (!mapCtx.protocol) {
        output({ success: false, message: "Map not loaded." }, json);
      }
      const briefing = mapCtx.protocol!.briefing();
      if (json) {
        console.log(JSON.stringify(briefing, null, 2));
      } else {
        console.log(JSON.stringify(briefing, null, 2));
      }
      process.exit(0);
    });

  map
    .command("tile-info")
    .description("Get detailed info about a map tile")
    .argument("<x>", "X coordinate", Number)
    .argument("<y>", "Y coordinate", Number)
    .action(async (x: number, y: number) => {
      const json = !!program.opts().json;
      const { mapCtx, mapLoop } = await bootstrap();
      mapLoop.stop();
      if (!mapCtx.protocol) {
        output({ success: false, message: "Map not loaded." }, json);
      }
      const result = await mapCtx.protocol!.tileInfo(x, y);
      outputData(result, json);
    });

  map
    .command("nearby")
    .description("Find entities near a position")
    .argument("<x>", "X coordinate", Number)
    .argument("<y>", "Y coordinate", Number)
    .option("--radius <n>", "Search radius in hex tiles", Number, 5)
    .action(async (x: number, y: number, opts: { radius: number }) => {
      const json = !!program.opts().json;
      const { mapCtx, mapLoop } = await bootstrap();
      mapLoop.stop();
      if (!mapCtx.protocol) {
        output({ success: false, message: "Map not loaded." }, json);
      }
      const result = await mapCtx.protocol!.nearby(x, y, opts.radius);
      outputData(result, json);
    });

  map
    .command("entity-info")
    .description("Get detailed info about an entity by ID")
    .argument("<entity-id>", "On-chain entity ID", Number)
    .action(async (entityId: number) => {
      const json = !!program.opts().json;
      const { mapCtx, mapLoop } = await bootstrap();
      mapLoop.stop();
      if (!mapCtx.protocol) {
        output({ success: false, message: "Map not loaded." }, json);
      }
      const result = await mapCtx.protocol!.entityInfo(entityId);
      if (!result) {
        output({ success: false, message: `Entity ${entityId} not found.` }, json);
      }
      outputData(result, json);
    });

  map
    .command("find")
    .description("Find entities by type (hyperstructure, mine, village, chest, enemy_army, etc.)")
    .argument("<type>", "Entity type to search for")
    .option("--ref-x <n>", "Reference X for distance sorting", Number)
    .option("--ref-y <n>", "Reference Y for distance sorting", Number)
    .action(async (type: string, opts: { refX?: number; refY?: number }) => {
      const json = !!program.opts().json;
      const { mapCtx, mapLoop } = await bootstrap();
      mapLoop.stop();
      if (!mapCtx.protocol) {
        output({ success: false, message: "Map not loaded." }, json);
      }
      const ref = opts.refX != null && opts.refY != null ? { x: opts.refX, y: opts.refY } : undefined;
      const result = await mapCtx.protocol!.find(type as any, ref);
      outputData(result, json);
    });

  // ── Top-level: axis status ──────────────────────────────────────────

  program
    .command("status")
    .description("Show account, world, and chain info")
    .action(async () => {
      const json = !!program.opts().json;
      const { config, account, gameConfig, mapCtx, mapLoop } = await bootstrap();
      mapLoop.stop();
      const info = {
        account: account.address,
        chain: config.chain,
        worldName: config.worldName ?? null,
        worldAddress: config.worldAddress,
        rpcUrl: config.rpcUrl,
        toriiUrl: config.toriiUrl,
        mapLoaded: !!mapCtx.snapshot,
        tileCount: mapCtx.snapshot?.tiles.length ?? 0,
        buildings: Object.keys(gameConfig.buildingCosts).length,
        recipes: Object.keys(gameConfig.resourceFactories).length,
      };
      outputData(info, json);
    });

  // ── Top-level: axis automation ──────────────────────────────────────

  program
    .command("automation")
    .description("Automation status (one-shot) or control (persistent mode)")
    .argument("<action>", "'status', 'start', or 'stop'")
    .action(async (action: string) => {
      const json = !!program.opts().json;

      if (action === "start" || action === "stop") {
        output(
          { success: false, message: `${action} only works in persistent mode (axis run).` },
          json,
        );
      }

      if (action !== "status") {
        output({ success: false, message: `Unknown action "${action}". Use: status, start, stop.` }, json);
      }

      // status — bootstrap, print realm data
      const { mapCtx, mapLoop, automationLoop } = await bootstrap();
      mapLoop.stop();

      // Run a single automation tick to populate status
      await automationLoop.refresh();

      const briefing = mapCtx.protocol?.briefing() ?? { error: "Map not loaded." };
      if (json) {
        console.log(JSON.stringify(briefing, null, 2));
      } else {
        console.log(JSON.stringify(briefing, null, 2));
      }
      process.exit(0);
    });
}
