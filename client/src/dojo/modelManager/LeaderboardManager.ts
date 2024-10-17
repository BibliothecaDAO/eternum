import { GuildFromPlayerAddress } from "@/hooks/helpers/useGuilds";
import { ContractAddress, ID, TickIds } from "@bibliothecadao/eternum";
import { ComponentValue } from "@dojoengine/recs";
import { ClientComponents } from "../createClientComponents";
import { ClientConfigManager } from "./ConfigManager";
import { computeInitialContributionPoints } from "./utils/LeaderboardUtils";

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

  private configManager: ClientConfigManager;

  private constructor() {
    this.pointsOnCompletionPerPlayer = new Map<ContractAddress, Map<ID, number>>();
    this.configManager = ClientConfigManager.instance();
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

  public getAddressShares(playerAddress: ContractAddress, hyperstructureEntityId: ID) {
    const lastChangeEvent = this.eventsCoOwnersChange.findLast(
      (event) => event.hyperstructureEntityId === hyperstructureEntityId,
    );

    if (!lastChangeEvent) return;

    return (lastChangeEvent.coOwners.find((coOwner) => coOwner.address === playerAddress)?.percentage || 0) / 10_000;
  }

  public processHyperstructureFinishedEventData(
    event: ClientComponents["events"]["HyperstructureFinished"]["schema"],
    getContributions: (
      hyperstructureEntityId: ID,
    ) => (ComponentValue<ClientComponents["Contribution"]["schema"]> | undefined)[],
  ): HyperstructureFinishedEvent {
    const parsedEvent = {
      hyperstructureEntityId: event.hyperstructure_entity_id,
      timestamp: event.timestamp,
    };

    const contributions = getContributions(parsedEvent.hyperstructureEntityId);
    const pointsOnCompletion = this.configManager.getHyperstructureConfig().pointsOnCompletion;

    contributions.forEach((contribution) => {
      if (!contribution) return;

      const playerAddress = contribution.player_address;
      const points = computeInitialContributionPoints(
        contribution.resource_type,
        contribution.amount,
        pointsOnCompletion,
      );

      const playerPointsForEachHyperstructure =
        this.pointsOnCompletionPerPlayer.get(playerAddress) || new Map<ID, number>();

      const previousPoints = playerPointsForEachHyperstructure.get(parsedEvent.hyperstructureEntityId) || 0;

      playerPointsForEachHyperstructure.set(parsedEvent.hyperstructureEntityId, previousPoints + points);

      this.pointsOnCompletionPerPlayer.set(playerAddress, playerPointsForEachHyperstructure);
    });
    return parsedEvent;
  }

  public processHyperstructureCoOwnersChangeEvent(
    event: ComponentValue<ClientComponents["events"]["HyperstructureCoOwnersChange"]["schema"]>,
  ) {
    const parsedEvent = this.parseCoOwnersChangeEvent(event);
    this.eventsCoOwnersChange.push(parsedEvent);

    // ascending order
    this.eventsCoOwnersChange.sort((a, b) => a.timestamp - b.timestamp);

    return parsedEvent;
  }

  private parseCoOwnersChangeEvent(
    event: ComponentValue<ClientComponents["events"]["HyperstructureCoOwnersChange"]["schema"]>,
  ): HyperstructureCoOwnersChange {
    return {
      hyperstructureEntityId: event.hyperstructure_entity_id,
      timestamp: event.timestamp,
      coOwners: event.co_owners.map((owner: any) => {
        const address = owner[0].value;
        const percentage = owner[1].value;
        return {
          address: ContractAddress(address),
          percentage: percentage,
        };
      }),
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

      const nbOfCycles = timePeriod / this.configManager.getTick(TickIds.Default);

      const totalPoints = nbOfCycles * this.configManager.getHyperstructureConfig().pointsPerCycle;

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
