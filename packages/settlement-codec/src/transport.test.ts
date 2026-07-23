import { describe, expect, it } from "vitest";

import goldenVectors from "../schema/golden-vectors-v1.json";
import {
  APPCHAIN_TO_MAINNET,
  MAINNET_TO_APPCHAIN,
  computeProtocolEnvelopeHash,
  computeTypedBodyHash,
  deriveMessageId,
} from "./transport";

const RESOURCE_DEPOSIT = {
  ingress_id: 1n,
  game_id: 2n,
  asset_id: 3n,
  backing_pool_id: 4n,
  gross_amount: 6n * (1n << 128n) + 5n,
  token_decimals: 7n,
  player_l2: 8n,
  recipient_l1: 9n,
  target_structure_id: 10n,
  client_fee_recipient: 11n,
};

const RESOURCE_DEPOSIT_TYPED_BODY_HASH = "0x4d96c5827fc55f8dd19039ff2b6aff021f7ebc221d670d0a716decb13e8ab90";
const RESOURCE_DEPOSIT_MESSAGE_ID = "0x67dbf5c4297a8f442604530490811a10c2fd188e69d92a7e37ad99a6c292d2d";
const RESOURCE_DEPOSIT_ENVELOPE_HASH = "0x7312b6f461e8170cbd93ec5dcc404eff01b232da098aad03442065f2231397e";
const STARKNET_FIELD_PRIME = (1n << 251n) + 17n * (1n << 192n) + 1n;

describe("frozen settlement transport identities", () => {
  it("publishes the same literal vector for every language generator", () => {
    expect(goldenVectors.transport).toEqual({
      directions: {
        mainnetToAppchain: 1,
        appchainToMainnet: 2,
      },
      resourceDeposit: {
        protocolVersion: 1,
        action: 272,
        bodySchema: "ResourceDepositMessage",
        bodyFelts: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"],
        typedBodyHash: RESOURCE_DEPOSIT_TYPED_BODY_HASH,
        direction: 1,
        deploymentId: "42",
        transportNonce: "7",
        messageId: RESOURCE_DEPOSIT_MESSAGE_ID,
        envelopeSchema: "ProtocolEnvelope",
        envelopeFelts: [
          "11",
          "1",
          "100",
          "200",
          "42",
          "9",
          "2",
          "272",
          "7",
          "2936053695477227292975563242272918552256113216459980602976815755638740692269",
        ],
        envelopeHash: RESOURCE_DEPOSIT_ENVELOPE_HASH,
      },
    });
  });

  it("freezes the two protocol direction tags", () => {
    expect(MAINNET_TO_APPCHAIN).toBe(1);
    expect(APPCHAIN_TO_MAINNET).toBe(2);
  });

  it("matches the literal resource-deposit typed-body hash", () => {
    expect(
      computeTypedBodyHash({
        protocolVersion: 1,
        action: 0x0110,
        body: RESOURCE_DEPOSIT,
      }),
    ).toBe(RESOURCE_DEPOSIT_TYPED_BODY_HASH);
  });

  it("matches the literal mainnet-to-appchain message ID", () => {
    expect(
      deriveMessageId({
        direction: MAINNET_TO_APPCHAIN,
        deploymentId: 42n,
        transportNonce: 7n,
        typedBodyHash: RESOURCE_DEPOSIT_TYPED_BODY_HASH,
      }),
    ).toBe(RESOURCE_DEPOSIT_MESSAGE_ID);
  });

  it("matches the literal protocol-envelope hash", () => {
    expect(
      computeProtocolEnvelopeHash({
        magic: 11n,
        version: 1n,
        source_chain_id: 100n,
        destination_chain_id: 200n,
        deployment_id: 42n,
        season_id: 9n,
        game_id: 2n,
        action: 0x0110n,
        transport_nonce: 7n,
        message_id: BigInt(RESOURCE_DEPOSIT_MESSAGE_ID),
      }),
    ).toBe(RESOURCE_DEPOSIT_ENVELOPE_HASH);
  });

  it("rejects transport-reserved and unknown direction tags", () => {
    const input = {
      deploymentId: 42n,
      transportNonce: 7n,
      typedBodyHash: RESOURCE_DEPOSIT_TYPED_BODY_HASH,
    };

    expect(() => deriveMessageId({ ...input, direction: 0 as 1 })).toThrow("unsupported transport direction: 0");
    expect(() => deriveMessageId({ ...input, direction: 3 as 1 })).toThrow("unsupported transport direction: 3");
  });

  it("rejects noncanonical message identity fields before hashing", () => {
    const input = {
      direction: MAINNET_TO_APPCHAIN,
      deploymentId: 42n,
      transportNonce: 7n,
      typedBodyHash: RESOURCE_DEPOSIT_TYPED_BODY_HASH,
    };

    expect(() => deriveMessageId({ ...input, deploymentId: -1n })).toThrow("felt252 out of range");
    expect(() => deriveMessageId({ ...input, transportNonce: 1n << 64n })).toThrow("u64 out of range");
    expect(() => deriveMessageId({ ...input, typedBodyHash: `0x${STARKNET_FIELD_PRIME.toString(16)}` })).toThrow(
      "felt252 out of range",
    );
  });
});
