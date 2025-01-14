import { Entity, getComponentValue, HasValue, runQuery } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { RESOURCE_RARITY, ResourcesIds, WORLD_CONFIG_ID } from "../constants";
import { ClientComponents } from "../dojo/createClientComponents";
import { ContractAddress, GuildInfo, ID, TickIds } from "../types";
import { configManager } from "./ConfigManager";

export class LeaderboardManager {
  private static _instance: LeaderboardManager;

  constructor(private readonly components: ClientComponents) {}

  public static instance(components: ClientComponents) {
    if (!LeaderboardManager._instance) {
      LeaderboardManager._instance = new LeaderboardManager(components);
    }
    return LeaderboardManager._instance;
  }

  public getCurrentCoOwners(
    hyperstructureEntityId: ID,
  ): { coOwners: { address: ContractAddress; percentage: number }[]; timestamp: number } | undefined {
    const hyperstructure = getComponentValue(
      this.components.Hyperstructure,
      getEntityIdFromKeys([BigInt(hyperstructureEntityId)]),
    );
    if (!hyperstructure) return;

    const epochIndex = hyperstructure.current_epoch - 1 >= 0 ? hyperstructure.current_epoch - 1 : 0;
    const currentEpoch = getComponentValue(
      this.components.Epoch,
      getEntityIdFromKeys([BigInt(hyperstructureEntityId), BigInt(epochIndex)]),
    );
    if (!currentEpoch) return;

    const coOwners = (currentEpoch.owners as any).map((owner: any) => {
      let [owner_address, percentage] = owner.value.map((value: any) => value.value);
      return { address: ContractAddress(owner_address), percentage: Number(percentage) };
    });

    return { coOwners, timestamp: Number(currentEpoch.start_timestamp) };
  }

  public getGuildsByRank(
    currentTimestamp: number,
    getGuildFromPlayerAddress: (playerAddress: ContractAddress) => GuildInfo | undefined,
  ): [ID, number][] {
    const pointsPerGuild = new Map<ID, number>();

    const season = getComponentValue(this.components.Season, getEntityIdFromKeys([WORLD_CONFIG_ID]));
    if (!season) return [];
    const finishedHyperstructuresEntityIds = runQuery([HasValue(this.components.Hyperstructure, { completed: true })]);

    this.getPoints(
      Array.from(finishedHyperstructuresEntityIds),
      currentTimestamp,
      (address) => getGuildFromPlayerAddress(address)?.entityId,
      pointsPerGuild,
    );
    return Array.from(pointsPerGuild).sort(([_A, guildA], [_B, guildB]) => guildB - guildA);
  }

  public getPlayersByRank(currentTimestamp: number, hyperstructureEntityId?: ID): [ContractAddress, number][] {
    const pointsPerPlayer = new Map<ContractAddress, number>();

    const finishedHyperstructuresEntityIds = hyperstructureEntityId
      ? [getEntityIdFromKeys([BigInt(hyperstructureEntityId)])]
      : Array.from(runQuery([HasValue(this.components.Hyperstructure, { completed: true })]));

    this.getPoints(finishedHyperstructuresEntityIds, currentTimestamp, (address) => address, pointsPerPlayer);

    return Array.from(pointsPerPlayer).sort(([_A, playerA], [_B, playerB]) => playerB - playerA);
  }

  public getPoints(
    hyperstructuresEntityIds: Entity[],
    currentTimestamp: number,
    getKey: (identifier: ContractAddress) => any,
    keyPointsMap: Map<any, number>,
  ): boolean {
    const season = getComponentValue(this.components.Season, getEntityIdFromKeys([WORLD_CONFIG_ID]));
    if (!season) return false;

    const pointsOnCompletion = configManager.getHyperstructureConfig().pointsOnCompletion;

    hyperstructuresEntityIds.forEach((entityId) => {
      const hyperstructure = getComponentValue(this.components.Hyperstructure, entityId);
      if (!hyperstructure || hyperstructure.completed === false) return;

      const totalContributableAmount = configManager.getHyperstructureTotalContributableAmount(
        hyperstructure.entity_id,
      );

      const contributions = runQuery([
        HasValue(this.components.Contribution, {
          hyperstructure_entity_id: hyperstructure.entity_id,
        }),
      ]);

      contributions.forEach((contributionEntityId) => {
        const contribution = getComponentValue(this.components.Contribution, contributionEntityId);
        if (!contribution) return;

        const effectiveContribution =
          (Number(contribution.amount) * RESOURCE_RARITY[contribution.resource_type as ResourcesIds]!) /
          configManager.getResourcePrecision();

        const percentage = effectiveContribution / totalContributableAmount;

        const points = pointsOnCompletion * percentage;
        const currentPoints = keyPointsMap.get(getKey(contribution.player_address)) || 0;

        const newPoints = currentPoints + points;

        keyPointsMap.set(getKey(contribution.player_address), newPoints);
      });

      for (let i = 0; i < hyperstructure.current_epoch; i++) {
        const epoch = getComponentValue(
          this.components.Epoch,
          getEntityIdFromKeys([BigInt(hyperstructure.entity_id), BigInt(i)]),
        );
        if (!epoch) return false;

        const nextEpoch = getComponentValue(
          this.components.Epoch,
          getEntityIdFromKeys([BigInt(hyperstructure.entity_id), BigInt(i + 1)]),
        );

        const epochEndTimestamp =
          season.is_over && nextEpoch === undefined
            ? season.ended_at
            : (nextEpoch?.start_timestamp ?? BigInt(currentTimestamp));
        const epochDuration = epochEndTimestamp - epoch.start_timestamp;

        const nbOfCycles = Number(epochDuration) / configManager.getTick(TickIds.Default);

        const totalPoints = nbOfCycles * configManager.getHyperstructureConfig().pointsPerCycle;

        epoch.owners.forEach((owner) => {
          let [owner_address, percentage] = (owner as any).value.map((value: any) => value.value);

          owner_address = ContractAddress(owner_address);
          percentage = Number(percentage) / 10_000;

          const previousPoints = keyPointsMap.get(getKey(owner_address)) || 0;
          const userShare = totalPoints * percentage;
          const newPointsForPlayer = previousPoints + userShare;

          keyPointsMap.set(getKey(owner_address), newPointsForPlayer);
        });
      }
    });
    return true;
  }

  public getAddressShares(playerAddress: ContractAddress, hyperstructureEntityId: ID) {
    const hyperstructure = getComponentValue(
      this.components.Hyperstructure,
      getEntityIdFromKeys([BigInt(hyperstructureEntityId)]),
    );
    if (!hyperstructure) return 0;
    const currentEpoch = getComponentValue(
      this.components.Epoch,
      getEntityIdFromKeys([BigInt(hyperstructureEntityId), BigInt(hyperstructure.current_epoch)]),
    );
    if (!currentEpoch) return 0;

    for (let i = 0; i < currentEpoch.owners.length; i += 2) {
      const owner_address = currentEpoch.owners[i];
      const percentage = Number(currentEpoch.owners[i + 1]) / 10_000;

      if (owner_address === playerAddress) {
        return percentage;
      }
    }

    return 0;
  }
}
