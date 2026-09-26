/**
 * The realm the local view opens on. A route names it by its map hex, but a Frontier realm stands on a new site every
 * day, so a route written before the day turned (a reload, a resumed scene, a link) points at an empty hex. Then the
 * realm the player has selected is the one the route meant, if it is a Frontier realm; any other structure is found
 * only where the route says it stands.
 */
export const pickLocalRealm = <Structure>({
  atRoute,
  selected,
  followsTheDay,
}: {
  atRoute: Structure | undefined;
  selected: Structure | undefined;
  followsTheDay: (structure: Structure) => boolean;
}): Structure | undefined => atRoute ?? (selected && followsTheDay(selected) ? selected : undefined);
