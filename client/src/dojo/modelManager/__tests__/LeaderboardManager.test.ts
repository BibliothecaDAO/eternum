import { afterEach, describe, it, vi } from "vitest";

// const PLAYER_ADDRESS_INDEX = 0;
// const POINTS_INDEX = 1;

vi.mock("@bibliothecadao/eternum", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    HYPERSTRUCTURE_POINTS_ON_COMPLETION: 10,
    EternumGlobalConfig: {
      resources: {
        resourcePrecision: 1,
      },
      tick: {
        defaultTickIntervalInSeconds: 1,
      },
    },
    HYPERSTRUCTURE_TOTAL_COSTS_SCALED: [
      { resource: 1, amount: 1 },
      { resource: 2, amount: 1 },
    ],
    HyperstructureResourceMultipliers: {
      ["1"]: 1.0,
      ["2"]: 1.0,
    },
  };
});

afterEach(() => {
  //   LeaderboardManager.instance()["pointsOnCompletionPerPlayer"].clear();
  //   LeaderboardManager.instance()["eventsCoOwnersChange"] = [];
});

describe("basic functionalities", () => {
  it("should return a valid object", () => {
    // expect(leaderboardManager).toBeDefined();
  });
});

// describe("parseHyperstructureFinishedEvent", () => {
//   it("should return the correct hyperstructureEntityId and timestamp", () => {
//     const event = generateMockHyperstructureFinishedEvent(HYPERSTRUCTURE_ENTITY_ID);

//     const { hyperstructureEntityId, timestamp } = leaderboardManager["parseHyperstructureFinishedEvent"](event);

//     expect(hyperstructureEntityId).toBe(HYPERSTRUCTURE_ENTITY_ID);
//     expect(timestamp).toBe(TIMESTAMP);
//   });
// });

// describe("parseCoOwnersChangeEvent", () => {
//   it("should return the correct hyperstructureEntityId and timestamp", () => {
//     const event = generateMockCoOwnersChangeEvent(HYPERSTRUCTURE_ENTITY_ID);

//     const { hyperstructureEntityId, timestamp, coOwners } = leaderboardManager["parseCoOwnersChangeEvent"](event);

//     expect(hyperstructureEntityId).toBe(HYPERSTRUCTURE_ENTITY_ID);
//     expect(timestamp).toBe(TIMESTAMP);

//     const coOwner1 = coOwners[0];
//     expect(coOwner1.address).toBe(OWNER_1_ADDRESS);
//     expect(coOwner1.percentage).toBe(OWNER_1_SHARES);

//     const coOwner2 = coOwners[1];
//     expect(coOwner2.address).toBe(OWNER_2_ADDRESS);
//     expect(coOwner2.percentage).toBe(OWNER_2_SHARES);
//   });
// });

// describe("processHyperstructureFinishedEventData", () => {
//   it("should have an empty map on creation ", () => {
//     expect(leaderboardManager["pointsOnCompletionPerPlayer"].size).toBe(0);
//   });

//   it("should produce a valid map for pointsOnCompletionPerPlayer", () => {
//     const event = generateMockHyperstructureFinishedEvent(HYPERSTRUCTURE_ENTITY_ID);

//     const { hyperstructureEntityId, timestamp } = leaderboardManager.processHyperstructureFinishedEventData(
//       event,
//       mockContributions,
//     );

//     expect(hyperstructureEntityId).toBe(HYPERSTRUCTURE_ENTITY_ID);
//     expect(timestamp).toBe(TIMESTAMP);

//     const pointsMap = leaderboardManager["pointsOnCompletionPerPlayer"];

//     expect(pointsMap.has(OWNER_1_ADDRESS)).toBe(true);
//     expect(pointsMap.has(OWNER_2_ADDRESS)).toBe(true);

//     const owner1Points = pointsMap.get(OWNER_1_ADDRESS)?.get(HYPERSTRUCTURE_ENTITY_ID);
//     const owner2Points = pointsMap.get(OWNER_2_ADDRESS)?.get(HYPERSTRUCTURE_ENTITY_ID);

