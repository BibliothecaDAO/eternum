import { GuildFromPlayerAddress } from "@/hooks/helpers/useGuilds";
import {
  ContractAddress,
  HYPERSTRUCTURE_POINTS_ON_COMPLETION,
  HYPERSTRUCTURE_POINTS_PER_CYCLE,
  ID,
  TickIds,
} from "@bibliothecadao/eternum";
import { ComponentValue } from "@dojoengine/recs";
import { ClientComponents } from "../createClientComponents";
import { Event } from "../events/graphqlClient";
import { ClientConfigManager } from "./ClientConfigManager";
import { computeInitialContributionPoints } from "./utils/LeaderboardUtils";

const HYPERSTRUCTURE_ENTITY_ID_INDEX = 0;
const EVENT_TIMESTAMP_INDEX = 1;
const CO_OWNERS_LENGTH_INDEX = 2;
const CO_OWNERS_RAW_START_INDEX = 3;

const CO_OWNERS_CELL_SIZE = 2;

export interface HyperstructureFinishedEvent {
  hyperstructureEntityId: ID;
  timestamp: number;
}

interface HyperstructureCoOwnersChange {
  hyperstructureEntityId: ID;
  coOwners: { address: ContractAddress; percentage: number }[];
  timestamp: number;
}

export class LeaderboardManager {
  private static _instance: LeaderboardManager;

  private eventsCoOwnersChange: HyperstructureCoOwnersChange[] = [];

  private pointsOnCompletionPerPlayer;

  private constructor() {
    this.pointsOnCompletionPerPlayer = new Map<ContractAddress, Map<ID, number>>();
  }

  public static instance() {
    if (!LeaderboardManager._instance) {
      LeaderboardManager._instance = new LeaderboardManager();
    }
    return LeaderboardManager._instance;
  }

  public getCurrentCoOwners(hyperstructureEntityId: ID) {
    return this.eventsCoOwnersChange.findLast((event) => event.hyperstructureEntityId === hyperstructureEntityId);
  }

  public getGuildsByRank(
    currentTimestamp: number,
    getGuildFromPlayerAddress: (playerAddress: ContractAddress) => GuildFromPlayerAddress | undefined,
  ) {
    const pointsPerGuild = new Map<ID, number>();

    this.setPointsGeneratedByCompletion(pointsPerGuild, undefined, getGuildFromPlayerAddress);

    this.setPointsGeneratedByShares(currentTimestamp, pointsPerGuild, undefined, getGuildFromPlayerAddress);

    return Array.from(pointsPerGuild).sort(([_A, guildA], [_B, guildB]) => guildB - guildA);
  }

  public getPlayersByRank(currentTimestamp: number, hyperstructureEntityId?: ID) {
    if (this.pointsOnCompletionPerPlayer.size === 0) return [];

    const pointsPerPlayer: Map<ContractAddress, number> = new Map();

    this.setPointsGeneratedByCompletion(pointsPerPlayer, hyperstructureEntityId);

    this.setPointsGeneratedByShares(currentTimestamp, pointsPerPlayer, hyperstructureEntityId);

    return Array.from(pointsPerPlayer).sort(([_A, playerA], [_B, playerB]) => playerB - playerA);
  }

  public getShares(playerAddress: ContractAddress, hyperstructureEntityId: ID) {
    const lastChangeEvent = this.eventsCoOwnersChange.findLast(
      (event) => event.hyperstructureEntityId === hyperstructureEntityId,
    );

    if (!lastChangeEvent) return;

    return (lastChangeEvent.coOwners.find((coOwner) => coOwner.address === playerAddress)?.percentage || 0) / 10_000;
  }

  public processHyperstructureFinishedEventData(
    eventData: Event,
    getContributions: (
      hyperstructureEntityId: ID,
    ) => (ComponentValue<ClientComponents["Contribution"]["schema"]> | undefined)[],
  ): HyperstructureFinishedEvent {
    const parsedEvent = this.parseHyperstructureFinishedEvent(eventData);

    const contributions = getContributions(parsedEvent.hyperstructureEntityId);

    contributions.forEach((contribution) => {
      if (!contribution) return;

      const playerAddress = contribution.player_address;
      const points = computeInitialContributionPoints(
        contribution.resource_type,
        contribution.amount,
        HYPERSTRUCTURE_POINTS_ON_COMPLETION,
      );

      const playerPointsForEachHyperstructure =
        this.pointsOnCompletionPerPlayer.get(playerAddress) || new Map<ID, number>();

      const previousPoints = playerPointsForEachHyperstructure.get(parsedEvent.hyperstructureEntityId) || 0;

      playerPointsForEachHyperstructure.set(parsedEvent.hyperstructureEntityId, previousPoints + points);

      this.pointsOnCompletionPerPlayer.set(playerAddress, playerPointsForEachHyperstructure);
    });
    return parsedEvent;
  }

