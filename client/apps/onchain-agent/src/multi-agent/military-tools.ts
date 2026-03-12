import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import { DirectiveQueue } from "./directives.js";

export function createRequestTroopsTool(directives: DirectiveQueue): AgentTool<any> {
  return {
    name: "request_troops",
    label: "Request Troops",
    description:
      "Request the production agent to build troops at a realm. " +
      "Production will handle building the right buildings and queuing production. " +
      "Use 'urgent' priority when under attack or need troops immediately.",
    parameters: Type.Object({
      troop_type: Type.String({ description: "Knight, Crossbowman, or Paladin" }),
      tier: Type.Number({ description: "Troop tier: 1, 2, or 3" }),
      amount: Type.Number({ description: "Number of troops needed" }),
      structure_id: Type.Number({ description: "Realm entity ID where troops are needed" }),
      priority: Type.String({ description: "'urgent' or 'normal'" }),
    }),
    async execute(_toolCallId: string, params: any) {
      const id = directives.addTroopRequest({
        troopType: params.troop_type,
        tier: params.tier,
        amount: params.amount,
        structureId: params.structure_id,
        priority: params.priority ?? "normal",
      });
      return {
        content: [
          {
            type: "text" as const,
            text: `Troop request submitted (${id}): ${params.amount} T${params.tier} ${params.troop_type} at realm #${params.structure_id} [${params.priority}]. Production will handle it.`,
          },
        ],
        details: {},
      };
    },
  };
}

export function createRequestResourcesTool(directives: DirectiveQueue): AgentTool<any> {
  return {
    name: "request_resources",
    label: "Request Resources",
    description:
      "Request the production agent to prepare specific resources at a realm. " +
      "Production will produce and/or transfer resources to fulfill the request.",
    parameters: Type.Object({
      resource_type: Type.String({ description: "Resource name (e.g. Wheat, Wood, Coal, Copper, Ironwood, etc.)" }),
      amount: Type.Number({ description: "Amount needed" }),
      structure_id: Type.Number({ description: "Realm entity ID where resources are needed" }),
      priority: Type.String({ description: "'urgent' or 'normal'" }),
    }),
    async execute(_toolCallId: string, params: any) {
      const id = directives.addResourceRequest({
        resourceType: params.resource_type,
        amount: params.amount,
        structureId: params.structure_id,
        priority: params.priority ?? "normal",
      });
      return {
        content: [
          {
            type: "text" as const,
            text: `Resource request submitted (${id}): ${params.amount} ${params.resource_type} at realm #${params.structure_id} [${params.priority}]. Production will handle it.`,
          },
        ],
        details: {},
      };
    },
  };
}

export function createSetProductionPriorityTool(directives: DirectiveQueue): AgentTool<any> {
  return {
    name: "set_production_priority",
    label: "Set Production Priority",
    description:
      "Set strategic production direction. Examples: 'focus on Paladins — they have biome advantage', " +
      "'prepare for city upgrade on realm #42', 'all realms should produce T2 Knights'.",
    parameters: Type.Object({
      instruction: Type.String({ description: "Strategic instruction for the production agent" }),
    }),
    async execute(_toolCallId: string, params: any) {
      const id = directives.addPriorityDirective(params.instruction);
      return {
        content: [
          {
            type: "text" as const,
            text: `Priority set (${id}): "${params.instruction}". Production will follow this directive.`,
          },
        ],
        details: {},
      };
    },
  };
}

export function createViewProductionStatusTool(directives: DirectiveQueue): AgentTool<any> {
  return {
    name: "view_production_status",
    label: "Production Status",
    description: "View production agent status, realm summaries, and pending request progress.",
    parameters: Type.Object({}),
    async execute() {
      const text = directives.formatForMilitary();
      return { content: [{ type: "text" as const, text }], details: {} };
    },
  };
}

export function createAllMilitaryDelegationTools(directives: DirectiveQueue): AgentTool<any>[] {
  return [
    createRequestTroopsTool(directives),
    createRequestResourcesTool(directives),
    createSetProductionPriorityTool(directives),
    createViewProductionStatusTool(directives),
  ];
}