//     expect(owner1Points).toBeDefined();
//     expect(owner1Points).toBe(5);
//     expect(owner2Points).toBeDefined();
//     expect(owner2Points).toBe(5);

//     // Assert that the total points equal HYPERSTRUCTURE_POINTS_ON_COMPLETION
//     expect(owner1Points! + owner2Points!).toBe(HYPERSTRUCTURE_POINTS_ON_COMPLETION);
//   });

//   it("should produce a valid map for 2 events processed", () => {
//     const event = generateMockHyperstructureFinishedEvent(HYPERSTRUCTURE_ENTITY_ID);

//     const { hyperstructureEntityId, timestamp } = leaderboardManager.processHyperstructureFinishedEventData(
//       event,
//       mockContributions,
//     );

//     expect(hyperstructureEntityId).toBe(HYPERSTRUCTURE_ENTITY_ID);
//     expect(timestamp).toBe(TIMESTAMP);

//     const event2 = generateMockHyperstructureFinishedEvent(HYPERSTRUCTURE_ENTITY_ID + 1);

//     const { hyperstructureEntityId: hyperstructureEntityId2, timestamp: timestamp2 } =
//       leaderboardManager.processHyperstructureFinishedEventData(event2, mockContributions);

//     expect(hyperstructureEntityId2).toBe(HYPERSTRUCTURE_ENTITY_ID + 1);
//     expect(timestamp2).toBe(TIMESTAMP);

//     const pointsMap = leaderboardManager["pointsOnCompletionPerPlayer"];

//     expect(pointsMap.has(OWNER_1_ADDRESS)).toBe(true);
//     expect(pointsMap.has(OWNER_2_ADDRESS)).toBe(true);

//     const owner1Points = pointsMap.get(OWNER_1_ADDRESS)?.get(HYPERSTRUCTURE_ENTITY_ID);
//     const owner2Points = pointsMap.get(OWNER_2_ADDRESS)?.get(HYPERSTRUCTURE_ENTITY_ID);

//     expect(owner1Points).toBeDefined();
//     expect(owner1Points).toBeCloseTo(5.0, 2);
//     expect(owner2Points).toBeDefined();
//     expect(owner2Points).toBeCloseTo(5.0, 2);

//     const owner1Points2 = pointsMap.get(OWNER_1_ADDRESS)?.get(HYPERSTRUCTURE_ENTITY_ID + 1);
//     const owner2Points2 = pointsMap.get(OWNER_2_ADDRESS)?.get(HYPERSTRUCTURE_ENTITY_ID + 1);

//     expect(owner1Points2).toBeDefined();
//     expect(owner1Points2).toBeCloseTo(5.0, 2);
//     expect(owner2Points2).toBeDefined();
//     expect(owner2Points2).toBeCloseTo(5.0, 2);

//     expect(owner1Points! + owner2Points!).toBe(HYPERSTRUCTURE_POINTS_ON_COMPLETION);
//     expect(owner1Points2! + owner2Points2!).toBe(HYPERSTRUCTURE_POINTS_ON_COMPLETION);

//     expect(owner1Points! + owner1Points2!).toBeCloseTo(10.0, 2);
//     expect(owner2Points! + owner2Points2!).toBeCloseTo(10.0, 2);
//   });
// });

// describe("processHyperstructureCoOwnersChangeEvent", () => {
//   it("should have an empty array on creation ", () => {
//     expect(leaderboardManager["eventsCoOwnersChange"].length).toBe(0);
//   });

//   it("should produce a valid array for one event processed", () => {
//     const event = generateMockCoOwnersChangeEvent(HYPERSTRUCTURE_ENTITY_ID);

//     const { hyperstructureEntityId, timestamp, coOwners } =
//       leaderboardManager.processHyperstructureCoOwnersChangeEvent(event);

//     expect(hyperstructureEntityId).toBe(HYPERSTRUCTURE_ENTITY_ID);
//     expect(timestamp).toBe(TIMESTAMP);

