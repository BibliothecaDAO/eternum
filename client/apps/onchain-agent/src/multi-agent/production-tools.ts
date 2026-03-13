import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import type { TxContext } from "../tools/tx-context.js";
import { extractTxError } from "../tools/tx-context.js";
import { DirectiveQueue } from "./directives.js";

const BUILDING_TYPES: Record<string, number> = {
  WorkersHut: 1,
  Coal: 4,
  Wood: 5,
  Copper: 6,
  Ironwood: 7,
  Gold: 9,
  Mithral: 11,
  ColdIron: 13,
  Adamantine: 21,
  Dragonhide: 24,
  Donkey: 27,
  KnightT1: 28,
  KnightT2: 29,
  KnightT3: 30,
  CrossbowmanT1: 31,
  CrossbowmanT2: 32,
  CrossbowmanT3: 33,
  PaladinT1: 34,
  PaladinT2: 35,
  PaladinT3: 36,
  Wheat: 37,
};

const BUILDING_NAMES = Object.entries(BUILDING_TYPES)
  .map(([name, id]) => `${name}=${id}`)
  .join(", ");

export function createBuildTool(tx: TxContext): AgentTool<any> {
  return {
    name: "build",
    label: "Build",
    description:
      `Build a building at a structure. Directions is a path from center hex outward. ` +
      `Ring 1: [0],[1],[2],[3],[4],[5]. Ring 2: [0,0],[0,1],[1,1],... ` +
      `Buildings: ${BUILDING_NAMES}. use_simple=true pays only Labor.`,
    parameters: Type.Object({
      realm_entity_id: Type.Number({ description: "Realm entity ID" }),
      building_type: Type.Number({ description: `Building type ID. ${BUILDING_NAMES}` }),
      directions: Type.Array(Type.Number(), { description: "Path from center hex (direction IDs 0-5)" }),
      use_simple: Type.Boolean({ description: "true=Labor only, false=Labor+resources" }),
    }),
    async execute(_toolCallId: string, params: any) {
      try {
        await tx.provider.create_building({
          entity_id: params.realm_entity_id,
          directions: params.directions,
          building_category: params.building_type,
          use_simple: params.use_simple,
          signer: tx.signer,
        });
        return {
          content: [{ type: "text" as const, text: `Built building ${params.building_type} successfully.` }],
          details: {},
        };
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: `Build failed: ${extractTxError(err)}` }], details: {} };
      }
    },
  };
}

export function createDestroyBuildingTool(tx: TxContext): AgentTool<any> {
  return {
    name: "destroy_building",
    label: "Destroy Building",
    description: "Destroy a building at a structure. Pass the building's x,y coordinate.",
    parameters: Type.Object({
      realm_entity_id: Type.Number({ description: "Realm entity ID" }),
      building_x: Type.Number({ description: "Building x coordinate" }),
      building_y: Type.Number({ description: "Building y coordinate" }),
    }),
    async execute(_toolCallId: string, params: any) {
      try {
        await tx.provider.destroy_building({
          entity_id: params.realm_entity_id,
          building_coord: { alt: false, x: params.building_x, y: params.building_y },
          signer: tx.signer,
        });
        return { content: [{ type: "text" as const, text: `Building destroyed.` }], details: {} };
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: `Destroy failed: ${extractTxError(err)}` }], details: {} };
      }
    },
  };
}

export function createUpgradeRealmTool(tx: TxContext): AgentTool<any> {
  return {
    name: "upgrade_realm",
    label: "Upgrade Realm",
    description: "Upgrade a realm to the next level. L0→L1 unlocks 18 slots, L1→L2 unlocks 36 slots. Costs resources.",
    parameters: Type.Object({
      realm_entity_id: Type.Number({ description: "Realm entity ID to upgrade" }),
    }),
    async execute(_toolCallId: string, params: any) {
      try {
        await tx.provider.upgrade_realm({
          realm_entity_id: params.realm_entity_id,
          signer: tx.signer,
        });
        return { content: [{ type: "text" as const, text: `Realm upgraded successfully.` }], details: {} };
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: `Upgrade failed: ${extractTxError(err)}` }], details: {} };
      }
    },
  };
}

export function createProduceResourcesTool(tx: TxContext): AgentTool<any> {
  return {
    name: "produce_resources",
    label: "Produce Resources",
    description:
      "Execute resource production at a realm. Specify resource IDs and cycle counts. " +
      "Each cycle converts inputs (Labor/resources) into outputs based on building recipes.",
    parameters: Type.Object({
      realm_entity_id: Type.Number({ description: "Realm entity ID" }),
      resource_to_resource: Type.Array(
        Type.Object({
          resource_id: Type.Number({ description: "Resource type ID to produce" }),
          cycles: Type.Number({ description: "Number of production cycles" }),
        }),
        { description: "Complex production (resource→resource)" },
      ),
      labor_to_resource: Type.Array(
        Type.Object({
          resource_id: Type.Number({ description: "Resource type ID to produce" }),
          cycles: Type.Number({ description: "Number of production cycles" }),
        }),
        { description: "Simple production (labor→resource)" },
      ),
    }),
    async execute(_toolCallId: string, params: any) {
      try {
        await tx.provider.execute_realm_production_plan({
          realm_entity_id: params.realm_entity_id,
          resource_to_resource: params.resource_to_resource ?? [],
          labor_to_resource: params.labor_to_resource ?? [],
          signer: tx.signer,
        });
        return { content: [{ type: "text" as const, text: `Production executed.` }], details: {} };
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: `Production failed: ${extractTxError(err)}` }], details: {} };
      }
    },
  };
}

