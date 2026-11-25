import { compareAspectMembers, gloryAmount, type RaceMemberRow } from "@bibliothecadao/eternum/game-client";
import type { HeraldAspectRosterMember } from "@bibliothecadao/eternum/game-sync";
import { formatAmount, type AspectId } from "@bibliothecadao/types";

import { ROSTER_TOP } from "../herald";
import { realmHomeOf } from "../season";

type RosterMember = Omit<HeraldAspectRosterMember, "owner" | "realm_id"> & {
  owner: string | null;
  realm_id: number | null;
};

export interface GloryRoster {
  total: number;
  members: RosterMember[];
}

export interface GloryRow {
  key: string;
  rank: number;
  aspect?: AspectId;
  owner: string;
  own: boolean;
  order: { orderId: number; orderName: string } | null;
  glory: string;
}

export interface OwnGloryRow {
  aspect: AspectId;
  member: HeraldAspectRosterMember;
  place: number;
  aspectPlace: number;
}

export interface GloryIdentity {
  owner: string;
  realm_id: number;
}

export const nativeAspectRoster = (
  members: readonly RaceMemberRow[],
  identityOf: (home: bigint) => GloryIdentity | null,
): GloryRoster => ({
  total: members.length,
  members: members.slice(0, ROSTER_TOP).map((member, index) => ({
    rank: index + 1,
    entity_id: member.home.toString(),
    glory: member.glory.toString(),
    ...(identityOf(member.home) ?? { owner: null, realm_id: null }),
  })),
});

const isNamed = (member: RosterMember): member is HeraldAspectRosterMember =>
  member.owner !== null && member.realm_id !== null;

export const unnamedMembers = (rosters: readonly { roster: GloryRoster }[]): number =>
  rosters.reduce((sum, { roster }) => sum + roster.members.filter((member) => !isNamed(member)).length, 0);

export const nativeMember = (
  rank: number,
  member: RaceMemberRow,
  identityOf: (home: bigint) => GloryIdentity | null,
): HeraldAspectRosterMember | null => {
  const identity = identityOf(member.home);
  return identity && { rank, entity_id: member.home.toString(), ...identity, glory: member.glory.toString() };
};

export const mergeAspectRosters = <M extends RosterMember>(
  rosters: readonly { aspect: AspectId; roster: { total: number; members: readonly M[] } }[],
): { total: number; rows: { aspect: AspectId; rank: number; member: M }[] } => ({
  total: rosters.reduce((sum, { roster }) => sum + roster.total, 0),
  rows: rosters
    .flatMap(({ aspect, roster }) => roster.members.map((member) => ({ aspect, member })))
    .toSorted((left, right) =>
      compareAspectMembers(
        { glory: BigInt(left.member.glory), home: BigInt(left.member.entity_id) },
        { glory: BigInt(right.member.glory), home: BigInt(right.member.entity_id) },
      ),
    )
    .map((entry, index) => ({ ...entry, rank: index + 1 })),
});

export const gloryRowOf = (
  rank: number,
  member: HeraldAspectRosterMember,
  own: boolean,
  aspect?: AspectId,
): GloryRow => {
  const { order } = realmHomeOf(member.realm_id);
  return {
    key: member.entity_id,
    rank,
    aspect,
    owner: member.owner,
    own,
    order: order && { orderId: order.orderId, orderName: order.orderName },
    glory: formatAmount(gloryAmount(member.glory)),
  };
};

export const boardRows = (
  rosters: readonly { aspect: AspectId; roster: GloryRoster }[],
  tab: AspectId | 0,
  own: OwnGloryRow | null,
): GloryRow[] => {
  const ranked =
    tab === 0
      ? mergeAspectRosters(rosters).rows
      : (rosters.find((entry) => entry.aspect === tab)?.roster.members ?? []).map((member) => ({
          aspect: tab,
          rank: member.rank,
          member,
        }));
  const rows = ranked.flatMap(({ aspect, rank, member }) =>
    isNamed(member) ? [gloryRowOf(rank, member, member.entity_id === own?.member.entity_id, aspect)] : [],
  );
  if (!own || ranked.some(({ member }) => member.entity_id === own.member.entity_id)) return rows;
  if (tab !== 0 && tab !== own.aspect) return rows;
  return [...rows, gloryRowOf(tab === 0 ? own.place : own.aspectPlace, own.member, true, own.aspect)];
};