  public processHyperstructureCoOwnersChangeEvent(eventData: Event): HyperstructureCoOwnersChange {
    const parsedEvent = this.parseCoOwnersChangeEvent(eventData);

    this.eventsCoOwnersChange.push(parsedEvent);

    // ascending order
    this.eventsCoOwnersChange.sort((a, b) => a.timestamp - b.timestamp);

    return parsedEvent;
  }

  private parseHyperstructureFinishedEvent(eventData: Event): HyperstructureFinishedEvent {
    const [hyperstructureEntityId, timestamp] = eventData.data;

    return {
      hyperstructureEntityId: ID(hyperstructureEntityId),
      timestamp: Number(timestamp),
    };
  }

  private parseCoOwnersChangeEvent(eventData: Event): HyperstructureCoOwnersChange {
    const hyperstructureEntityId = ID(eventData.data[HYPERSTRUCTURE_ENTITY_ID_INDEX]);
    const timestamp = Number(eventData.data[EVENT_TIMESTAMP_INDEX]);

    const coOwnersLength = Number(eventData.data[CO_OWNERS_LENGTH_INDEX]);
    const coOwnersRaw = eventData.data.slice(
      CO_OWNERS_RAW_START_INDEX,
      CO_OWNERS_RAW_START_INDEX + coOwnersLength * CO_OWNERS_CELL_SIZE,
    );
    const coOwners = [];
    for (let i = 0; i < coOwnersLength * CO_OWNERS_CELL_SIZE; i += CO_OWNERS_CELL_SIZE) {
      const address = ContractAddress(coOwnersRaw[i]);
      const percentage = Number(coOwnersRaw[i + 1]);
      coOwners.push({ address, percentage });
    }

    return {
      hyperstructureEntityId,
      coOwners,
      timestamp,
    };
  }

  private setPointsGeneratedByCompletion(
    pointsPerEntity: Map<ContractAddress | ID, number>,
    hyperstructureEntityId?: ID,
    getGuildFromPlayerAddress?: (playerAddress: ContractAddress) => GuildFromPlayerAddress | undefined,
  ) {
    this.pointsOnCompletionPerPlayer.forEach((playerPointsForEachHyperstructure, playerAddress) => {
      const pointsOnCompletion = hyperstructureEntityId
        ? playerPointsForEachHyperstructure.get(hyperstructureEntityId) || 0
        : Array.from(playerPointsForEachHyperstructure.values()).reduce((acc, points) => acc + points, 0);

      const key = getGuildFromPlayerAddress
        ? getGuildFromPlayerAddress(playerAddress)?.guildEntityId || 0
        : playerAddress;

      const previousPoints = pointsPerEntity.get(key);
      const newPoints = (previousPoints || 0) + pointsOnCompletion;
      pointsPerEntity.set(key, newPoints);
    });
  }

  private setPointsGeneratedByShares(
    currentTimestamp: number,
    pointsPerEntity: Map<ContractAddress | ID, number>,
    hyperstructureEntityId?: ID,
    getGuildFromPlayerAddress?: (playerAddress: ContractAddress) => GuildFromPlayerAddress | undefined,
  ) {
    const config = ClientConfigManager.instance();
    const defaultTickIntervalInSeconds = config.getTick(TickIds.Default);

    const coOwnersChangeEvents = hyperstructureEntityId
      ? this.eventsCoOwnersChange.filter((event) => event.hyperstructureEntityId === hyperstructureEntityId)
      : this.eventsCoOwnersChange;

    coOwnersChangeEvents.sort((a, b) => a.timestamp - b.timestamp);

    coOwnersChangeEvents.map((event) => {
      const nextChange = coOwnersChangeEvents.find(
        (nextEvent) =>
          nextEvent.hyperstructureEntityId === event.hyperstructureEntityId && nextEvent.timestamp > event.timestamp,
      );

      const timePeriod = nextChange ? nextChange.timestamp - event.timestamp : currentTimestamp - event.timestamp;

      const nbOfCycles = timePeriod / defaultTickIntervalInSeconds;

      const totalPoints = nbOfCycles * HYPERSTRUCTURE_POINTS_PER_CYCLE;

      event.coOwners.forEach((coOwner) => {
        const key = getGuildFromPlayerAddress
          ? getGuildFromPlayerAddress(coOwner.address)?.guildEntityId || 0
          : coOwner.address;

        const previousPoints = pointsPerEntity.get(key) || 0;

        const newPoints = previousPoints + totalPoints * (coOwner.percentage / 10_000);

        pointsPerEntity.set(key, newPoints);
      });
    });
  }
}