//     expect(coOwners.length).toBe(2);

//     const coOwner1 = coOwners[0];
//     expect(coOwner1.address).toBe(OWNER_1_ADDRESS);
//     expect(coOwner1.percentage).toBe(OWNER_1_SHARES);

//     const coOwner2 = coOwners[1];
//     expect(coOwner2.address).toBe(OWNER_2_ADDRESS);
//     expect(coOwner2.percentage).toBe(OWNER_2_SHARES);

//     expect(leaderboardManager["eventsCoOwnersChange"].length).toBe(1);
//     const storedEvent = leaderboardManager["eventsCoOwnersChange"][0];
//     expect(storedEvent.coOwners.length).toBe(2);

//     const storedCoOwner1 = storedEvent.coOwners[0];
//     expect(storedCoOwner1.address).toBe(OWNER_1_ADDRESS);
//     expect(storedCoOwner1.percentage).toBe(OWNER_1_SHARES);

//     const storedCoOwner2 = storedEvent.coOwners[1];
//     expect(storedCoOwner2.address).toBe(OWNER_2_ADDRESS);
//     expect(storedCoOwner2.percentage).toBe(OWNER_2_SHARES);
//   });

//   it("should produce a valid array for two events processed", () => {
//     const event = generateMockCoOwnersChangeEvent(HYPERSTRUCTURE_ENTITY_ID);

//     const { hyperstructureEntityId } = leaderboardManager.processHyperstructureCoOwnersChangeEvent(event);
//     expect(hyperstructureEntityId).toBe(HYPERSTRUCTURE_ENTITY_ID);

//     const event2 = generateMockCoOwnersChangeEvent(HYPERSTRUCTURE_ENTITY_ID + 1);
//     const { hyperstructureEntityId: hyperstructureEntityId2 } =
//       leaderboardManager.processHyperstructureCoOwnersChangeEvent(event2);
//     expect(hyperstructureEntityId2).toBe(HYPERSTRUCTURE_ENTITY_ID + 1);

//     expect(leaderboardManager["eventsCoOwnersChange"].length).toBe(2);
//     const storedEvent = leaderboardManager["eventsCoOwnersChange"][0];
//     expect(storedEvent.coOwners.length).toBe(2);

//     const storedCoOwner1 = storedEvent.coOwners[0];
//     expect(storedCoOwner1.address).toBe(OWNER_1_ADDRESS);
//     expect(storedCoOwner1.percentage).toBe(OWNER_1_SHARES);

//     const storedCoOwner2 = storedEvent.coOwners[1];
//     expect(storedCoOwner2.address).toBe(OWNER_2_ADDRESS);
//     expect(storedCoOwner2.percentage).toBe(OWNER_2_SHARES);
//   });
// });

// describe("getShares", () => {
//   it("should return undefined if no change co owner event occured", () => {
//     expect(leaderboardManager.getAddressShares(OWNER_1_ADDRESS, HYPERSTRUCTURE_ENTITY_ID)).toBeUndefined();
//   });

//   it("should return undefined if an event occured but not for the right entity id", () => {
//     const event = generateMockCoOwnersChangeEvent(HYPERSTRUCTURE_ENTITY_ID);
//     leaderboardManager.processHyperstructureCoOwnersChangeEvent(event);

//     expect(leaderboardManager.getAddressShares(OWNER_1_ADDRESS, HYPERSTRUCTURE_ENTITY_ID + 1)).toBeUndefined();
//   });

//   it("should return the correct amount of shares", () => {
//     const event = generateMockCoOwnersChangeEvent(HYPERSTRUCTURE_ENTITY_ID);
//     leaderboardManager.processHyperstructureCoOwnersChangeEvent(event);

//     expect(leaderboardManager.getAddressShares(OWNER_1_ADDRESS, HYPERSTRUCTURE_ENTITY_ID)).toBe(
//       OWNER_1_SHARES / 10_000,
//     );
//   });
// });

