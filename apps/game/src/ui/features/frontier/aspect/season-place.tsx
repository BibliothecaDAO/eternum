import type { ExpeditionRules } from "@bibliothecadao/eternum";

import { FrontierSeason, useSeasonRank } from "../board/season-board";
import { AspectPage, useAspectPage } from "./aspect-page";

/**
 * The Season place: in a game that races its Aspects' hyperstructures (RaceRules), the Aspect page; in any other
 * Frontier game, the season board of sites cleared.
 */
export const SeasonPlace = ({
  rules,
  onVisited,
  onClose,
}: {
  rules: ExpeditionRules;
  onVisited: () => void;
  onClose: () => void;
}) => {
  const page = useAspectPage();
  return page ? (
    <AspectPage plan={page} onClose={onClose} />
  ) : (
    <FrontierSeason rules={rules} onVisited={onVisited} onClose={onClose} />
  );
};

/**
 * The place the Season row names: the player's Aspect's in a race game ("#2"; "—" while unknown or for a player in no
 * Aspect), else the player's own on the board of sites cleared.
 */
export const useSeasonPlaceRank = (): string => {
  const page = useAspectPage();
  const boardRank = useSeasonRank();
  if (!page) return boardRank;
  const own = page.kind === "page" ? page.own : null;
  return own ? `#${own.standing.rank}` : "—";
};
