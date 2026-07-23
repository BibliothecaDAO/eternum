import { describe, expect, it } from "vitest";

import schemaRegistry from "../schema/schema-registry-v1.json";
import { PROTOCOL_INTERFACE_SCHEMAS } from "./generated-types";

const REQUIRED_INTERFACE_MEMBER_COUNTS = {
  IArchiveQuorumRegistry: 23,
  IHardenedPiltover: 33,
  IRootInbox: 14,
  IClaimRouter: 11,
  IResourceMintGateway: 24,
  ISeasonIngress: 19,
  ISeasonSettlementHub: 15,
} as const;

const UNDEFINED_NORMATIVE_RETURN_TYPES = [
  "RegisteredRoot",
  "IngressRecord",
  "ResourceAssetLedger",
  "AppchainIngressState",
  "FinalizationBarrierState",
  "OpenBatch",
] as const;

describe("A3/A14 normative dispatcher rebaseline", () => {
  it.each(Object.entries(REQUIRED_INTERFACE_MEMBER_COUNTS))(
    "publishes the exact fully typed %s method list to TypeScript",
    (name, memberCount) => {
      const declaration = schemaRegistry.declarations.find(
        (candidate) => candidate.kind === "trait" && candidate.name === name,
      );
      const generated = PROTOCOL_INTERFACE_SCHEMAS.find((candidate) => candidate.name === name);

      expect(declaration, name).toBeDefined();
      expect(declaration?.members, name).toHaveLength(memberCount);
      expect(generated?.genericParameters, name).toBe(declaration?.genericParameters);
      expect(generated?.members, name).toEqual(declaration?.members);
    },
  );

  it.each(UNDEFINED_NORMATIVE_RETURN_TYPES)("does not invent the missing %s wire layout", (name) => {
    expect(schemaRegistry.declarations.some((declaration) => declaration.name === name)).toBe(false);
  });

  it("keeps action-specific enqueue and consume methods instead of a generic transport dispatcher", () => {
    const piltover = getTrait("IHardenedPiltover");

    expect(piltover.members).toContain(
      "fn enqueue_resource_deposit(ref self: TContractState, game_id: GameId, body: ResourceDepositMessage) -> EnqueuedMessage",
    );
    expect(piltover.members).toContain(
      "fn consume_typed_appchain_message(ref self: TContractState, envelope: ProtocolEnvelope, typed_body_hash: felt252)",
    );
    expect(piltover.members.some((member) => member.includes("arbitrary") || member.includes("calldata"))).toBe(false);
  });

  it("freezes the typed season ingress mutation boundary", () => {
    const ingress = getTrait("ISeasonIngress");

    expect(ingress.members).toContain(
      "fn handle_resource_deposit(ref self: TContractState, from_address: felt252, envelope: ProtocolEnvelope, deposit: ResourceDepositMessage)",
    );
    expect(ingress.members).toContain(
      "fn consume_cancelled_transport_slot(ref self: TContractState, marker: CancelledInboxMarker)",
    );
  });
});

function getTrait(name: string) {
  const declaration = schemaRegistry.declarations.find(
    (candidate) => candidate.kind === "trait" && candidate.name === name,
  );
  if (!declaration || declaration.kind !== "trait") throw new Error(`missing trait: ${name}`);
  return declaration;
}