// describe("getPlayersByRank one event", () => {
//   it("should return an empty array if no change co owner event occured", () => {
//     expect(leaderboardManager.getPlayersByRank(1)).toEqual([]);
//   });

//   it("should return the same points as the completion event for the same timestamp", () => {
//     const hyperstructureFinishedEvent = generateMockHyperstructureFinishedEvent(HYPERSTRUCTURE_ENTITY_ID);
//     leaderboardManager.processHyperstructureFinishedEventData(hyperstructureFinishedEvent, mockContributions);

//     const event = generateMockCoOwnersChangeEvent(HYPERSTRUCTURE_ENTITY_ID);
//     leaderboardManager.processHyperstructureCoOwnersChangeEvent(event);

//     const rankings = leaderboardManager.getPlayersByRank(TIMESTAMP);

//     expect(rankings[0][POINTS_INDEX]).toBe(HYPERSTRUCTURE_POINTS_ON_COMPLETION / 2);
//     expect(rankings[1][POINTS_INDEX]).toBe(HYPERSTRUCTURE_POINTS_ON_COMPLETION / 2);
//   });

//   it("should return more points as the timestamp increases - no filtering on hyperstructure entity id (events from one hyperstructure)", () => {
//     const hyperstructureFinishedEvent = generateMockHyperstructureFinishedEvent(HYPERSTRUCTURE_ENTITY_ID);
//     leaderboardManager.processHyperstructureFinishedEventData(hyperstructureFinishedEvent, mockContributions);

//     const event = generateMockCoOwnersChangeEvent(HYPERSTRUCTURE_ENTITY_ID);
//     leaderboardManager.processHyperstructureCoOwnersChangeEvent(event);

//     const rankings = leaderboardManager.getPlayersByRank(TIMESTAMP + 1);

//     expect(rankings[0][POINTS_INDEX]).toBe(
//       HYPERSTRUCTURE_POINTS_ON_COMPLETION / 2 + HYPERSTRUCTURE_POINTS_PER_CYCLE / 2,
//     );
//     expect(rankings[1][POINTS_INDEX]).toBe(
//       HYPERSTRUCTURE_POINTS_ON_COMPLETION / 2 + HYPERSTRUCTURE_POINTS_PER_CYCLE / 2,
//     );

//     const rankings2 = leaderboardManager.getPlayersByRank(TIMESTAMP + 2);

//     expect(rankings2[0][POINTS_INDEX]).toBe(HYPERSTRUCTURE_POINTS_ON_COMPLETION / 2 + HYPERSTRUCTURE_POINTS_PER_CYCLE);
//     expect(rankings2[1][POINTS_INDEX]).toBe(HYPERSTRUCTURE_POINTS_ON_COMPLETION / 2 + HYPERSTRUCTURE_POINTS_PER_CYCLE);
//   });

//   it("should return more points as the timestamp increases - filter on entity id (events from one hyperstructure)", () => {
//     const hyperstructureFinishedEvent = generateMockHyperstructureFinishedEvent(HYPERSTRUCTURE_ENTITY_ID);
//     leaderboardManager.processHyperstructureFinishedEventData(hyperstructureFinishedEvent, mockContributions);

//     const event = generateMockCoOwnersChangeEvent(HYPERSTRUCTURE_ENTITY_ID);
//     leaderboardManager.processHyperstructureCoOwnersChangeEvent(event);

//     const rankings = leaderboardManager.getPlayersByRank(TIMESTAMP + 1, HYPERSTRUCTURE_ENTITY_ID);

//     expect(rankings[0][POINTS_INDEX]).toBe(
//       HYPERSTRUCTURE_POINTS_ON_COMPLETION / 2 + HYPERSTRUCTURE_POINTS_PER_CYCLE / 2,
//     );
//     expect(rankings[1][POINTS_INDEX]).toBe(
//       HYPERSTRUCTURE_POINTS_ON_COMPLETION / 2 + HYPERSTRUCTURE_POINTS_PER_CYCLE / 2,
//     );

