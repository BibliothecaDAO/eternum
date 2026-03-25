/**
 * CLI wiring for all 16 action tool commands.
 *
 * Each command bootstraps the runtime, calls the corresponding core tool
 * function, and prints the result respecting --json.
 */

import type { Command } from "commander";
import { bootstrap } from "../../entry/bootstrap-runtime.js";
import {
  moveArmy,
  simulateAttack,
  attackTarget,
  attackFromGuard,
  raidTarget,
  createArmy,
  openChest,
  reinforceArmy,
  applyRelic,
  guardFromStorage,
  guardFromArmy,
  unguardToArmy,
  sendResources,
  transferToStructure,
  transferToArmy,
  transferTroops,
} from "../../tools/core/index.js";
import { parseResources } from "../parse-resources.js";

// ── Shared output helper ──────────────────────────────────────────────

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

// ── Command registration ─────────────────────────────────────────────

export function registerToolCommands(program: Command) {
  // 1. move-army <army-id> <x> <y>
  program
    .command("move-army")
    .description("Move an army to a target position")
    .argument("<army-id>", "Army entity ID", Number)
    .argument("<x>", "Target X coordinate", Number)
    .argument("<y>", "Target Y coordinate", Number)
    .action(async (armyId: number, x: number, y: number) => {
      const json = !!program.opts().json;
      const { toolCtx, mapLoop } = await bootstrap();
      const result = await moveArmy({ armyId, targetX: x, targetY: y }, toolCtx);
      mapLoop.stop();
      output(result, json);
    });

  // 2. simulate-attack <army-id> <x> <y>
  program
    .command("simulate-attack")
    .description("Simulate a battle without executing it")
    .argument("<army-id>", "Attacking army entity ID", Number)
    .argument("<x>", "Target X coordinate", Number)
    .argument("<y>", "Target Y coordinate", Number)
    .action(async (armyId: number, x: number, y: number) => {
      const json = !!program.opts().json;
      const { toolCtx, mapLoop } = await bootstrap();
      const result = await simulateAttack({ armyId, targetX: x, targetY: y }, toolCtx);
      mapLoop.stop();
      output(result, json);
    });

  // 3. attack <army-id> <x> <y>
  program
    .command("attack")
    .description("Attack a target adjacent to your army")
    .argument("<army-id>", "Attacking army entity ID", Number)
    .argument("<x>", "Target X coordinate", Number)
    .argument("<y>", "Target Y coordinate", Number)
    .action(async (armyId: number, x: number, y: number) => {
      const json = !!program.opts().json;
      const { toolCtx, mapLoop } = await bootstrap();
      const result = await attackTarget({ armyId, targetX: x, targetY: y }, toolCtx);
      mapLoop.stop();
      output(result, json);
    });

  // 4. attack-from-guard <structure-id> <slot> <target-army-id>
  program
    .command("attack-from-guard")
    .description("Attack an enemy army from a structure guard slot")
    .argument("<structure-id>", "Structure entity ID", Number)
    .argument("<slot>", "Guard slot (0=Alpha, 1=Bravo, 2=Charlie, 3=Delta)", Number)
    .argument("<target-army-id>", "Enemy army entity ID to attack", Number)
    .action(async (structureId: number, slot: number, targetArmyId: number) => {
      const json = !!program.opts().json;
      const { toolCtx, mapLoop } = await bootstrap();
      const result = await attackFromGuard({ structureId, slot, targetArmyId }, toolCtx);
      mapLoop.stop();
      output(result, json);
    });

  // 5. raid <army-id> <x> <y> [--steal '38:100']
  program
    .command("raid")
    .description("Raid a structure adjacent to your army")
    .argument("<army-id>", "Raiding army entity ID", Number)
    .argument("<x>", "Target X coordinate", Number)
    .argument("<y>", "Target Y coordinate", Number)
    .option("--steal <resources>", "Resources to steal (format: 'resourceId:amount,...')")
    .action(async (armyId: number, x: number, y: number, opts: { steal?: string }) => {
      const json = !!program.opts().json;
      const stealResources = opts.steal ? parseResources(opts.steal) : undefined;
      const { toolCtx, mapLoop } = await bootstrap();
      const result = await raidTarget({ armyId, targetX: x, targetY: y, stealResources }, toolCtx);
      mapLoop.stop();
      output(result, json);
    });

  // 6. create-army <structure-id> [--type Knight --tier 1 --amount 500]
  program
    .command("create-army")
    .description("Create a new army at a realm")
    .argument("<structure-id>", "Realm entity ID", Number)
    .option("--type <troop-type>", "Troop type: Knight, Paladin, or Crossbowman")
    .option("--tier <n>", "Troop tier (1-3)", Number)
    .option("--amount <n>", "Number of troops", Number)
    .action(async (structureId: number, opts: { type?: string; tier?: number; amount?: number }) => {
      const json = !!program.opts().json;
      const { toolCtx, mapLoop } = await bootstrap();
      const result = await createArmy(
        { structureId, troopType: opts.type, tier: opts.tier, amount: opts.amount },
        toolCtx,
      );
      mapLoop.stop();
      output(result, json);
    });

  // 7. open-chest <army-id> <x> <y>
  program
    .command("open-chest")
    .description("Open a chest adjacent to your army")
    .argument("<army-id>", "Army entity ID", Number)
    .argument("<x>", "Chest X coordinate", Number)
    .argument("<y>", "Chest Y coordinate", Number)
    .action(async (armyId: number, x: number, y: number) => {
      const json = !!program.opts().json;
      const { toolCtx, mapLoop } = await bootstrap();
      const result = await openChest({ armyId, chestX: x, chestY: y }, toolCtx);
      mapLoop.stop();
      output(result, json);
    });

  // 8. send-resources <from> <to> --resources '38:100,3:500'
  program
    .command("send-resources")
    .description("Send resources between structures via donkey caravan")
    .argument("<from>", "Sender structure entity ID", Number)
    .argument("<to>", "Recipient structure entity ID", Number)
    .requiredOption("--resources <list>", "Resources to send (format: 'resourceId:amount,...')")
    .action(async (from: number, to: number, opts: { resources: string }) => {
      const json = !!program.opts().json;
      const resources = parseResources(opts.resources);
      const { toolCtx, mapLoop } = await bootstrap();
      const result = await sendResources({ fromStructureId: from, toStructureId: to, resources }, toolCtx);
      mapLoop.stop();
      output(result, json);
    });

  // 9. guard-from-storage <structure-id> <slot> <type> <tier> <amount>
  program
    .command("guard-from-storage")
    .description("Assign troops from structure storage to a guard slot")
    .argument("<structure-id>", "Structure entity ID", Number)
    .argument("<slot>", "Guard slot (0=Alpha, 1=Bravo, 2=Charlie, 3=Delta)", Number)
    .argument("<type>", "Troop type: Knight, Paladin, or Crossbowman")
    .argument("<tier>", "Troop tier (1-3)", Number)
    .argument("<amount>", "Number of troops", Number)
    .action(async (structureId: number, slot: number, type: string, tier: number, amount: number) => {
      const json = !!program.opts().json;
      const { toolCtx, mapLoop } = await bootstrap();
      const result = await guardFromStorage(
        { structureId, slot, troopType: type as "Knight" | "Paladin" | "Crossbowman", tier, amount },
        toolCtx,
      );
      mapLoop.stop();
      output(result, json);
    });

  // 10. guard-from-army <army-id> <structure-id> <slot> <amount>
  program
    .command("guard-from-army")
    .description("Move troops from an adjacent army into a structure guard slot")
    .argument("<army-id>", "Army entity ID", Number)
    .argument("<structure-id>", "Structure entity ID", Number)
    .argument("<slot>", "Guard slot (0=Alpha, 1=Bravo, 2=Charlie, 3=Delta)", Number)
    .argument("<amount>", "Number of troops", Number)
    .action(async (armyId: number, structureId: number, slot: number, amount: number) => {
      const json = !!program.opts().json;
      const { toolCtx, mapLoop } = await bootstrap();
      const result = await guardFromArmy({ armyId, structureId, slot, amount }, toolCtx);
      mapLoop.stop();
      output(result, json);
    });

  // 11. reinforce-army <army-id> <amount>
  program
    .command("reinforce-army")
    .description("Reinforce an army with troops from an adjacent structure")
    .argument("<army-id>", "Army entity ID", Number)
    .argument("<amount>", "Number of troops to add", Number)
    .action(async (armyId: number, amount: number) => {
      const json = !!program.opts().json;
      const { toolCtx, mapLoop } = await bootstrap();
      const result = await reinforceArmy({ armyId, amount }, toolCtx);
      mapLoop.stop();
      output(result, json);
    });

  // 12. transfer-troops <from-army> <to-army> <amount>
  program
    .command("transfer-troops")
    .description("Transfer troops between two adjacent armies")
    .argument("<from-army>", "Source army entity ID", Number)
    .argument("<to-army>", "Destination army entity ID", Number)
    .argument("<amount>", "Number of troops to transfer", Number)
    .action(async (fromArmyId: number, toArmyId: number, amount: number) => {
      const json = !!program.opts().json;
      const { toolCtx, mapLoop } = await bootstrap();
      const result = await transferTroops({ fromArmyId, toArmyId, amount }, toolCtx);
      mapLoop.stop();
      output(result, json);
    });

  // 13. unguard-to-army <structure-id> <slot> <army-id> <amount>
  program
    .command("unguard-to-army")
    .description("Move troops from a guard slot to an adjacent army")
    .argument("<structure-id>", "Structure entity ID", Number)
    .argument("<slot>", "Guard slot (0=Alpha, 1=Bravo, 2=Charlie, 3=Delta)", Number)
    .argument("<army-id>", "Receiving army entity ID", Number)
    .argument("<amount>", "Number of troops to move", Number)
    .action(async (structureId: number, slot: number, armyId: number, amount: number) => {
      const json = !!program.opts().json;
      const { toolCtx, mapLoop } = await bootstrap();
      const result = await unguardToArmy({ structureId, slot, armyId, amount }, toolCtx);
      mapLoop.stop();
      output(result, json);
    });

  // 14. transfer-to-structure <army-id> <structure-id> --resources '38:100'
  program
    .command("transfer-to-structure")
    .description("Transfer resources from an army to an adjacent structure")
    .argument("<army-id>", "Army entity ID", Number)
    .argument("<structure-id>", "Structure entity ID", Number)
    .requiredOption("--resources <list>", "Resources to transfer (format: 'resourceId:amount,...')")
    .action(async (armyId: number, structureId: number, opts: { resources: string }) => {
      const json = !!program.opts().json;
      const resources = parseResources(opts.resources);
      const { toolCtx, mapLoop } = await bootstrap();
      const result = await transferToStructure({ armyId, structureId, resources }, toolCtx);
      mapLoop.stop();
      output(result, json);
    });

  // 15. transfer-to-army <from-army> <to-army> --resources '38:100'
  program
    .command("transfer-to-army")
    .description("Transfer resources between two adjacent armies")
    .argument("<from-army>", "Source army entity ID", Number)
    .argument("<to-army>", "Destination army entity ID", Number)
    .requiredOption("--resources <list>", "Resources to transfer (format: 'resourceId:amount,...')")
    .action(async (fromArmyId: number, toArmyId: number, opts: { resources: string }) => {
      const json = !!program.opts().json;
      const resources = parseResources(opts.resources);
      const { toolCtx, mapLoop } = await bootstrap();
      const result = await transferToArmy({ fromArmyId, toArmyId, resources }, toolCtx);
      mapLoop.stop();
      output(result, json);
    });

  // 16. apply-relic <entity-id> <relic-resource-id> <recipient-type>
  program
    .command("apply-relic")
    .description("Apply a relic bonus to an entity")
    .argument("<entity-id>", "Target entity ID", Number)
    .argument("<relic-resource-id>", "Relic resource ID", Number)
    .argument("<recipient-type>", "Recipient type (0=Explorer, 1=Guard, 2=Production)", Number)
    .action(async (entityId: number, relicResourceId: number, recipientType: number) => {
      const json = !!program.opts().json;
      const { toolCtx, mapLoop } = await bootstrap();
      const result = await applyRelic({ entityId, relicResourceId, recipientType }, toolCtx);
      mapLoop.stop();
      output(result, json);
    });
}
