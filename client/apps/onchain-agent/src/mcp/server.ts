/**
 * MCP server exposing the full Eternum agent toolkit (22 tools).
 *
 * Architecture: register tools -> connect stdio transport (instant handshake)
 * -> bootstrap in background (discover world -> authenticate -> load config ->
 * start map loop) -> tools become operational.
 *
 * Setup:
 *   `claude mcp add eternum -- npx tsx client/apps/onchain-agent/dev/scripts/mcp-server.ts`
 *
 * Requires `.env` in `client/apps/onchain-agent/` with at minimum:
 *   `CHAIN=slot`
 *   `WORLD_NAME=<world>`
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { bootstrap } from "../entry/bootstrap-runtime.js";
import { createAutomationLoop } from "../automation/loop.js";
import type { AutomationStatusMap } from "../automation/status.js";
import type { MapContext } from "../map/context.js";
import type { ToolContext } from "../tools/core/context.js";
import type { GameConfig } from "@bibliothecadao/torii";
import type { EternumClient } from "@bibliothecadao/client";
import type { EternumProvider } from "@bibliothecadao/provider";
import {
  moveArmy,
  attackTarget,
  createArmy,
  simulateAttack,
  guardFromStorage,
  guardFromArmy,
  unguardToArmy,
  openChest,
  attackFromGuard,
  raidTarget,
  reinforceArmy,
  applyRelic,
  sendResources,
  transferToStructure,
  transferToArmy,
  transferTroops,
} from "../tools/core/index.js";

// ── Redirect ALL console output to stderr ──
// MCP protocol owns stdout. Any stray console.log (e.g. Cartridge SDK
// printing an auth URL) would corrupt the JSON-RPC stream. Redirect
// everything to stderr so auth URLs appear in the MCP server logs.
{
  const providerNoise = (msg: string) =>
    msg.includes("[provider]") || msg.includes("Failed to estimate") || msg.includes("Insufficient transaction");
  const toStderr = (...a: any[]) => process.stderr.write(a.map(String).join(" ") + "\n");
  console.log = toStderr;
  console.info = toStderr;
  console.debug = toStderr;
  console.warn = (...a: any[]) => {
    if (!providerNoise(String(a[0]))) toStderr(...a);
  };
  console.error = (...a: any[]) => {
    if (!providerNoise(String(a[0]))) toStderr(...a);
  };
}

/** Log to stderr with `[eternum-mcp]` prefix. MCP owns stdout. */
const log = (msg: string) => process.stderr.write(`[eternum-mcp] ${msg}\n`);

/**
 * Start the MCP server: register all tools, connect the stdio transport
 * (instant handshake), then bootstrap the game connection in the background.
 * Tools return "not ready" until bootstrap completes.
 */
