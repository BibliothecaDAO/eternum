import { getGameModeConfig } from "@/config/game-modes";
import { StructureType } from "@bibliothecadao/types";
import type { ID } from "@bibliothecadao/types";
import type { ArmyData, StructureInfo } from "../../types";

type EntityLabelKind = "army" | "chest" | "structure";
export type EntityLabelRelation = "ally" | "enemy" | "mine" | "neutral";
export type EntityLabelVariant = EntityLabelRelation | "structure";

interface EntityLabelDetailRow {
  label: string;
  value: string;
  meta?: string;
  tone?: "default" | "danger" | "success" | "warning";
}

export interface EntityLabelViewModel {
  compactText: string;
  detailRows: EntityLabelDetailRow[];
  entityId: ID;
  iconKey: string;
  kind: EntityLabelKind;
  relation: EntityLabelRelation;
  subtitle?: string;
  title: string;
  variant: EntityLabelVariant;
}

type ArmyLabelSource = Pick<ArmyData, "entityId" | "owner"> &
  Partial<Pick<ArmyData, "category" | "currentStamina" | "isMine" | "maxStamina" | "tier" | "troopCount">> & {
    isAlly?: boolean;
  };

type StructureLabelSource = Pick<
  StructureInfo,
  | "activeProductions"
  | "entityId"
  | "guardArmies"
  | "isAlly"
  | "isMine"
  | "owner"
  | "structureName"
  | "structureType"
  | "mineKind"
>;

export function buildArmyEntityLabelViewModel(army: ArmyLabelSource): EntityLabelViewModel {
  const title = resolveArmyTitle(army);
  const relation = resolveEntityLabelRelation(army);

  return {
    compactText: title,
    detailRows: buildArmyDetailRows(army),
    entityId: army.entityId,
    iconKey: army.isMine ? "army" : "enemy_army",
    kind: "army",
    relation,
    title,
    variant: relation,
  };
}

export function buildStructureEntityLabelViewModel(structure: StructureLabelSource): EntityLabelViewModel {
  const title = resolveStructureTitle(structure);
  const relation = resolveEntityLabelRelation(structure);

  return {
    compactText: title,
    detailRows: buildStructureDetailRows(structure),
    entityId: structure.entityId,
    iconKey: resolveStructureIconKey(structure),
    kind: "structure",
    relation,
    subtitle: resolveOwnerName(structure.owner.ownerName),
    title,
    variant: relation,
  };
}

export function buildChestEntityLabelViewModel(input: { entityId: ID }): EntityLabelViewModel {
  return {
    compactText: "Relic Crate",
    detailRows: [{ label: "Type", value: "Relic Crate" }],
    entityId: input.entityId,
    iconKey: "chest",
    kind: "chest",
    relation: "neutral",
    title: "Relic Crate",
    variant: "neutral",
  };
}

export function applyEntityLabelViewModelMetadata(element: HTMLElement, model: EntityLabelViewModel): void {
  element.dataset.labelKind = model.kind;
  element.dataset.labelTitle = model.title;
  element.dataset.labelVariant = model.variant;
}

export function resolveEntityLabelRelation(input: { isAlly?: boolean; isMine?: boolean }): EntityLabelRelation {
  if (input.isMine) {
    return "mine";
  }

  return input.isAlly ? "ally" : "enemy";
}

function buildArmyDetailRows(army: ArmyLabelSource): EntityLabelDetailRow[] {
  const rows: EntityLabelDetailRow[] = [];

  if (army.troopCount !== undefined) {
    rows.push({
      label: "Troops",
      meta: army.category && army.tier ? `${army.category} ${army.tier}` : undefined,
      value: formatCompactLabelNumber(army.troopCount),
    });
  }

  if (army.currentStamina !== undefined && army.maxStamina !== undefined) {
    rows.push({
      label: "Stamina",
      value: `${army.currentStamina}/${army.maxStamina}`,
    });
  }

  return rows;
}

function buildStructureDetailRows(structure: StructureLabelSource): EntityLabelDetailRow[] {
  const rows: EntityLabelDetailRow[] = [];
  const ownerName = resolveOwnerName(structure.owner.ownerName);

  if (ownerName) {
    rows.push({ label: "Owner", value: ownerName });
  }

  rows.push(...buildGuardDetailRows(structure.guardArmies));

  const buildingCount = (structure.activeProductions ?? []).reduce(
    (total, production) => total + normalizeCount(production.buildingCount),
    0,
  );
  if (buildingCount > 0) {
    rows.push({
      label: buildingCount === 1 ? "Building" : "Buildings",
      value: formatCompactLabelNumber(buildingCount),
    });
  }

  return rows;
}

function buildGuardDetailRows(guards: StructureLabelSource["guardArmies"]): EntityLabelDetailRow[] {
  const activeGuards = (guards ?? []).filter((guard) => guard.count > 0);
  const totalGuardCount = activeGuards.reduce((total, guard) => total + normalizeCount(guard.count), 0);

  if (activeGuards.length === 0 || totalGuardCount <= 0) {
    return [];
  }

  const firstGuard = activeGuards[0];
  return [
    {
      label: "Guards",
      meta: firstGuard ? `${firstGuard.category ?? "Troops"} T${firstGuard.tier}` : undefined,
      value: formatCompactLabelNumber(totalGuardCount),
    },
  ];
}

export function resolveArmyTitle(army: Pick<ArmyData, "entityId" | "owner">): string {
  const ownerName = resolveOwnerName(army.owner.ownerName);
  return ownerName || `Army #${army.entityId}`;
}

export function resolveStructureTitle(
  structure: Pick<StructureInfo, "entityId" | "structureName" | "structureType" | "mineKind">,
): string {
  const structureName = structure.structureName.trim();
  if (structureName.length > 0) {
    return structureName;
  }

  return `${resolveStructureTypeLabel(structure.structureType, structure.mineKind)} #${structure.entityId}`;
}

function resolveOwnerName(ownerName?: string): string {
  return ownerName?.trim() ?? "";
}

function resolveStructureTypeLabel(structureType: StructureType, mineKind?: number): string {
  return getGameModeConfig().structure.getTypeName(structureType, mineKind) ?? "Structure";
}

function resolveStructureIconKey(structure: Pick<StructureInfo, "structureType">): string {
  return StructureType[structure.structureType] ?? "structure";
}

function normalizeCount(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function formatCompactLabelNumber(value: number): string {
  const absValue = Math.abs(value);

  if (absValue >= 1_000_000) {
    const formatted = (value / 1_000_000).toFixed(absValue >= 10_000_000 ? 0 : 1);
    return `${formatted.replace(/\.0$/, "")}M`;
  }

  if (absValue >= 1_000) {
    const formatted = (value / 1_000).toFixed(absValue >= 10_000 ? 0 : 1);
    return `${formatted.replace(/\.0$/, "")}k`;
  }

  return value.toString();
}
