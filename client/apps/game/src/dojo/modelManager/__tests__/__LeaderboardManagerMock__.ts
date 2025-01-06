import { ClientComponents } from "@/dojo/createClientComponents";
import { ID } from "@bibliothecadao/eternum";
import { ComponentValue } from "@dojoengine/recs";
import { shortString } from "starknet";

export const HYPERSTRUCTURE_ENTITY_ID = 1;
export const TIMESTAMP = 1;

export const OWNER_1_ADDRESS = 1n;
export const OWNER_2_ADDRESS = 2n;

export const OWNER_1_SHARES = 5000;
export const OWNER_2_SHARES = 5000;
export const CO_OWNERS = [
  [{ value: OWNER_1_ADDRESS.toString(16) }, { value: OWNER_1_SHARES }],
  [{ value: OWNER_2_ADDRESS.toString(16) }, { value: OWNER_2_SHARES }],
];

export const generateMockHyperstructureFinishedEvent = (
  hyperstructureEntityId: ID,
): ComponentValue<ClientComponents["events"]["HyperstructureFinished"]["schema"]> => {
  return {
    hyperstructure_entity_id: hyperstructureEntityId,
    contributor_entity_id: 1,
    timestamp: TIMESTAMP,
    hyperstructure_owner_name: BigInt(shortString.encodeShortString("TEST_PLAYER")),
    id: 1,
  };
};

export const generateMockCoOwnersChangeEvent = (
  hyperstructureEntityId: ID,
  timestamp?: number,
  shares?: { playerOne: number; playerTwo: number },
): ComponentValue<ClientComponents["events"]["HyperstructureCoOwnersChange"]["schema"]> => {
  const coOwners = shares
    ? [
        [{ value: OWNER_1_ADDRESS.toString(16) }, { value: shares.playerOne }],
        [{ value: OWNER_2_ADDRESS.toString(16) }, { value: shares.playerTwo }],
      ]
    : CO_OWNERS.map((value) => value);
  return {
    id: 1,
    hyperstructure_entity_id: hyperstructureEntityId,
    timestamp: timestamp || TIMESTAMP,
    co_owners: coOwners as any,
  };
};

export const mockSingleContribution = (
  hyperstructureEntityId: ID,
): ComponentValue<ClientComponents["Contribution"]["schema"]>[] => {
  return [
    {
      hyperstructure_entity_id: hyperstructureEntityId,
      player_address: OWNER_1_ADDRESS,
      resource_type: 1,
      amount: 1n,
    },
  ];
};

export const mockContributions = (
  hyperstructureEntityId: ID,
): ComponentValue<ClientComponents["Contribution"]["schema"]>[] => {
  return [
    {
      hyperstructure_entity_id: hyperstructureEntityId,
      player_address: OWNER_1_ADDRESS,
      resource_type: 1,
      amount: 1n,
    },
    {
      hyperstructure_entity_id: hyperstructureEntityId,
      player_address: OWNER_2_ADDRESS,
      resource_type: 2,
      amount: 1n,
    },
  ];
};
