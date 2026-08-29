import { getRealmNameById } from "@bibliothecadao/eternum";

type ReadModelRow = Record<string, unknown>;

export interface FaithReadModels {
  addressNames: readonly ReadModelRow[];
  faithfulStructures: readonly ReadModelRow[];
  structures: readonly ReadModelRow[];
  wonderFaith: readonly ReadModelRow[];
}

export interface FaithLeaderboardEntry {
  rank: number;
  wonderId: bigint;
  wonderName: string;
  ownerAddress: string;
  ownerName: string | null;
  totalFaithPoints: bigint;
  faithPointsPerSecond: number;
  followerCount: number;
}

interface FaithfulStructureStatus {
  structureId: bigint;
  wonderId: bigint;
  faithfulSince: number;
  fpToWonderOwnerPerSec: number;
  fpToStructureOwnerPerSec: number;
}

export interface WonderFaithFollowerEntry {
  structureId: bigint;
  structureType: number;
  structureTypeLabel: string;
  structureLabel: string;
  ownerAddress: string;
  ownerName: string | null;
  faithfulSince: number;
  fpToWonderOwnerPerSec: number;
  fpToFollowerOwnerPerSec: number;
  totalContributionPerSec: number;
}

export interface WonderFaithDetail {
  wonderId: bigint;
  wonderName: string;
  ownerAddress: string;
  ownerName: string | null;
  totalFaithPoints: bigint;
  totalFaithPointsPerSec: number;
  ownBaselinePerSec: number;
  followersContributionPerSec: number;
  followerCount: number;
  ownerSharePercent: number;
  followerSharePercent: number;
  ownerSharePerSecFromFollowers: number;
  followersSharePerSec: number;
  followers: WonderFaithFollowerEntry[];
}

const REALM_STRUCTURE_TYPE = 1;
const VILLAGE_STRUCTURE_TYPE = 5;
const HOLY_SITE_STRUCTURE_TYPE = 6;
const OWNER_SHARE_PERCENT = 30;
const FOLLOWER_SHARE_PERCENT = 70;

const record = (value: unknown): ReadModelRow =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as ReadModelRow) : {};

const toBigInt = (value: unknown): bigint | null => {
  if (!["bigint", "number", "string"].includes(typeof value)) return null;
  try {
    return BigInt(value as string | number | bigint);
  } catch {
    return null;
  }
};

const nonNegativeBigInt = (value: unknown): bigint => {
  const parsed = toBigInt(value);
  return parsed !== null && parsed >= 0n ? parsed : 0n;
};

const integer = (value: unknown): number => {
  const parsed = Number(nonNegativeBigInt(value));
  return Number.isSafeInteger(parsed) ? parsed : 0;
};

const address = (value: unknown): string => {
  const parsed = toBigInt(value);
  return parsed === null ? "0x0" : `0x${parsed.toString(16).padStart(64, "0")}`;
};

const sameFelt = (left: unknown, right: unknown): boolean => {
  const leftValue = toBigInt(left);
  const rightValue = toBigInt(right);
  return leftValue !== null && rightValue !== null && leftValue === rightValue;
};

const decodeShortString = (value: unknown): string | null => {
  if (typeof value === "string" && !value.startsWith("0x")) return value.trim() || null;
  const parsed = toBigInt(value);
  if (parsed === null || parsed === 0n) return null;
  const unpadded = parsed.toString(16);
  const hex = unpadded.length % 2 === 0 ? unpadded : `0${unpadded}`;
  const decoded = String.fromCharCode(...(hex.match(/.{2}/g) ?? []).map((byte) => Number.parseInt(byte, 16)));
  return decoded.trim() || null;
};

const wonderName = (wonderId: bigint, realmId: number): string => {
  const realmName = realmId > 0 ? getRealmNameById(realmId) : undefined;
  return realmName ? `Wonder - ${realmName}` : `Wonder #${realmId > 0 ? realmId : wonderId.toString()}`;
};

const currentFaithPoints = (row: ReadModelRow, nowInSeconds: bigint): bigint => {
  const claimed = nonNegativeBigInt(row.claimed_points);
  const perSecond = nonNegativeBigInt(row.claim_per_sec);
  const claimedAt = nonNegativeBigInt(row.claim_last_at);
  return perSecond > 0n && claimedAt > 0n && nowInSeconds > claimedAt
    ? claimed + perSecond * (nowInSeconds - claimedAt)
    : claimed;
};

const structuresWithWonder = (rows: FaithReadModels): ReadModelRow[] =>
  rows.structures.filter((structure) => {
    const hasWonder = record(structure.metadata).has_wonder;
    return hasWonder === true || hasWonder === "0x1" || hasWonder === 1n;
  });

const wonderFaith = (rows: FaithReadModels, wonderId: bigint): ReadModelRow =>
  rows.wonderFaith.find((row) => sameFelt(row.wonder_id, wonderId)) ?? {};

const ownerName = (rows: FaithReadModels, owner: unknown): string | null =>
  decodeShortString(rows.addressNames.find((row) => sameFelt(row.address, owner))?.name);

const structureTypeLabel = (structureType: number): string => {
  if (structureType === REALM_STRUCTURE_TYPE) return "Realm";
  if (structureType === VILLAGE_STRUCTURE_TYPE) return "Village";
  if (structureType === HOLY_SITE_STRUCTURE_TYPE) return "Holy Site";
  return "Structure";
};

const structureLabel = (structureId: bigint, structureType: number, realmId: number): string => {
  if (structureType === REALM_STRUCTURE_TYPE && realmId > 0) {
    const realmName = getRealmNameById(realmId);
    return realmName ? `Realm - ${realmName}` : `Realm #${realmId}`;
  }
  return `${structureTypeLabel(structureType)} #${structureId.toString()}`;
};

