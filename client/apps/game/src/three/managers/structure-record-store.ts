import type { IncomingTroopArrival } from "@bibliothecadao/eternum";
import type { BuildingType, ID, StructureType } from "@bibliothecadao/types";
import type { CosmeticAttachmentTemplate } from "../cosmetics";
import type { StructureInfo } from "../types";
import { normalizeStructureEntityId } from "./structure-entity-id";
import { createStructureRecord } from "./structure-record";

interface StructureRecordStoreOptions {
  isAddressMine: (address: bigint) => boolean;
  onRemove?: (structure: StructureInfo) => void;
  onStructuresChanged?: () => void;
}

export class StructureRecordStore {
  private structures: Map<StructureType, Map<ID, StructureInfo>> = new Map();
  private entityIdIndex: Map<ID, StructureInfo> = new Map();

  constructor(private readonly options: StructureRecordStoreOptions) {}

  addStructure(
    entityId: ID,
    structureName: string,
    structureType: StructureType,
    hexCoords: { col: number; row: number },
    initialized: boolean,
    stage: number = 0,
    level: number = 0,
    owner: { address: bigint; ownerName: string; guildName: string },
    hasWonder: boolean,
    attachments: CosmeticAttachmentTemplate[] | undefined,
    isAlly: boolean,
    guardArmies?: Array<{ slot: number; category: string | null; tier: number; count: number; stamina: number }>,
    activeProductions?: Array<{ buildingCount: number; buildingType: BuildingType }>,
    incomingTroopArrivals?: IncomingTroopArrival[],
    hyperstructureRealmCount?: number,
    attackedFromDegrees?: number,
    attackedTowardDegrees?: number,
    battleCooldownEnd?: number,
    battleTimerLeft?: number,
  ) {
    const normalizedEntityId = normalizeStructureEntityId(entityId);
    if (normalizedEntityId === undefined) {
      console.warn("[Structures] Attempted to add structure without a valid entity id", {
        entityId,
        structureType,
      });
      return;
    }

    if (!this.structures.has(structureType)) {
      this.structures.set(structureType, new Map());
    }

    this.structures.get(structureType)!.set(
      normalizedEntityId,
      createStructureRecord({
        entityId: normalizedEntityId,
        structureName,
        hexCoords,
        stage,
        initialized,
        level,
        owner,
        structureType,
        hasWonder,
        attachments,
        isAlly,
        isAddressMine: this.options.isAddressMine,
        guardArmies,
        activeProductions,
        incomingTroopArrivals,
        hyperstructureRealmCount,
        attackedFromDegrees,
        attackedTowardDegrees,
        battleCooldownEnd,
        battleTimerLeft,
      }),
    );
    this.entityIdIndex.set(normalizedEntityId, this.structures.get(structureType)!.get(normalizedEntityId)!);
  }

  updateStructureStage(entityId: ID, structureType: StructureType, stage: number) {
    const normalizedEntityId = normalizeStructureEntityId(entityId);
    if (normalizedEntityId === undefined) {
      return;
    }
    const structure = this.structures.get(structureType)?.get(normalizedEntityId);
    if (structure) {
      structure.stage = stage;
    }
  }

  removeStructureFromPosition(hexCoords: { col: number; row: number }) {
    let removed = false;
    this.structures.forEach((structures) => {
      const removalQueue: ID[] = [];
      structures.forEach((structure, entityId) => {
        if (structure.hexCoords.col === hexCoords.col && structure.hexCoords.row === hexCoords.row) {
          removalQueue.push(entityId);
          this.options.onRemove?.(structure);
          this.entityIdIndex.delete(entityId);
          removed = true;
        }
      });
      removalQueue.forEach((entityId) => structures.delete(entityId));
    });

    if (removed) {
      this.options.onStructuresChanged?.();
    }
  }

  updateStructure(entityId: ID, structure: StructureInfo) {
    const normalizedEntityId = normalizeStructureEntityId(entityId);
    if (normalizedEntityId === undefined) {
      return;
    }
    this.structures.get(structure.structureType)?.set(normalizedEntityId, structure);
    this.entityIdIndex.set(normalizedEntityId, structure);
  }

  removeStructure(entityId: ID): StructureInfo | null {
    const normalizedEntityId = normalizeStructureEntityId(entityId);
    if (normalizedEntityId === undefined) {
      return null;
    }

    let removedStructure: StructureInfo | null = null;

    this.structures.forEach((structures) => {
      const structure = structures.get(normalizedEntityId);
      if (structure) {
        this.options.onRemove?.(structure);
        structures.delete(normalizedEntityId);
        this.entityIdIndex.delete(normalizedEntityId);
        removedStructure = structure;
      }
    });

    if (removedStructure) {
      this.options.onStructuresChanged?.();
    }

    return removedStructure;
  }

  getStructures(): Map<StructureType, Map<ID, StructureInfo>> {
    return this.structures;
  }

  getStructureByEntityId(entityId: ID): StructureInfo | undefined {
    const normalizedEntityId = normalizeStructureEntityId(entityId);
    if (normalizedEntityId === undefined) {
      return undefined;
    }
    return this.entityIdIndex.get(normalizedEntityId);
  }

  recheckOwnership() {
    this.structures.forEach((structures) => {
      structures.forEach((structure) => {
        structure.isMine = this.options.isAddressMine(structure.owner.address);
      });
    });
  }
}