//     const rankings2 = leaderboardManager.getPlayersByRank(TIMESTAMP + 2, HYPERSTRUCTURE_ENTITY_ID);

//     expect(rankings2[0][POINTS_INDEX]).toBe(HYPERSTRUCTURE_POINTS_ON_COMPLETION / 2 + HYPERSTRUCTURE_POINTS_PER_CYCLE);
//     expect(rankings2[1][POINTS_INDEX]).toBe(HYPERSTRUCTURE_POINTS_ON_COMPLETION / 2 + HYPERSTRUCTURE_POINTS_PER_CYCLE);
//   });

//   it("multiple creation events - no filtering on hyperstructure entity id", () => {
//     const hyperstructureFinishedEvent = generateMockHyperstructureFinishedEvent(HYPERSTRUCTURE_ENTITY_ID);
//     leaderboardManager.processHyperstructureFinishedEventData(hyperstructureFinishedEvent, mockContributions);

//     const rankings = leaderboardManager.getPlayersByRank(TIMESTAMP);

//     expect(rankings[0][POINTS_INDEX]).toBe(HYPERSTRUCTURE_POINTS_ON_COMPLETION / 2);
//     expect(rankings[1][POINTS_INDEX]).toBe(HYPERSTRUCTURE_POINTS_ON_COMPLETION / 2);

//     const hyperstructureFinishedEvent2 = generateMockHyperstructureFinishedEvent(HYPERSTRUCTURE_ENTITY_ID + 1);
//     leaderboardManager.processHyperstructureFinishedEventData(hyperstructureFinishedEvent2, mockSingleContribution);

//     const rankings2 = leaderboardManager.getPlayersByRank(TIMESTAMP);

//     expect(rankings2[0][POINTS_INDEX]).toBe(HYPERSTRUCTURE_POINTS_ON_COMPLETION);
//     expect(rankings2[1][POINTS_INDEX]).toBe(HYPERSTRUCTURE_POINTS_ON_COMPLETION / 2);
//   });

//   it("multiple creation events - filter on entity id", () => {
//     const hyperstructureFinishedEvent = generateMockHyperstructureFinishedEvent(HYPERSTRUCTURE_ENTITY_ID);
//     leaderboardManager.processHyperstructureFinishedEventData(hyperstructureFinishedEvent, mockContributions);

//     const rankings = leaderboardManager.getPlayersByRank(TIMESTAMP, HYPERSTRUCTURE_ENTITY_ID);

//     expect(rankings[0][POINTS_INDEX]).toBe(HYPERSTRUCTURE_POINTS_ON_COMPLETION / 2);
//     expect(rankings[1][POINTS_INDEX]).toBe(HYPERSTRUCTURE_POINTS_ON_COMPLETION / 2);

//     const hyperstructureFinishedEvent2 = generateMockHyperstructureFinishedEvent(HYPERSTRUCTURE_ENTITY_ID + 1);
//     leaderboardManager.processHyperstructureFinishedEventData(hyperstructureFinishedEvent2, mockSingleContribution);

//     const rankings2 = leaderboardManager.getPlayersByRank(TIMESTAMP, HYPERSTRUCTURE_ENTITY_ID);

//     expect(rankings2[0][POINTS_INDEX]).toBe(HYPERSTRUCTURE_POINTS_ON_COMPLETION / 2);
//     expect(rankings2[1][POINTS_INDEX]).toBe(HYPERSTRUCTURE_POINTS_ON_COMPLETION / 2);

//     const rankings3 = leaderboardManager.getPlayersByRank(TIMESTAMP, HYPERSTRUCTURE_ENTITY_ID + 1);

//     expect(rankings3[0][POINTS_INDEX]).toBe(HYPERSTRUCTURE_POINTS_ON_COMPLETION / 2);
//     expect(rankings3[1][POINTS_INDEX]).toBe(0);
//   });

