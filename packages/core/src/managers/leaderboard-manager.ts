import { getComponentValue, Has, HasValue, runQuery } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { ClientComponents } from "../dojo/create-client-components";
import { ContractAddress, ID } from "../types";
import { getGuildFromPlayerAddress } from "../utils";

export class LeaderboardManager {
  private static _instance: LeaderboardManager;
  public pointsPerPlayer: Map<ContractAddress, number> = new Map();
  public pointsPerGuild: Map<ContractAddress, number> = new Map();
  public guildsByRank: [ContractAddress, number][] = [];

  constructor(private readonly components: ClientComponents) {}

  public static instance(components: ClientComponents) {
    if (!LeaderboardManager._instance) {
      LeaderboardManager._instance = new LeaderboardManager(components);
    }
    return LeaderboardManager._instance;
  }

  public initialize() {
    this.pointsPerPlayer = this.getPlayerPoints();
    this.pointsPerGuild = this.getGuildsPoints();
  }

  public getCurrentCoOwners(
    hyperstructureEntityId: ID,
  ): { coOwners: { address: ContractAddress; percentage: number }[]; timestamp: number } | undefined {
    const hyperstructureShareholders = getComponentValue(
      this.components.HyperstructureShareholders,
      getEntityIdFromKeys([BigInt(hyperstructureEntityId)]),
    );
    if (!hyperstructureShareholders) return;

    const coOwners = (hyperstructureShareholders.shareholders as any).map((owner: any) => {
      let [owner_address, percentage] = owner.value.map((value: any) => value.value);
      return { address: ContractAddress(owner_address), percentage: Number(percentage) };
    });

    return { coOwners, timestamp: Number(hyperstructureShareholders.start_at) };
  }

  private getPlayerPoints(): Map<ContractAddress, number> {
    const pointsPerPlayer = new Map<ContractAddress, number>();

    const registredPoints = runQuery([Has(this.components.PlayerRegisteredPoints)]);

    for (const entityId of registredPoints) {
      const playerRegisteredPoints = getComponentValue(this.components.PlayerRegisteredPoints, entityId);
      if (!playerRegisteredPoints) continue;

      const playerAddress = ContractAddress(playerRegisteredPoints.address);
      const registeredPoints = Number(playerRegisteredPoints.registered_points);

      pointsPerPlayer.set(playerAddress, registeredPoints);
    }

    return pointsPerPlayer;
  }

  private getGuildsPoints(): Map<ContractAddress, number> {
    const pointsPerGuild = new Map<ContractAddress, number>();

    this.pointsPerPlayer.forEach((points, address) => {
      const guildId = getGuildFromPlayerAddress(address, this.components)?.entityId;
      if (!guildId) return;

      const currentPoints = pointsPerGuild.get(guildId) || 0;
      pointsPerGuild.set(guildId, currentPoints + points);
    });

    return pointsPerGuild;
  }

  public getGuildsByRank(): [ContractAddress, number][] {
    return Array.from(this.pointsPerGuild).sort(([_A, pointsA], [_B, pointsB]) => pointsB - pointsA);
  }

  public getPlayersByRank(): [ContractAddress, number][] {
    return Array.from(this.pointsPerPlayer).sort(([_A, pointsA], [_B, pointsB]) => pointsB - pointsA);
  }

  public getPlayerShares(playerAddress: ContractAddress, hyperstructureEntityId: ID) {
    const hyperstructureShareholders = getComponentValue(
      this.components.HyperstructureShareholders,
      getEntityIdFromKeys([BigInt(hyperstructureEntityId)]),
    );
    if (!hyperstructureShareholders) return 0;

    const shareholders = hyperstructureShareholders.shareholders as any;

    const playerShare = shareholders.find((share: any) => share[0] === playerAddress);

    return playerShare ? Number(playerShare[1]) : 0;
  }

  public getContributions = (hyperstructureEntityId: ID) => {
    return [];
  };

  public getHyperstructuresWithContributionsFromPlayer = (address: ContractAddress) => {
    const playerConstructionPoints = runQuery([HasValue(this.components.PlayerConstructionPoints, { address })]);
    const hyperstructureEntityIds = Array.from(playerConstructionPoints).map(
      (entityId) => getComponentValue(this.components.PlayerConstructionPoints, entityId)?.hyperstructure_id ?? 0,
    );
    return new Set(hyperstructureEntityIds);
  };

  public getPlayerUnregistredContributions = (address: ContractAddress) => {
    return [];
  };

  public getCompletionPoints = (address: ContractAddress, hyperstructureId: number) => {
    const playerContribution = getComponentValue(
      this.components.PlayerConstructionPoints,
      getEntityIdFromKeys([address, BigInt(hyperstructureId)]),
    );

    return Number(playerContribution?.unregistered_points) ?? 0;
  };
}
