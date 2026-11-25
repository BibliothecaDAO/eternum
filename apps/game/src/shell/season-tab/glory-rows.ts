import { compareAspectMembers, gloryAmount, type RaceMemberRow } from "@bibliothecadao/eternum/game-client";
import type { HeraldAspectRoster, HeraldAspectRosterMember } from "@bibliothecadao/eternum/game-sync";
import { formatAmount, type AspectId } from "@bibliothecadao/types";

import { ROSTER_TOP } from "../herald";
import { realmHomeOf } from "../season";

export type GloryRoster = Pick<HeraldAspectRoster, "total" | "members">;

export interface GloryRow {
  key: string;
  rank: number;
  aspect?: AspectId;
  owner: string;
  own: boolean;
  order: { orderId: number; orderName: string } | null;
  glory: string;
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
  members: members.slice(0, ROSTER_TOP).flatMap((member, index) => {
    const named = nativeMember(index + 1, member, identityOf);
    return named ? [named] : [];
  }),
});

export const nativeMember = (
  rank: number,
  member: RaceMemberRow,
  identityOf: (home: bigint) => GloryIdentity | null,
): HeraldAspectRosterMember | null => {
  const identity = identityOf(member.home);
  return identity && { rank, entity_id: member.home.toString(), ...identity, glory: member.glory.toString() };
};

export const mergeAspectRosters = (
  rosters: readonly { aspect: AspectId; roster: GloryRoster }[],
): { total: number; rows: { aspect: AspectId; rank: number; member: HeraldAspectRosterMember }[] } => ({
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
