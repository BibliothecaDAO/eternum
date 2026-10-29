import { NativeFactStore } from "@bibliothecadao/eternum/game-client";

import { rowsOf, type LabFact, type LabScenario } from "./lab-chain";
import { spireScenario } from "./spire-scenario";

/** The realm the player founds, as the spire's day holds it. */
const REALM = 7n;

/**
 * The spire's game before its player has settled (/lab/game?scenario=settle): their realm and everything it holds (its
 * stores, buildings, research, armies and their tiles) are not on the chain yet, and the player enters from the home
 * page's game card, as one not yet settled does. The chain answers SettleSeason with all of it at once, as
 * settlement_domain.cairo's settle_season founds the realm on its site.
 */
export const settleScenario = (): LabScenario => {
  const spire = spireScenario();
  const rows = rowsOf(spire.store);
  const armies = new Set(
    rows
      .filter(({ model, value }) => model === "ExplorerTroops" && ownedBy(value, "owner"))
      .map(({ value }) => idOf(value, "explorer_id")),
  );
  const founded = rows.filter(({ value }) => belongsToTheRealm(value, armies));
  const store = new NativeFactStore();
  store.applyFacts(rows.filter((row) => !founded.includes(row)) as never);
  return {
    ...spire,
    store,
    entersFromHome: true,
    answer: (command, chain, now) => (command.kind === "SettleSeason" ? founded : spire.answer(command, chain, now)),
  };
};

const idOf = (value: unknown, field: string): bigint | null => {
  const id = (value as Record<string, unknown> | null)?.[field];
  return id === undefined || id === null || typeof id === "object" ? null : BigInt(id as string | number);
};

const ownedBy = (value: unknown, field: string) => idOf(value, field) === REALM;

/** A row of the realm's: the realm itself or one that names it, or one of its armies'. */
const belongsToTheRealm = (value: LabFact["value"], armies: ReadonlySet<bigint | null>): boolean =>
  ["entity_id", "structure_id", "owner"].some((field) => ownedBy(value, field)) ||
  ["entity_id", "explorer_id"].some((field) => armies.has(idOf(value, field)));
