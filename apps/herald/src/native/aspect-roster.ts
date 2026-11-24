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
  const homes = byEntity(gameRows(modelRows("Structure"), gameId), "entity_id");
  const glory = byEntity(gameRows(modelRows("RaceMember"), gameId), "entity_id");
  return gameRows(modelRows("HomeAspect"), gameId)
    .filter((membership) => number(membership.aspect) === aspect)
    .map((membership) => memberOf(integer(membership.home), homes, glory))
    .sort(byGloryThenHome)
    .map((member, index) => ({ rank: index + 1, ...member }));
}

const byEntity = (rows: Row[], key: string): Map<bigint, Row> => new Map(rows.map((row) => [integer(row[key]), row]));

function memberOf(home: bigint, homes: Map<bigint, Row>, glory: Map<bigint, Row>) {
  const structure = homes.get(home);
  if (!structure) throw new Error(`Aspect member home ${home} has no Structure`);
  return {
    entity_id: home.toString(),
    realm_id: number(record(structure.metadata).realm_id),
    owner: address(structure.owner),
    glory: integer(glory.get(home)?.glory ?? 0).toString(),
  };
}

const byGloryThenHome = (a: Omit<HeraldAspectRosterMember, "rank">, b: Omit<HeraldAspectRosterMember, "rank">) => {
  const gloryA = BigInt(a.glory);
  const gloryB = BigInt(b.glory);
  if (gloryA !== gloryB) return gloryA > gloryB ? -1 : 1;
  return BigInt(a.entity_id) < BigInt(b.entity_id) ? -1 : 1;
};