//   it("multiple ownership events - no filtering on hyperstructure entity id", () => {
//     const hyperstructureFinishedEvent = generateMockHyperstructureFinishedEvent(HYPERSTRUCTURE_ENTITY_ID);
//     leaderboardManager.processHyperstructureFinishedEventData(hyperstructureFinishedEvent, mockContributions);

//     const rankings = leaderboardManager.getPlayersByRank(TIMESTAMP);

//     expect(rankings[0][POINTS_INDEX]).toBe(HYPERSTRUCTURE_POINTS_ON_COMPLETION / 2);
//     expect(rankings[1][POINTS_INDEX]).toBe(HYPERSTRUCTURE_POINTS_ON_COMPLETION / 2);

//     const coOwnersChange1 = generateMockCoOwnersChangeEvent(HYPERSTRUCTURE_ENTITY_ID, TIMESTAMP);
//     leaderboardManager.processHyperstructureCoOwnersChangeEvent(coOwnersChange1);

//     const rankings2 = leaderboardManager.getPlayersByRank(TIMESTAMP);

//     expect(rankings2[0][POINTS_INDEX]).toBe(HYPERSTRUCTURE_POINTS_ON_COMPLETION / 2);
//     expect(rankings2[1][POINTS_INDEX]).toBe(HYPERSTRUCTURE_POINTS_ON_COMPLETION / 2);

//     const rankings3 = leaderboardManager.getPlayersByRank(TIMESTAMP + 1);

//     expect(rankings3[0][POINTS_INDEX]).toBe(
//       HYPERSTRUCTURE_POINTS_ON_COMPLETION / 2 + HYPERSTRUCTURE_POINTS_PER_CYCLE / 2,
//     );
//     expect(rankings3[1][POINTS_INDEX]).toBe(
//       HYPERSTRUCTURE_POINTS_ON_COMPLETION / 2 + HYPERSTRUCTURE_POINTS_PER_CYCLE / 2,
//     );

//     const hyperstructureFinishedEvent2 = generateMockCoOwnersChangeEvent(HYPERSTRUCTURE_ENTITY_ID);
//     leaderboardManager.processHyperstructureCoOwnersChangeEvent(hyperstructureFinishedEvent2);

//     const rankings4 = leaderboardManager.getPlayersByRank(TIMESTAMP + 2);

//     expect(rankings4[0][POINTS_INDEX]).toBe(
//       HYPERSTRUCTURE_POINTS_ON_COMPLETION / 2 + HYPERSTRUCTURE_POINTS_PER_CYCLE * 2,
//     );
//     expect(rankings4[1][POINTS_INDEX]).toBe(
//       HYPERSTRUCTURE_POINTS_ON_COMPLETION / 2 + HYPERSTRUCTURE_POINTS_PER_CYCLE * 2,
//     );
//   });

//   it("multiple ownership events - filtering on hyperstructure entity id", () => {
//     const hyperstructureFinishedEvent = generateMockHyperstructureFinishedEvent(HYPERSTRUCTURE_ENTITY_ID);
//     leaderboardManager.processHyperstructureFinishedEventData(hyperstructureFinishedEvent, mockContributions);

//     const rankings = leaderboardManager.getPlayersByRank(TIMESTAMP, HYPERSTRUCTURE_ENTITY_ID);

//     expect(rankings[0][POINTS_INDEX]).toBe(HYPERSTRUCTURE_POINTS_ON_COMPLETION / 2);
//     expect(rankings[1][POINTS_INDEX]).toBe(HYPERSTRUCTURE_POINTS_ON_COMPLETION / 2);

//     const coOwnersChange1 = generateMockCoOwnersChangeEvent(HYPERSTRUCTURE_ENTITY_ID, TIMESTAMP);
//     leaderboardManager.processHyperstructureCoOwnersChangeEvent(coOwnersChange1);

//     const rankings2 = leaderboardManager.getPlayersByRank(TIMESTAMP, HYPERSTRUCTURE_ENTITY_ID);

