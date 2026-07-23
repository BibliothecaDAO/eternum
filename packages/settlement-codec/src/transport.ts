import { hash } from "starknet";

import { encodeSchema, type SchemaValue } from "./codec";
import type { ProtocolEnvelope } from "./generated-types";
import { getActionSchema, getHashDomainSelector } from "./registry";

export const MAINNET_TO_APPCHAIN = 1;
export const APPCHAIN_TO_MAINNET = 2;

export type TransportDirection = typeof MAINNET_TO_APPCHAIN | typeof APPCHAIN_TO_MAINNET;

export interface TypedBodyHashInput {
  protocolVersion: number;
  action: number;
  body: SchemaValue;
}

export interface MessageIdInput {
  direction: TransportDirection;
  deploymentId: bigint;
  transportNonce: bigint;
  typedBodyHash: string;
}

const TYPED_BODY_DOMAIN = getHashDomainSelector("ETERNUM_TYPED_BODY_V1");
const ENVELOPE_DOMAIN = getHashDomainSelector("ETERNUM_ENVELOPE_V1");
const MESSAGE_DOMAIN = getHashDomainSelector("ETERNUM_MESSAGE_V1");

export function computeTypedBodyHash(input: TypedBodyHashInput): string {
  const action = getActionSchema(input.protocolVersion, input.action);
  const bodyFelts = encodeSchema(action.body, input.body);

  return hash.computePoseidonHashOnElements([
    TYPED_BODY_DOMAIN,
    input.protocolVersion,
    input.action,
    bodyFelts.length,
    ...bodyFelts,
  ]);
}

export function computeProtocolEnvelopeHash(envelope: ProtocolEnvelope): string {
  const envelopeFelts = encodeSchema("ProtocolEnvelope", toSchemaEnvelope(envelope));
  return hash.computePoseidonHashOnElements([ENVELOPE_DOMAIN, envelopeFelts.length, ...envelopeFelts]);
}

export function deriveMessageId(input: MessageIdInput): string {
  assertTransportDirection(input.direction);
  const deploymentId = encodeTransportIdentity("DeploymentId", input.deploymentId);
  const transportNonce = encodeTransportIdentity("u64", input.transportNonce);
  const typedBodyHash = encodeTransportIdentity("felt252", input.typedBodyHash);

  return hash.computePoseidonHashOnElements([
    MESSAGE_DOMAIN,
    input.direction,
    deploymentId,
    transportNonce,
    typedBodyHash,
  ]);
}

function assertTransportDirection(direction: number): asserts direction is TransportDirection {
  if (direction !== MAINNET_TO_APPCHAIN && direction !== APPCHAIN_TO_MAINNET) {
    throw new Error(`unsupported transport direction: ${direction}`);
  }
}

function encodeTransportIdentity(schema: "DeploymentId" | "u64" | "felt252", value: bigint | string): bigint {
  const [encoded] = encodeSchema(schema, value);
  return encoded;
}

function toSchemaEnvelope(envelope: ProtocolEnvelope): SchemaValue {
  return {
    magic: envelope.magic,
    version: envelope.version,
    source_chain_id: envelope.source_chain_id,
    destination_chain_id: envelope.destination_chain_id,
    deployment_id: envelope.deployment_id,
    season_id: envelope.season_id,
    game_id: envelope.game_id,
    action: envelope.action,
    transport_nonce: envelope.transport_nonce,
    message_id: envelope.message_id,
  };
}