export async function startMcpServer(): Promise<void> {
  log("Starting...");

  // ── Mutable state — filled by background bootstrap ──
  let client: EternumClient | null = null;
  let provider: EternumProvider | null = null;
  let account: any = null;
  let playerAddress = "";
  let gameConfig: GameConfig | null = null;
  let mapCenter = 0;
  let donkeyCapacityGrams = 50_000;
  const resourceWeightGrams = new Map<number, number>();

  const mapCtx: MapContext = { snapshot: null, protocol: null, filePath: null };
  const automationStatus: AutomationStatusMap = new Map();
  let automationLoop: ReturnType<typeof createAutomationLoop> | null = null;
  let automationRunning = false;
  let bootstrapDone = false;
  let bootstrapError: string | null = null;
  let bootstrapPhase = "starting";
  let authUrl: string | null = null;

  /** Return an error string if the server isn't ready, or null if good to go. */
  const notReady = (): string | null => {
    if (bootstrapError) return `Server failed to start: ${bootstrapError}`;
    if (!bootstrapDone) {
      if (authUrl) return `Waiting for authentication. [Click here to login](${authUrl}), then retry.`;
      return `Server is ${bootstrapPhase}. Please wait a moment and retry.`;
    }
    return null;
  };

  /** Build a ToolContext from the mutable bootstrap state, or null if not ready. */
  const getCtx = (): ToolContext | null => {
    if (!client || !provider || !account || !gameConfig || !mapCtx.snapshot) return null;
    return {
      client,
      provider,
      signer: account,
      playerAddress,
      gameConfig,
      snapshot: mapCtx.snapshot,
      mapCenter,
      donkeyCapacityGrams,
      resourceWeightGrams,
    };
  };

  /** Thin MCP adapter: readiness check -> build context -> call core -> format response. */
  const mcpCall = async <I, R extends { success: boolean; message: string }>(
    fn: (input: I, ctx: ToolContext) => Promise<R>,
    input: I,
  ): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> => {
    const err = notReady();
    if (err) return { content: [{ type: "text", text: err }], isError: true };
    const ctx = getCtx();
    if (!ctx) return { content: [{ type: "text", text: "Map not loaded yet." }], isError: true };
    try {
      const result = await fn(input, ctx);
      return { content: [{ type: "text", text: result.message }], isError: !result.success };
    } catch (e: any) {
      return { content: [{ type: "text", text: e.message ?? String(e) }], isError: true };
    }
  };

  // ── MCP Server + Tool Registration ──
  // Register tools BEFORE connecting the transport so the handshake
  // completes immediately. Tools gate on notReady() / mapCtx checks.
  //
  // Tools (22):
  //   Status:     status
  //   Map:        map_tile_info, map_nearby, map_entity_info, map_find, map_briefing
  //   Automation: automation
  //   Movement:   move_army
  //   Combat:     simulate_attack, attack_target, attack_from_guard, raid_target
  //   Army Mgmt:  create_army, open_chest
  //   Resources:  send_resources
  //   Guards:     guard_from_storage, guard_from_army, reinforce_army,
  //               transfer_troops, unguard_to_army
  //   Transfers:  transfer_to_structure, transfer_to_army
  //   Buffs:      apply_relic
  const server = new McpServer({ name: "eternum", version: "1.0.0" });

  // ── Status Tool (always works, even before bootstrap) ──

  server.tool(
    "status",
    "Check server status. If not authenticated yet, returns a login link. Call this first.",
    {},
    async () => {
      if (bootstrapError) return { content: [{ type: "text", text: `Failed: ${bootstrapError}` }], isError: true };
      if (authUrl) {
        const { exec } = await import("node:child_process");
        exec(`echo ${JSON.stringify(authUrl)} | pbcopy`);
        return { content: [{ type: "text", text: "Auth URL copied to clipboard. Paste in your browser to login." }] };
      }
      if (!bootstrapDone) return { content: [{ type: "text", text: `Starting up (${bootstrapPhase})...` }] };
      return { content: [{ type: "text", text: `Ready. Account: ${playerAddress}` }] };
    },
  );

  // ── Map Protocol Tools ──
  // The protocol handles coordinate conversion (display <-> raw) internally.
  // Tools pass display coords directly — small numbers like (6,-4).

  server.tool(
    "map_tile_info",
    "What's at this position? Full details: biome, entity, guards, resources, strength.",
    { x: z.coerce.number().describe("Map X coordinate"), y: z.coerce.number().describe("Map Y coordinate") },
    async ({ x, y }) => {
      if (!mapCtx.protocol) return { content: [{ type: "text", text: notReady() ?? "Map not loaded yet." }] };
      const r = await mapCtx.protocol.tileInfo(x, y);
      return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }] };
    },
  );

  server.tool(
    "map_nearby",
    "What's around this position? Returns grouped lists: your armies, enemies, structures, chests.",
    {
      x: z.coerce.number().describe("Map X coordinate"),
      y: z.coerce.number().describe("Map Y coordinate"),
      radius: z.coerce.number().optional().default(5).describe("Search radius in hexes"),
    },
    async ({ x, y, radius }) => {
      if (!mapCtx.protocol) return { content: [{ type: "text", text: notReady() ?? "Map not loaded yet." }] };
      const r = await mapCtx.protocol.nearby(x, y, radius);
      return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }] };
    },
  );

  server.tool(
    "map_entity_info",
    "Full details on an entity by ID: troops, stamina, guards, resources, strength, owner.",
    { entity_id: z.coerce.number().describe("Entity ID") },
    async ({ entity_id }) => {
      if (!mapCtx.protocol) return { content: [{ type: "text", text: notReady() ?? "Map not loaded yet." }] };
      const r = await mapCtx.protocol.entityInfo(entity_id);
      if (!r) return { content: [{ type: "text", text: `Entity ${entity_id} not found.` }], isError: true };
      return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }] };
    },
  );

  server.tool(
    "map_find",
    "Find entities by type across the map. Types: hyperstructure, mine, village, chest, enemy_army, enemy_structure, own_army, own_structure. Sorted by distance from ref position.",
    {
      type: z.enum([
        "hyperstructure",
        "mine",
        "village",
        "chest",
        "enemy_army",
        "enemy_structure",
        "own_army",
        "own_structure",
      ]),
      ref_x: z.coerce.number().optional().describe("Reference X for distance sorting"),
      ref_y: z.coerce.number().optional().describe("Reference Y for distance sorting"),
    },
    async ({ type, ref_x, ref_y }) => {
      if (!mapCtx.protocol) return { content: [{ type: "text", text: notReady() ?? "Map not loaded yet." }] };
      const ref = ref_x != null && ref_y != null ? { x: ref_x, y: ref_y } : undefined;
      const r = await mapCtx.protocol.find(type, ref);
      return { content: [{ type: "text", text: JSON.stringify(r, null, 2) }] };
    },
  );

  server.tool(
    "map_briefing",
    "Get the current game state briefing: your armies, structures, threats, opportunities.",
    {},
    async () => {
      if (!mapCtx.protocol) return { content: [{ type: "text", text: notReady() ?? "Map not loaded yet." }] };
      return { content: [{ type: "text", text: JSON.stringify(mapCtx.protocol.briefing(), null, 2) }] };
    },
  );

  // ── Automation Tools ──

  server.tool(
    "automation",
    "Toggle the background automation system (building, upgrading, production for all realms). " +
      "Use action='status' to check, 'start' to enable, 'stop' to disable.",
    { action: z.enum(["start", "stop", "status"]).describe("start, stop, or status") },
    async ({ action }) => {
      const err = notReady();
      if (err) return { content: [{ type: "text", text: err }] };

      if (action === "status") {
        const lines: string[] = [`Automation: ${automationRunning ? "RUNNING" : "STOPPED"}`];
        if (automationStatus.size > 0) {
          for (const s of automationStatus.values()) {
            const errs = s.errors.length > 0 ? ` | ERRORS: ${s.errors.join("; ")}` : "";
            const built = s.lastBuilt.length > 0 ? ` | built: ${s.lastBuilt.join(", ")}` : "";
            lines.push(
              `  ${s.name} | lv${s.level} | build ${s.buildOrderProgress} | Wheat: ${s.wheatBalance}, Essence: ${s.essenceBalance}${built}${errs}`,
            );
          }
        } else {
          lines.push("  No realm data yet.");
        }
        return { content: [{ type: "text", text: lines.join("\n") }] };
      }

      if (action === "start") {
        if (automationRunning) return { content: [{ type: "text", text: "Automation is already running." }] };
        automationLoop!.start();
        automationRunning = true;
        log("Automation started.");
        return {
          content: [
            {
              type: "text",
              text: "Automation started. Building, upgrading, and production will run every 60s for all owned realms.",
            },
          ],
        };
      }

      if (action === "stop") {
        if (!automationRunning) return { content: [{ type: "text", text: "Automation is already stopped." }] };
        automationLoop!.stop();
        automationRunning = false;
        log("Automation stopped.");
        return { content: [{ type: "text", text: "Automation stopped." }] };
      }

      return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
    },
  );

  // ── Movement Tools ──

  server.tool(
    "move_army",
    "Move one of your armies to a target position. Pathfinds automatically. Explores unexplored tiles.",
    {
      army_id: z.coerce.number().describe("Entity ID of your army"),
      target_x: z.coerce.number().describe("Target map X"),
      target_y: z.coerce.number().describe("Target map Y"),
    },
    async ({ army_id, target_x, target_y }) =>
      mcpCall(moveArmy, { armyId: army_id, targetX: target_x, targetY: target_y }),
  );

  // ── Combat Tools ──

  server.tool(
    "simulate_attack",
    "Preview a battle outcome WITHOUT executing it. Shows predicted casualties, winner, and biome advantage. " +
      "Use this before attack_target to decide whether to commit. " +
      "NOTE: Larger armies are disproportionately stronger due to combat scaling.",
    {
      army_id: z.coerce.number().describe("Entity ID of your army"),
      target_x: z.coerce.number().describe("Target map X"),
      target_y: z.coerce.number().describe("Target map Y"),
    },
    async ({ army_id, target_x, target_y }) =>
      mcpCall(simulateAttack, { armyId: army_id, targetX: target_x, targetY: target_y }),
  );

  server.tool(
    "attack_target",
    "Attack a target adjacent to your army. Reports battle outcome including casualties. " +
      "NOTE: Larger armies are disproportionately stronger due to combat scaling — always attack with your biggest army. " +
      "Use simulate_attack first to preview the outcome before committing.",
    {
      army_id: z.coerce.number().describe("Entity ID of your army"),
      target_x: z.coerce.number().describe("Target map X"),
      target_y: z.coerce.number().describe("Target map Y"),
    },
    async ({ army_id, target_x, target_y }) =>
      mcpCall(attackTarget, { armyId: army_id, targetX: target_x, targetY: target_y }),
  );

  server.tool(
    "attack_from_guard",
    "Attack an adjacent enemy army using your structure's guards. Defensive strike — no army needed. " +
      "NOTE: Larger groups in one slot are disproportionately stronger.",
    {
      structure_id: z.coerce.number().describe("Entity ID of your structure"),
      slot: z.coerce
        .number()
        .min(0)
        .max(3)
        .describe("Guard slot to attack with (0=Alpha, 1=Bravo, 2=Charlie, 3=Delta)"),
      target_army_id: z.coerce.number().describe("Entity ID of the enemy army to attack"),
    },
    async ({ structure_id, slot, target_army_id }) =>
      mcpCall(attackFromGuard, { structureId: structure_id, slot, targetArmyId: target_army_id }),
  );

  server.tool(
    "raid_target",
    "Raid an adjacent structure for resources. Deals only 10% of normal battle damage but can steal loot on success. " +
      "Success if your damage > 2x defender's, fail if < 0.5x, chance-based in between. " +
      "NOTE: Larger armies are disproportionately stronger.",
    {
      army_id: z.coerce.number().describe("Entity ID of your raiding army"),
      target_x: z.coerce.number().describe("Target structure map X"),
      target_y: z.coerce.number().describe("Target structure map Y"),
      steal_resources: z
        .array(
          z.object({
            resource_id: z.coerce.number().describe("Resource type ID to steal"),
            amount: z.coerce.number().describe("Amount to steal (human-readable)"),
          }),
        )
        .optional()
        .default([])
        .describe("Resources to steal on success"),
    },
    async ({ army_id, target_x, target_y, steal_resources }) =>
      mcpCall(raidTarget, {
        armyId: army_id,
        targetX: target_x,
        targetY: target_y,
        stealResources: steal_resources?.map((r: any) => ({ resourceId: r.resource_id, amount: r.amount })) ?? [],
      }),
  );

  // ── Army Management Tools ──

  server.tool(
    "create_army",
    "Create a new army at one of your realms. Auto-selects troop type by biome. " +
      "NOTE: Larger armies are disproportionately stronger — 1 army of 2000 beats 2 armies of 1000. Prefer fewer, bigger armies.",
    {
      structure_id: z.coerce.number().describe("Entity ID of your realm"),
      troop_type: z.enum(["Knight", "Paladin", "Crossbowman"]).optional().describe("Override troop type"),
      tier: z.coerce.number().min(1).max(3).optional().default(1).describe("Troop tier (1-3)"),
      amount: z.coerce.number().optional().describe("Number of troops (default: all available, max 10000)"),
    },
    async ({ structure_id, troop_type, tier, amount }) =>
      mcpCall(createArmy, { structureId: structure_id, troopType: troop_type, tier, amount }),
  );

  server.tool(
    "open_chest",
    "Open a chest adjacent to your army for relics and victory points.",
    {
      army_id: z.coerce.number().describe("Entity ID of your army"),
      chest_x: z.coerce.number().describe("Chest map X"),
      chest_y: z.coerce.number().describe("Chest map Y"),
    },
    async ({ army_id, chest_x, chest_y }) => mcpCall(openChest, { armyId: army_id, chestX: chest_x, chestY: chest_y }),
  );

  // ── Resource Transfer Tools ──

  server.tool(
    "send_resources",
    "Transfer resources between your structures via donkey caravan. " +
      "Automatically uses sender's donkeys, or recipient's donkeys (pickup) if sender has none. " +
      "Resources arrive after travel time. Automation will offload arrivals automatically.",
    {
      from_structure_id: z.coerce.number().describe("Entity ID of source structure"),
      to_structure_id: z.coerce.number().describe("Entity ID of destination structure"),
      resources: z
        .array(
          z.object({
            resource_id: z.coerce
              .number()
              .describe("Resource type ID (e.g. 38=Essence, 3=Wood, 4=Copper, 7=Gold, 25=Donkey)"),
            amount: z.coerce.number().describe("Amount to send (human-readable, not precision-scaled)"),
          }),
        )
        .describe("Resources to send"),
    },
    async ({ from_structure_id, to_structure_id, resources }) =>
      mcpCall(sendResources, {
        fromStructureId: from_structure_id,
        toStructureId: to_structure_id,
        resources: resources.map((r: any) => ({ resourceId: r.resource_id, amount: r.amount })),
      }),
  );

  // ── Guard & Troop Transfer Tools ──

  server.tool(
    "guard_from_storage",
    "Add troops from a structure's own resource storage into one of its guard slots. " +
      "Structures can have up to 4 guard slots (Alpha=0, Bravo=1, Charlie=2, Delta=3). " +
      "Check map_entity_info first to see which slots are occupied. " +
      "NOTE: Larger groups in one slot are disproportionately stronger — concentrate troops in fewer slots.",
    {
      structure_id: z.coerce.number().describe("Entity ID of the structure to guard"),
      slot: z.coerce.number().min(0).max(3).describe("Guard slot (0=Alpha, 1=Bravo, 2=Charlie, 3=Delta)"),
      troop_type: z.enum(["Knight", "Paladin", "Crossbowman"]).describe("Troop type"),
      tier: z.coerce.number().min(1).max(3).default(1).describe("Troop tier (1-3)"),
      amount: z.coerce.number().describe("Number of troops to assign as guards"),
    },
    async ({ structure_id, slot, troop_type, tier, amount }) =>
      mcpCall(guardFromStorage, { structureId: structure_id, slot, troopType: troop_type, tier, amount }),
  );

  server.tool(
    "guard_from_army",
    "Move troops from an adjacent army into a structure's guard slot. " +
      "The army must be adjacent to the structure. " +
      "NOTE: Larger groups in one slot are disproportionately stronger — concentrate troops in fewer slots.",
    {
      army_id: z.coerce.number().describe("Entity ID of the army donating troops"),
      structure_id: z.coerce.number().describe("Entity ID of the structure to garrison"),
      slot: z.coerce.number().min(0).max(3).describe("Guard slot (0=Alpha, 1=Bravo, 2=Charlie, 3=Delta)"),
      amount: z.coerce.number().describe("Number of troops to move into the guard slot"),
    },
    async ({ army_id, structure_id, slot, amount }) =>
      mcpCall(guardFromArmy, { armyId: army_id, structureId: structure_id, slot, amount }),
  );

  server.tool(
    "reinforce_army",
    "Add more troops from the home structure's storage to an existing army. " +
      "The army must be adjacent to its home structure. " +
      "NOTE: Larger armies are disproportionately stronger — reinforce rather than create new armies.",
    {
      army_id: z.coerce.number().describe("Entity ID of the army to reinforce"),
      amount: z.coerce.number().describe("Number of troops to add"),
    },
    async ({ army_id, amount }) => mcpCall(reinforceArmy, { armyId: army_id, amount }),
  );

  server.tool(
    "transfer_troops",
    "Transfer troops between two adjacent armies of the same type and tier. " +
      "NOTE: Larger armies are disproportionately stronger — use this to consolidate small armies into one big one.",
    {
      from_army_id: z.coerce.number().describe("Entity ID of the army giving troops"),
      to_army_id: z.coerce.number().describe("Entity ID of the army receiving troops"),
      amount: z.coerce.number().describe("Number of troops to transfer"),
    },
    async ({ from_army_id, to_army_id, amount }) =>
      mcpCall(transferTroops, { fromArmyId: from_army_id, toArmyId: to_army_id, amount }),
  );

  server.tool(
    "unguard_to_army",
    "Move troops from a structure's guard slot to an adjacent army. " +
      "The army must be adjacent to the structure and have the same troop type/tier.",
    {
      structure_id: z.coerce.number().describe("Entity ID of the structure"),
      slot: z.coerce.number().min(0).max(3).describe("Guard slot (0=Alpha, 1=Bravo, 2=Charlie, 3=Delta)"),
      army_id: z.coerce.number().describe("Entity ID of the receiving army"),
      amount: z.coerce.number().describe("Number of troops to move out of the guard slot"),
    },
    async ({ structure_id, slot, army_id, amount }) =>
      mcpCall(unguardToArmy, { structureId: structure_id, slot, armyId: army_id, amount }),
  );

  server.tool(
    "transfer_to_structure",
    "Transfer resources (relics, loot, etc.) from an army to an adjacent structure. " +
      "The army must be adjacent to the structure.",
    {
      army_id: z.coerce.number().describe("Entity ID of the army carrying resources"),
      structure_id: z.coerce.number().describe("Entity ID of the receiving structure"),
      resources: z
        .array(
          z.object({
            resource_id: z.coerce.number().describe("Resource type ID"),
            amount: z.coerce.number().describe("Amount to transfer (human-readable)"),
          }),
        )
        .describe("Resources to transfer"),
    },
    async ({ army_id, structure_id, resources }) =>
      mcpCall(transferToStructure, {
        armyId: army_id,
        structureId: structure_id,
        resources: resources.map((r: any) => ({ resourceId: r.resource_id, amount: r.amount })),
      }),
  );

  server.tool(
    "transfer_to_army",
    "Transfer resources (relics, loot, etc.) between two adjacent armies.",
    {
      from_army_id: z.coerce.number().describe("Entity ID of the army giving resources"),
      to_army_id: z.coerce.number().describe("Entity ID of the army receiving resources"),
      resources: z
        .array(
          z.object({
            resource_id: z.coerce.number().describe("Resource type ID"),
            amount: z.coerce.number().describe("Amount to transfer (human-readable)"),
          }),
        )
        .describe("Resources to transfer"),
    },
    async ({ from_army_id, to_army_id, resources }) =>
      mcpCall(transferToArmy, {
        fromArmyId: from_army_id,
        toArmyId: to_army_id,
        resources: resources.map((r: any) => ({ resourceId: r.resource_id, amount: r.amount })),
      }),
  );

  // ── Buff Tools ──

  server.tool(
    "apply_relic",
    "Apply a relic buff to an army, structure guards, or structure production. " +
      "Costs Essence. Relics come from opening chests. " +
      "Recipient types: 0=Explorer (army buff), 1=StructureGuard (guard buff), 2=StructureProduction (production buff).",
    {
      entity_id: z.coerce.number().describe("Entity ID of the army or structure to buff"),
      relic_resource_id: z.coerce.number().describe("Resource ID of the relic to apply"),
      recipient_type: z.coerce.number().min(0).max(2).describe("0=Explorer, 1=StructureGuard, 2=StructureProduction"),
    },
    async ({ entity_id, relic_resource_id, recipient_type }) =>
      mcpCall(applyRelic, { entityId: entity_id, relicResourceId: relic_resource_id, recipientType: recipient_type }),
  );

  // ── Connect transport FIRST so the MCP handshake completes immediately ──
  log("Connecting MCP transport...");
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("MCP transport connected. Bootstrapping...");

  // Exit cleanly when Claude Code closes the connection
  process.stdin.on("end", () => {
    log("stdin closed — exiting.");
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    log("SIGTERM — exiting.");
    process.exit(0);
  });
  process.on("SIGINT", () => {
    log("SIGINT — exiting.");
    process.exit(0);
  });

  // ── Bootstrap (runs AFTER handshake — no timeout risk) ──
  try {
    bootstrapPhase = "discovering world";

    const result = await bootstrap({
      waitForMap: true,
      startMapLoop: true,
      onAuthUrl: (url) => {
        authUrl = url;
        bootstrapPhase = "authenticating";
        log("Auth URL captured — call any tool to get the login link.");
      },
    });

    // Populate mutable state from bootstrap result
    client = result.client;
    provider = result.provider;
    account = result.account;
    playerAddress = result.account.address;
    gameConfig = result.gameConfig;
    mapCenter = result.toolCtx.mapCenter;
    donkeyCapacityGrams = result.toolCtx.donkeyCapacityGrams ?? 50_000;
    for (const [k, v] of result.toolCtx.resourceWeightGrams ?? []) {
      resourceWeightGrams.set(k, v);
    }

    // Adopt the bootstrap's mapCtx state into our local mapCtx
    mapCtx.snapshot = result.mapCtx.snapshot;
    mapCtx.protocol = result.mapCtx.protocol;
    mapCtx.refresh = result.mapCtx.refresh;

    // Keep our local mapCtx in sync with the bootstrap's mapCtx
    // by forwarding snapshot/protocol updates
    const bootstrapMapCtx = result.mapCtx;
    const origRefresh = mapCtx.refresh;
    mapCtx.refresh = async () => {
      if (origRefresh) await origRefresh();
      mapCtx.snapshot = bootstrapMapCtx.snapshot;
      mapCtx.protocol = bootstrapMapCtx.protocol;
    };

    authUrl = null;
    log(`Account: ${playerAddress}`);

    bootstrapPhase = "loading game data";
    log(`Game config loaded. ${Object.keys(gameConfig!.buildingCosts).length} buildings.`);

    log(
      mapCtx.snapshot ? `Map loaded: ${mapCtx.snapshot.tiles.length} tiles` : "Map failed to load (tools will retry)",
    );

    // Automation loop (off by default in MCP mode)
    automationLoop = result.automationLoop;

    bootstrapDone = true;
    log("Bootstrap complete. All tools ready.");
  } catch (err: any) {
    bootstrapError = err.message ?? String(err);
    log(`Bootstrap failed: ${bootstrapError}`);
  }
}