//     expect(rankings2[0][POINTS_INDEX]).toBe(HYPERSTRUCTURE_POINTS_ON_COMPLETION / 2);
//     expect(rankings2[1][POINTS_INDEX]).toBe(HYPERSTRUCTURE_POINTS_ON_COMPLETION / 2);

//     const rankings3 = leaderboardManager.getPlayersByRank(TIMESTAMP + 1, HYPERSTRUCTURE_ENTITY_ID);

//     expect(rankings3[0][POINTS_INDEX]).toBe(
//       HYPERSTRUCTURE_POINTS_ON_COMPLETION / 2 + HYPERSTRUCTURE_POINTS_PER_CYCLE / 2,
//     );
//     expect(rankings3[1][POINTS_INDEX]).toBe(
//       HYPERSTRUCTURE_POINTS_ON_COMPLETION / 2 + HYPERSTRUCTURE_POINTS_PER_CYCLE / 2,
//     );

//     const hyperstructureFinishedEvent2 = generateMockCoOwnersChangeEvent(HYPERSTRUCTURE_ENTITY_ID);
//     leaderboardManager.processHyperstructureCoOwnersChangeEvent(hyperstructureFinishedEvent2);

//     const rankings4 = leaderboardManager.getPlayersByRank(TIMESTAMP + 2, HYPERSTRUCTURE_ENTITY_ID);

//     expect(rankings4[0][POINTS_INDEX]).toBe(
//       HYPERSTRUCTURE_POINTS_ON_COMPLETION / 2 + HYPERSTRUCTURE_POINTS_PER_CYCLE * 2,
//     );
//     expect(rankings4[1][POINTS_INDEX]).toBe(
//       HYPERSTRUCTURE_POINTS_ON_COMPLETION / 2 + HYPERSTRUCTURE_POINTS_PER_CYCLE * 2,
//     );
//   });

//   it("player 1 contributed to hs1 and hs2, player 2 contributed to hs1 but is owner of hs2", () => {
//     const hs1FinishedEvent = generateMockHyperstructureFinishedEvent(HYPERSTRUCTURE_ENTITY_ID);
//     leaderboardManager.processHyperstructureFinishedEventData(hs1FinishedEvent, mockContributions);

//     const hs2FinishedEvent = generateMockHyperstructureFinishedEvent(HYPERSTRUCTURE_ENTITY_ID + 1);
//     leaderboardManager.processHyperstructureFinishedEventData(hs2FinishedEvent, mockSingleContribution);

//     const rankings = leaderboardManager.getPlayersByRank(TIMESTAMP);
//     // points for player 1 should be higher than player 2 because he contributed to hs1 and hs2
//     expect(rankings[0][POINTS_INDEX]).toBe(HYPERSTRUCTURE_POINTS_ON_COMPLETION);
//     expect(rankings[1][POINTS_INDEX]).toBe(HYPERSTRUCTURE_POINTS_ON_COMPLETION / 2);

//     const rankings2 = leaderboardManager.getPlayersByRank(TIMESTAMP, HYPERSTRUCTURE_ENTITY_ID);

//     // points for player 1 should be the same as player 2 because they both contributed to hs1
//     expect(rankings2[0][POINTS_INDEX]).toBe(HYPERSTRUCTURE_POINTS_ON_COMPLETION / 2);
//     expect(rankings2[1][POINTS_INDEX]).toBe(HYPERSTRUCTURE_POINTS_ON_COMPLETION / 2);

//     const rankings3 = leaderboardManager.getPlayersByRank(TIMESTAMP, HYPERSTRUCTURE_ENTITY_ID + 1);

//     // points for player 1 should be the bigger than player 2 because he's the only one who contributed to hs2
//     expect(rankings3[0][POINTS_INDEX]).toBe(HYPERSTRUCTURE_POINTS_ON_COMPLETION / 2);
//     expect(rankings3[1][POINTS_INDEX]).toBe(0);

//     const hs1CoOwnersChangeEvent = generateMockCoOwnersChangeEvent(HYPERSTRUCTURE_ENTITY_ID, undefined, {
//       playerOne: 5000,
//       playerTwo: 5000,
//     });
//     leaderboardManager.processHyperstructureCoOwnersChangeEvent(hs1CoOwnersChangeEvent);