export function createOffloadArrivalsTool(tx: TxContext): AgentTool<any> {
  return {
    name: "offload_arrivals",
    label: "Offload Arrivals",
    description: "Claim incoming resource arrivals at a structure.",
    parameters: Type.Object({
      structure_id: Type.Number({ description: "Structure entity ID" }),
      day: Type.Number({ description: "Day index of the arrival" }),
      slot: Type.Number({ description: "Slot index of the arrival" }),
      resource_count: Type.Number({ description: "Number of resource types in this arrival" }),
    }),
    async execute(_toolCallId: string, params: any) {
      try {
        await tx.provider.arrivals_offload({
          structureId: params.structure_id,
          day: params.day,
          slot: params.slot,
          resource_count: params.resource_count,
          signer: tx.signer,
        });
        return { content: [{ type: "text" as const, text: `Arrivals offloaded.` }], details: {} };
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: `Offload failed: ${extractTxError(err)}` }], details: {} };
      }
    },
  };
}

export function createMarkRequestStatusTool(directives: DirectiveQueue): AgentTool<any> {
  return {
    name: "mark_request_status",
    label: "Mark Request Status",
    description: "Update the status of a military request. Use after completing or failing a troop/resource request.",
    parameters: Type.Object({
      request_id: Type.String({ description: "Directive ID (e.g. dir_1)" }),
      status: Type.String({ description: "'in_progress', 'done', or 'failed'" }),
      note: Type.Optional(Type.String({ description: "Optional note about the result" })),
    }),
    async execute(_toolCallId: string, params: any) {
      const ok = directives.markStatus(params.request_id, params.status, params.note);
      const text = ok
        ? `Request ${params.request_id} marked as ${params.status}.`
        : `Request ${params.request_id} not found.`;
      return { content: [{ type: "text" as const, text }], details: {} };
    },
  };
}

export function createPauseProductionTool(tx: TxContext): AgentTool<any> {
  return {
    name: "pause_production",
    label: "Pause Production",
    description: "Pause resource production at a building. Pass the realm entity ID and building coordinates.",
    parameters: Type.Object({
      realm_entity_id: Type.Number({ description: "Realm entity ID" }),
      building_x: Type.Number({ description: "Building x coordinate" }),
      building_y: Type.Number({ description: "Building y coordinate" }),
    }),
    async execute(_toolCallId: string, params: any) {
      try {
        await tx.provider.pause_production({
          entity_id: params.realm_entity_id,
          building_coord: { alt: false, x: params.building_x, y: params.building_y },
          signer: tx.signer,
        });
        return { content: [{ type: "text" as const, text: `Production paused.` }], details: {} };
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: `Pause failed: ${extractTxError(err)}` }], details: {} };
      }
    },
  };
}

export function createResumeProductionTool(tx: TxContext): AgentTool<any> {
  return {
    name: "resume_production",
    label: "Resume Production",
    description: "Resume resource production at a paused building. Pass the realm entity ID and building coordinates.",
    parameters: Type.Object({
      realm_entity_id: Type.Number({ description: "Realm entity ID" }),
      building_x: Type.Number({ description: "Building x coordinate" }),
      building_y: Type.Number({ description: "Building y coordinate" }),
    }),
    async execute(_toolCallId: string, params: any) {
      try {
        await tx.provider.resume_production({
          entity_id: params.realm_entity_id,
          building_coord: { alt: false, x: params.building_x, y: params.building_y },
          signer: tx.signer,
        });
        return { content: [{ type: "text" as const, text: `Production resumed.` }], details: {} };
      } catch (err: any) {
        return { content: [{ type: "text" as const, text: `Resume failed: ${extractTxError(err)}` }], details: {} };
      }
    },
  };
}

export function createAllProductionTools(tx: TxContext, directives: DirectiveQueue): AgentTool<any>[] {
  return [
    createBuildTool(tx),
    createDestroyBuildingTool(tx),
    createUpgradeRealmTool(tx),
    createProduceResourcesTool(tx),
    createOffloadArrivalsTool(tx),
    createPauseProductionTool(tx),
    createResumeProductionTool(tx),
    createMarkRequestStatusTool(directives),
  ];
}
