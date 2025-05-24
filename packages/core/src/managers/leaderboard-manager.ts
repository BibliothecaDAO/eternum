import { type ClientComponents, ContractAddress, type ID } from "@bibliothecadao/types";
import { Has, getComponentValue, runQuery } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { getGuildFromPlayerAddress } from "../utils";

interface ContractAddressAndAmount {
  key: false;
  type: "tuple";
  type_name: "(ContractAddress, u16)";
  value: [
    {
      key: false;
      type: "primitive";
      type_name: "ContractAddress";
      value: string;
    },
    {
      key: false;
      type: "primitive";
      type_name: "u16";
      value: number;
    },
  ];
}

export class LeaderboardManager {
  private static _instance: LeaderboardManager;
  public pointsPerPlayer: Map<ContractAddress, number> = new Map();
  public playersByRank: [ContractAddress, number][] = [];
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
    this.playersByRank = this.getPlayersByRank();
    this.guildsByRank = this.getGuildsByRank();
  }

  public updatePoints() {
    // Refresh player points
    this.pointsPerPlayer = this.getPlayerPoints();

    // Refresh guild points
    this.pointsPerGuild = this.getGuildsPoints();

    // Update guild rankings
    this.guildsByRank = this.getGuildsByRank();

    // Update player rankings
    this.playersByRank = this.getPlayersByRank();
  }

  public getCurrentCoOwners(hyperstructureEntityId: ID):
    | {
        coOwners: { address: ContractAddress; percentage: number }[];
        timestamp: number;
      }
    | undefined {
    const hyperstructureShareholders = getComponentValue(
      this.components.HyperstructureShareholders,
      getEntityIdFromKeys([BigInt(hyperstructureEntityId)]),
    );
    if (!hyperstructureShareholders) return;

    const coOwners = (hyperstructureShareholders.shareholders as any).map((owner: any) => {
      const [owner_address, percentage] = owner.value.map((value: any) => value.value);
      return {
        address: ContractAddress(owner_address),
        percentage: Number(percentage),
      };
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
      const pointsPrecision = 1_000_000n;
      const registeredPoints = Number(playerRegisteredPoints.registered_points / pointsPrecision);

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

  private getGuildsByRank(): [ContractAddress, number][] {
    return Array.from(this.pointsPerGuild).sort(([_A, pointsA], [_B, pointsB]) => pointsB - pointsA);
  }

  private getPlayersByRank(): [ContractAddress, number][] {
    return Array.from(this.pointsPerPlayer).sort(([_A, pointsA], [_B, pointsB]) => pointsB - pointsA);
  }

  public getPlayerShares(playerAddress: ContractAddress, hyperstructureEntityId: ID) {
    const hyperstructureShareholders = getComponentValue(
      this.components.HyperstructureShareholders,
      getEntityIdFromKeys([BigInt(hyperstructureEntityId)]),
    );

    if (!hyperstructureShareholders) return 0;

    const shareholders = hyperstructureShareholders.shareholders as unknown as ContractAddressAndAmount[];

    const playerShare = shareholders.find(
      (share: ContractAddressAndAmount) => ContractAddress(share.value[0].value) === playerAddress,
    );

    return playerShare ? Number(playerShare.value[1].value / 10_000) : 0;
  }

  public getHyperstructuresWithSharesFromPlayer = (address: ContractAddress) => {
    const hyperstructures = runQuery([Has(this.components.Hyperstructure)]);
    const hyperstructuresWithShares: ID[] = Array.from(hyperstructures)
      .map((entityId) => {
        const hyperstructure = getComponentValue(this.components.Hyperstructure, entityId);
        if (!hyperstructure || !hyperstructure.initialized) return;
        const playerShares = this.getPlayerShares(address, hyperstructure.hyperstructure_id);
        if (playerShares > 0) return hyperstructure.hyperstructure_id;
      })
      .filter((id) => id !== undefined);
    return new Set(hyperstructuresWithShares);
  };

  public isSeasonOver = () => {
    const seasonEnded = runQuery([Has(this.components.events.SeasonEnded)]);

    if (seasonEnded.size > 0) {
      return true;
    }

    return false;
  };
}
