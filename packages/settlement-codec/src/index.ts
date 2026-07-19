import schemaRegistry from "../schema/schema-registry-v1.json";
import { hash } from "starknet";

export { decodeSchema, encodeSchema, type SchemaValue } from "./codec";
export * from "./generated-types";

export type ProtocolVersion = 1;

export type ActionDirection = "transport-reserved" | "mainnet-to-appchain" | "appchain-to-mainnet";
export type GameIdScope = "season" | "game" | "body-defined";

export interface ActionSchema {
  code: number;
  name: string;
  body: string;
  direction: ActionDirection;
  gameIdScope: GameIdScope;
}

export interface ClaimKindSchema {
  code: number;
  index: number;
  name: string;
  auxiliaryBody: string;
}

const PROTOCOL_VERSION = schemaRegistry.protocolVersion as ProtocolVersion;
const ACTION_SCHEMAS = schemaRegistry.actions as readonly ActionSchema[];
const CLAIM_KIND_SCHEMAS = schemaRegistry.claimKinds as readonly ClaimKindSchema[];

const ACTION_BY_CODE = new Map(ACTION_SCHEMAS.map((schema) => [schema.code, schema]));
const CLAIM_KIND_BY_CODE = new Map(CLAIM_KIND_SCHEMAS.map((schema) => [schema.code, schema]));

export function getActionSchema(version: number, actionCode: number): ActionSchema {
  if (version !== PROTOCOL_VERSION) throw new Error(`unsupported protocol version: ${version}`);

  const schema = ACTION_BY_CODE.get(actionCode);
  if (!schema) throw new Error(`unregistered action: ${actionCode}`);
  return schema;
}

export function getClaimKind(claimKindCode: number): ClaimKindSchema {
  const schema = CLAIM_KIND_BY_CODE.get(claimKindCode);
  if (!schema) throw new Error(`unregistered claim kind: ${claimKindCode}`);
  return schema;
}

export function validateEmitterCount(count: number): number {
  if (!Number.isInteger(count) || count < 1 || count > 8) {
    throw new Error("emitter count must be between 1 and 8");
  }
  return count;
}

export function getSchemaRegistryHash(): string {
  return schemaRegistry.schemaRegistryHash;
}

export function computeSchemaRegistryHash(): string {
  return hash.computePoseidonHashOnElements(schemaRegistry.registryPreimage);
}