//     const rankings4 = leaderboardManager.getPlayersByRank(TIMESTAMP + 1, HYPERSTRUCTURE_ENTITY_ID);
//     expect(rankings4[0][POINTS_INDEX]).toBe(
//       HYPERSTRUCTURE_POINTS_ON_COMPLETION / 2 + HYPERSTRUCTURE_POINTS_PER_CYCLE / 2,
//     );
//     expect(rankings4[1][POINTS_INDEX]).toBe(
//       HYPERSTRUCTURE_POINTS_ON_COMPLETION / 2 + HYPERSTRUCTURE_POINTS_PER_CYCLE / 2,
//     );

//     const rankings5 = leaderboardManager.getPlayersByRank(TIMESTAMP + 1, HYPERSTRUCTURE_ENTITY_ID + 1);
//     expect(rankings5[0][POINTS_INDEX]).toBe(HYPERSTRUCTURE_POINTS_ON_COMPLETION / 2);
//     expect(rankings5[1][POINTS_INDEX]).toBe(0);

//     const rankings6 = leaderboardManager.getPlayersByRank(TIMESTAMP + 1);
//     expect(rankings6[0][POINTS_INDEX]).toBe(
//       (HYPERSTRUCTURE_POINTS_ON_COMPLETION / 2) * 2 + HYPERSTRUCTURE_POINTS_PER_CYCLE / 2,
//     );
//     expect(rankings6[1][POINTS_INDEX]).toBe(
//       HYPERSTRUCTURE_POINTS_ON_COMPLETION / 2 + HYPERSTRUCTURE_POINTS_PER_CYCLE / 2,
//     );

//     const hs2CoOwnersChangeEvent = generateMockCoOwnersChangeEvent(HYPERSTRUCTURE_ENTITY_ID + 1, TIMESTAMP + 1, {
//       playerOne: 0,
//       playerTwo: 10000,
//     });
//     leaderboardManager.processHyperstructureCoOwnersChangeEvent(hs2CoOwnersChangeEvent);

//     const rankings7 = leaderboardManager.getPlayersByRank(TIMESTAMP + 1, HYPERSTRUCTURE_ENTITY_ID + 1);

//     expect(rankings7[0][POINTS_INDEX]).toBe(HYPERSTRUCTURE_POINTS_ON_COMPLETION / 2);
//     expect(rankings7[1][POINTS_INDEX]).toBe(0);

//     const rankings8 = leaderboardManager.getPlayersByRank(TIMESTAMP + 1);
//     expect(rankings8[0][POINTS_INDEX]).toBe(
//       (HYPERSTRUCTURE_POINTS_ON_COMPLETION / 2) * 2 + HYPERSTRUCTURE_POINTS_PER_CYCLE / 2,
//     );
//     expect(rankings8[1][POINTS_INDEX]).toBe(
//       HYPERSTRUCTURE_POINTS_ON_COMPLETION / 2 + HYPERSTRUCTURE_POINTS_PER_CYCLE / 2,
//     );

//     rankings8[0][PLAYER_ADDRESS_INDEX];

//     const rankings9 = leaderboardManager.getPlayersByRank(TIMESTAMP + 1, HYPERSTRUCTURE_ENTITY_ID);
//     const rankings10 = leaderboardManager.getPlayersByRank(TIMESTAMP + 1, HYPERSTRUCTURE_ENTITY_ID + 1);
//     const rankings11 = leaderboardManager.getPlayersByRank(TIMESTAMP + 1);

//     expect(rankings9[0][POINTS_INDEX] + rankings10[0][POINTS_INDEX]).toBe(rankings11[0][POINTS_INDEX]);
//     expect(rankings9[1][POINTS_INDEX] + rankings10[1][POINTS_INDEX]).toBe(rankings11[1][POINTS_INDEX]);
//   });
// });
