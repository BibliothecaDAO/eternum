import schemaRegistry from "../schema/schema-registry-v1.json";
import { hash } from "starknet";
import { cloneProtocolValue } from "./clone";

export { decodeSchema, encodeSchema, type SchemaValue } from "./codec";
export * from "./economic-capability";
export * from "./exit-family-inventory";
export * from "./frozen-position";
export * from "./frozen-recovery";
export * from "./emergency-sealed";
export * from "./mmr-plan";
export * from "./authority-inventory";
export * from "./deployment-identity";
export * from "./deployment-identity-vector";
export * from "./tree";
export * from "./generated-types";
export * from "./package-lane";

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

export interface IndexFamilySchema {
  code: number;
  name: string;
  scope: "world" | "deployment";
}

export interface TreeSchema {
  name: string;
  depth: number;
  capacity: number;
  leafDomain: string;
  emptyLeafDomain: string;
  nodeDomain: string;
}

const PROTOCOL_VERSION = schemaRegistry.protocolVersion as ProtocolVersion;
const ACTION_SCHEMAS = schemaRegistry.actions as readonly ActionSchema[];
const CLAIM_KIND_SCHEMAS = schemaRegistry.claimKinds as readonly ClaimKindSchema[];
const INDEX_FAMILY_SCHEMAS = schemaRegistry.indexFamilies as readonly IndexFamilySchema[];
const TREE_SCHEMAS = schemaRegistry.trees as readonly TreeSchema[];

const ACTION_BY_CODE = new Map(ACTION_SCHEMAS.map((schema) => [schema.code, schema]));
const CLAIM_KIND_BY_CODE = new Map(CLAIM_KIND_SCHEMAS.map((schema) => [schema.code, schema]));
const INDEX_FAMILY_BY_CODE = new Map(INDEX_FAMILY_SCHEMAS.map((schema) => [schema.code, schema]));
const INDEX_FAMILY_BY_NAME = new Map(INDEX_FAMILY_SCHEMAS.map((schema) => [schema.name, schema]));
const TREE_BY_NAME = new Map(TREE_SCHEMAS.map((schema) => [schema.name, schema]));

export function getActionSchema(version: number, actionCode: number): ActionSchema {
  if (version !== PROTOCOL_VERSION) throw new Error(`unsupported protocol version: ${version}`);

  const schema = ACTION_BY_CODE.get(actionCode);
  if (!schema) throw new Error(`unregistered action: ${actionCode}`);
  return cloneProtocolValue(schema);
}

export function getClaimKind(claimKindCode: number): ClaimKindSchema {
  const schema = CLAIM_KIND_BY_CODE.get(claimKindCode);
  if (!schema) throw new Error(`unregistered claim kind: ${claimKindCode}`);
  return cloneProtocolValue(schema);
}

export function getIndexFamily(indexFamilyCode: number): IndexFamilySchema {
  const schema = INDEX_FAMILY_BY_CODE.get(indexFamilyCode);
  if (!schema) throw new Error(`unregistered index family: ${indexFamilyCode}`);
  return cloneProtocolValue(schema);
}

export function getIndexFamilyByName(name: string): IndexFamilySchema {
  const schema = INDEX_FAMILY_BY_NAME.get(name);
  if (!schema) throw new Error(`unregistered index family: ${name}`);
  return cloneProtocolValue(schema);
}

export function getTreeSchema(name: string): TreeSchema {
  const schema = TREE_BY_NAME.get(name);
  if (!schema) throw new Error(`unregistered tree: ${name}`);
  return cloneProtocolValue(schema);
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