const followerEntries = (rows: FaithReadModels, wonderId: bigint): WonderFaithFollowerEntry[] =>
  rows.faithfulStructures.flatMap((faithful) => {
    const structureId = toBigInt(faithful.structure_id);
    if (
      structureId === null ||
      structureId <= 0n ||
      structureId === wonderId ||
      !sameFelt(faithful.wonder_id, wonderId)
    ) {
      return [];
    }
    const structure = rows.structures.find((candidate) => sameFelt(candidate.entity_id, structureId));
    if (!structure) return [];
    const structureType = integer(record(structure.base).category);
    if (![REALM_STRUCTURE_TYPE, VILLAGE_STRUCTURE_TYPE, HOLY_SITE_STRUCTURE_TYPE].includes(structureType)) return [];
    const realmId = integer(record(structure.metadata).realm_id);
    const fpToWonderOwnerPerSec = integer(faithful.fp_to_wonder_owner_per_sec);
    const fpToFollowerOwnerPerSec = integer(faithful.fp_to_struct_owner_per_sec);
    return [
      {
        structureId,
        structureType,
        structureTypeLabel: structureTypeLabel(structureType),
        structureLabel: structureLabel(structureId, structureType, realmId),
        ownerAddress: address(structure.owner),
        ownerName: ownerName(rows, structure.owner),
        faithfulSince: integer(faithful.faithful_since),
        fpToWonderOwnerPerSec,
        fpToFollowerOwnerPerSec,
        totalContributionPerSec: fpToWonderOwnerPerSec + fpToFollowerOwnerPerSec,
      },
    ];
  });

export const buildFaithLeaderboard = (
  rows: FaithReadModels,
  nowInSeconds = BigInt(Math.floor(Date.now() / 1_000)),
): FaithLeaderboardEntry[] =>
  structuresWithWonder(rows)
    .flatMap((structure) => {
      const wonderId = toBigInt(structure.entity_id);
      if (wonderId === null || wonderId <= 0n) return [];
      const faith = wonderFaith(rows, wonderId);
      return [
        {
          rank: 0,
          wonderId,
          wonderName: wonderName(wonderId, integer(record(structure.metadata).realm_id)),
          ownerAddress: address(structure.owner),
          ownerName: ownerName(rows, structure.owner),
          totalFaithPoints: currentFaithPoints(faith, nowInSeconds),
          faithPointsPerSecond: integer(faith.claim_per_sec),
          followerCount: integer(faith.num_structures_pledged),
        },
      ];
    })
    .toSorted((left, right) => {
      if (left.totalFaithPoints !== right.totalFaithPoints)
        return left.totalFaithPoints < right.totalFaithPoints ? 1 : -1;
      if (left.faithPointsPerSecond !== right.faithPointsPerSecond) {
        return right.faithPointsPerSecond - left.faithPointsPerSecond;
      }
      return left.wonderId < right.wonderId ? -1 : left.wonderId > right.wonderId ? 1 : 0;
    })
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

export const buildFaithfulStructureStatus = (
  rows: FaithReadModels,
  structureIdInput: bigint | number | string,
): FaithfulStructureStatus | null => {
  const structureId = toBigInt(structureIdInput);
  const row =
    structureId === null
      ? undefined
      : rows.faithfulStructures.find((candidate) => sameFelt(candidate.structure_id, structureId));
  const wonderId = toBigInt(row?.wonder_id);
  if (!row || structureId === null || structureId <= 0n || wonderId === null || wonderId <= 0n) return null;
  return {
    structureId,
    wonderId,
    faithfulSince: integer(row.faithful_since),
    fpToWonderOwnerPerSec: integer(row.fp_to_wonder_owner_per_sec),
    fpToStructureOwnerPerSec: integer(row.fp_to_struct_owner_per_sec),
  };
};

export const buildWonderFaithDetail = (
  rows: FaithReadModels,
  wonderIdInput: bigint | number | string,
  nowInSeconds = BigInt(Math.floor(Date.now() / 1_000)),
): WonderFaithDetail | null => {
  const wonderId = toBigInt(wonderIdInput);
  if (wonderId === null || wonderId <= 0n) return null;
  const structure = structuresWithWonder(rows).find((candidate) => sameFelt(candidate.entity_id, wonderId));
  if (!structure) return null;
  const faith = wonderFaith(rows, wonderId);
  const followers = followerEntries(rows, wonderId);
  const totalFaithPointsPerSec = integer(faith.claim_per_sec);
  const followersContributionPerSec = followers.reduce((sum, follower) => sum + follower.totalContributionPerSec, 0);
  return {
    wonderId,
    wonderName: wonderName(wonderId, integer(record(structure.metadata).realm_id)),
    ownerAddress: address(structure.owner),
    ownerName: ownerName(rows, structure.owner),
    totalFaithPoints: currentFaithPoints(faith, nowInSeconds),
    totalFaithPointsPerSec,
    ownBaselinePerSec: Math.max(0, totalFaithPointsPerSec - followersContributionPerSec),
    followersContributionPerSec,
    followerCount: followers.length,
    ownerSharePercent: OWNER_SHARE_PERCENT,
    followerSharePercent: FOLLOWER_SHARE_PERCENT,
    ownerSharePerSecFromFollowers: followers.reduce((sum, follower) => sum + follower.fpToWonderOwnerPerSec, 0),
    followersSharePerSec: followers.reduce((sum, follower) => sum + follower.fpToFollowerOwnerPerSec, 0),
    followers,
  };
};
