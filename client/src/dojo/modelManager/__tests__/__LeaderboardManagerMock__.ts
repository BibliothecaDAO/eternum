import { ClientComponents } from "@/dojo/createClientComponents";
import { Event } from "@/dojo/events/graphqlClient";
import { ID } from "@bibliothecadao/eternum";
import { ComponentValue } from "@dojoengine/recs";

export const HYPERSTRUCTURE_ENTITY_ID = 1;
export const TIMESTAMP = 1;

export const OWNER_1_ADDRESS = 1n;
export const OWNER_2_ADDRESS = 2n;

export const OWNER_1_SHARES = 5000;
export const OWNER_2_SHARES = 5000;
export const CO_OWNERS = [OWNER_1_ADDRESS, OWNER_1_SHARES, OWNER_2_ADDRESS, OWNER_2_SHARES].map(
  (value) => `0x${value.toString(16)}`,
);

export const generateMockHyperstructureFinishedEvent = (hyperstructureEntityId: ID): Event => {
  return {
    id: ["0x1"],
    keys: ["0xEVENTFINISHED"],
    data: [hyperstructureEntityId.toString(16), TIMESTAMP.toString(16)],
    createdAt: "1",
  };
};

export const generateMockCoOwnersChangeEvent = (
  hyperstructureEntityId: ID,
  timestamp?: number,
  shares?: { playerOne: number; playerTwo: number },
): Event => {
  const coOwners = shares
    ? [OWNER_1_ADDRESS, shares.playerOne, OWNER_2_ADDRESS, shares.playerTwo].map((value) => `0x${value.toString(16)}`)
    : CO_OWNERS.map((value) => value);
  return {
    id: ["0x1"],
    keys: ["0xEVENTFINISHED"],
    data: [
      hyperstructureEntityId.toString(16),
      timestamp ? timestamp.toString(16) : TIMESTAMP.toString(16),
      (CO_OWNERS.length / 2).toString(16),
      ...coOwners,
    ],
    createdAt: "1",
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
