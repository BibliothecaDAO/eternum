/**
 * Who and what a story is about: the players (hex addresses) and the entities (decimal ids) it names, read from an
 * event model's value as Herald stores it. Herald indexes history by these, and the client matches its live stream the
 * same way, so a read filtered by a player or an entity keeps the same stories from either source.
 */
export function storyParticipants(value: Record<string, unknown>): { owners: string[]; entities: string[] } {
  const payload = asRecord(Object.values(asRecord(value.story))[0]);
  const scalars = (values: unknown[], hex: boolean) => [
    ...new Set(
      values
        .filter((value) => value !== undefined && value !== null)
        .map((value) => BigInt(String(value)))
        .filter((value) => value !== 0n)
        .map((value) => (hex ? `0x${value.toString(16)}` : value.toString())),
    ),
  ];
  return {
    owners: scalars(
      [
        value.owner,
        value.player,
        value.target_owner,
        asRecord(value.attacker).player,
        asRecord(value.defender).player,
        payload.owner,
        payload.winner,
        payload.previous_owner,
        payload.new_owner,
        payload.from_entity_owner_address,
        payload.to_entity_owner_address,
      ],
      true,
    ),
    entities: scalars(
      [
        value.entity_id,
        value.explorer_id,
        value.structure_id,
        value.attacker_id,
        value.defender_id,
        payload.explorer_id,
        payload.structure_id,
        payload.from_entity_id,
        payload.to_entity_id,
        payload.bank_id,
        payload.mine_id,
        armyEntity(payload.source),
        armyEntity(payload.target),
      ],
      false,
    ),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function armyEntity(value: unknown): unknown {
  const army = asRecord(value);
  return army.Explorer ?? asRecord(army.Guard).structure_id;
}
