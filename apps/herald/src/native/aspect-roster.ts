import { compareAspectMembers } from "@bibliothecadao/eternum/game-client";
import type { HeraldAspectRosterMember } from "@bibliothecadao/eternum/game-sync";

import type { FoldRow } from "../types";
import { isSeasonOneGame } from "./season-one";
import { address, gameRows, integer, number, record, type Row } from "./values";

export function buildAspectRoster(
  modelRows: (model: string) => FoldRow[],
  gameId: string,
  aspect: number,
): HeraldAspectRosterMember[] | null {
  if (!isSeasonOneGame(modelRows, gameId)) return null;
  const homes = byEntity(gameRows(modelRows("Structure"), gameId));
  const glory = byEntity(gameRows(modelRows("RaceMember"), gameId));
  return gameRows(modelRows("HomeAspect"), gameId)
    .filter((membership) => number(membership.aspect) === aspect)
    .map((membership) => {
      const home = integer(membership.home);
      return { home, glory: integer(glory.get(home)?.glory ?? 0) };
    })
    .sort(compareAspectMembers)
    .map((member, index) => memberOf(index + 1, member, homes));
}

const byEntity = (rows: Row[]): Map<bigint, Row> => new Map(rows.map((row) => [integer(row.entity_id), row]));

function memberOf(
  rank: number,
  { home, glory }: { home: bigint; glory: bigint },
  homes: Map<bigint, Row>,
): HeraldAspectRosterMember {
  const structure = homes.get(home);
  if (!structure) throw new Error(`Aspect member home ${home} has no Structure`);
  return {
    rank,
    entity_id: home.toString(),
    realm_id: number(record(structure.metadata).realm_id),
    owner: address(structure.owner),
    glory: glory.toString(),
  };
}
