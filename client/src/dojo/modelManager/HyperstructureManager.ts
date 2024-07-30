import { DojoResult } from "@/hooks/context/DojoContext";
import { computeContributionPoints } from "@/hooks/store/useLeaderBoardStore";
import { ComponentValue, Type } from "@dojoengine/recs";
import { Event } from "../events/graphqlClient";
import {
  HyperstructureCoOwnersChangeInterface,
  HyperstructureEventInterface,
  HyperstructureEventsQuery,
  HyperstructureFinishedEventInterface,
} from "../events/hyperstructureEventQueries";

export class HyperstructureManager {
  hyperstructureEvents: HyperstructureEventInterface = { eventsCoOwnersChange: [], eventsFinished: [] };

  private constructor() {}

  public processEvents(
    events: HyperstructureEventsQuery,
    dojo: DojoResult,
    getContributions: (hyperstructureEntityId: bigint) => (
      | ComponentValue<
          {
            hyperstructure_entity_id: Type.BigInt;
            player_address: Type.BigInt;
            resource_type: Type.BigInt;
            amount: Type.BigInt;
          },
          unknown
        >
      | undefined
    )[],
  ) {
    const { hyperstructureFinishedEvents, hyperstructureCoOwnerChangeEvents } = events;

    // get player shares on hyperstructure on event finished
    for (const event of hyperstructureFinishedEvents.edges) {
      if (this.hyperstructureEvents.eventsFinished.some((e) => e.createdAt === event.node.createdAt)) continue;

      const finishedEvent = this.parseHyperstructureFinishedEventData(event.node);
      this.hyperstructureEvents.eventsFinished.push(finishedEvent);

      let pointsPerPlayer = new Map<bigint, bigint>();
      const contributions = getContributions(finishedEvent.hyperstructureEntityId);
      for (const contribution of contributions) {
        if (!contribution) continue;

        const playerAddress = contribution.player_address;
        const amount = contribution.amount;
        const points = computeContributionPoints(1, contribution.amount, contribution.resource_type);
        pointsPerPlayer.set(playerAddress);
      }
    }

    // get player shares on hyperstructure on co-owner changes
    for (const event of hyperstructureCoOwnerChangeEvents.edges) {
      if (this.hyperstructureEvents.eventsCoOwnersChange.some((e) => e.createdAt === event.node.createdAt)) continue;

      this.hyperstructureEvents.eventsCoOwnersChange.push(this.parseHyperstructureCoOwnersChangeEventData(event.node));
    }
  }

  public parseHyperstructureFinishedEventData(eventData: Event): HyperstructureFinishedEventInterface {
    const [hyperstructureEntityId, timestamp] = eventData.data;

    return {
      createdAt: eventData.createdAt,
      hyperstructureEntityId: BigInt(hyperstructureEntityId),
      timestamp: Number(timestamp),
    };
  }

  public parseHyperstructureCoOwnersChangeEventData(eventData: Event): HyperstructureCoOwnersChangeInterface {
    const hyperstructureEntityId = eventData.data[0];
    const coOwnersLength = Number(eventData.data[1]);

    const coOwners = eventData.data.slice(2, 2 + coOwnersLength * 2);

    const timestamp = eventData.data[2 + coOwnersLength];

    const coOwnersFormatted = [];
    for (let i = 0; i < coOwnersLength; i += 2) {
      const address = coOwners[i];
      const percentage = coOwners[i + 1];
      coOwnersFormatted.push({ address, percentage: Number(percentage) });
    }

    return {
      createdAt: eventData.createdAt,
      hyperstructureEntityId: BigInt(hyperstructureEntityId),
      co_owners: coOwnersFormatted,
      timestamp: Number(timestamp),
    };
  }
}
