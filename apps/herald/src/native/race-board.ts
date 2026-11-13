import type { HeraldRaceAspect, HeraldRaceBoard, HeraldRaceSite } from "@bibliothecadao/eternum/game-sync";
import { aspects, type AspectId, RESOURCE_PRECISION } from "@bibliothecadao/types";
import type { FoldRow } from "../types";
import { address, gameRows, integer, number, record, required, type Row } from "./values";

/** The stages a hyperstructure is built in: the fifth finishes it, and there is no sixth. */
const STAGES = 5;
/** The stages whose completion gives the Aspect a Triumph the next day. */
const TRIUMPH_STAGES = [1, 2, 3, 4] as const;

/** Whether a game races its Aspects' hyperstructures: its preset registered RaceRules. */
export const isRaceGame = (modelRows: (model: string) => FoldRow[], gameId: string): boolean =>
  gameRows(modelRows("RaceRules"), gameId).length > 0;

/**
 * A Season 1 game's board (H2), from the rows the race publishes: the four Aspects' hyperstructures, the finished one
 * first, then by height, ties by Aspect as the contract's Altar targeting orders them (race::aspect_order); each with
 * its stage, its Triumphs' days and its members by Glory; then the Deep's sites, each with its holder and its guards.
 * No score is computed here that the chain does not hold.
 */
export function buildRaceBoard(modelRows: (model: string) => FoldRow[], gameId: string): HeraldRaceBoard {
  const rows = (model: string) => gameRows(modelRows(model), gameId);
  const rules = required(modelRows("RaceRules"), gameId, "RaceRules");
  const winner = winnerOf(rows("RaceResult")[0]);
  const membersOf = aspectMembers(rows("HomeAspect"), rows("RaceMember"), rows("Structure"));
  const hyperstructures = rows("AspectHyperstructure");
  const days = rows("TriumphDay");
  const board = aspects.map(({ id }) => ({
    aspect: id,
    height: heightOf(hyperstructures, id),
    triumph_days: TRIUMPH_STAGES.map((stage) => triumphDay(days, id, stage)),
    members: membersOf(id),
  }));
  board.sort((a, b) => finishedFirst(a, b, winner) || b.height - a.height || a.aspect - b.aspect);
  return {
    game_id: integer(gameId).toString(),
    mode: "race",
    stage_height: number(rules.stage_height),
    winner,
    aspects: board.map(
      (entry, index): HeraldRaceAspect => ({
        ...entry,
        rank: index + 1,
        stage: Math.min(STAGES, Math.floor(entry.height / number(rules.stage_height))),
      }),
    ),
    sites: deepSites(rows),
  };
}

/**
 * The Deep's sites by kind (DeepSite), each guard (DeepGuard) read from its army (ExplorerTroops), its settled tick
 * (DeepArmy) and its home's owner and Aspect. A guard whose army, tick, home or Aspect is missing is a fault, and so is
 * a site whose guards' Aspects differ: a site is never shown with a guard it cannot name, nor a holder read from one
 * guard for the others.
 */
function deepSites(rows: (model: string) => Row[]): HeraldRaceSite[] {
  const guards = rows("DeepGuard");
  const armies = rows("ExplorerTroops");
  const ticks = rows("DeepArmy");
  const homes = rows("HomeAspect");
  const structures = rows("Structure");
  return rows("DeepSite")
    .map((site) => {
      const posted = guards
        .filter((guard) => integer(guard.site_id) === integer(site.entity_id))
        .map((guard) => siteGuard(guard, armies, ticks, structures))
        .sort((a, b) => a.slot - b.slot);
      return {
        site_id: integer(site.entity_id).toString(),
        kind: number(site.kind),
        holder: siteHolder(site, posted, homes),
        guards: posted,
      };
    })
    .sort((a, b) => a.kind - b.kind);
}

function siteGuard(guard: Row, armies: Row[], ticks: Row[], structures: Row[]): HeraldRaceSite["guards"][number] {
  const explorer = integer(guard.explorer_id);
  const army = armies.find((each) => integer(each.explorer_id) === explorer);
  const tick = ticks.find((each) => integer(each.explorer_id) === explorer);
  if (!army || !tick) throw new Error(`Deep guard ${explorer} has no army or tick`);
  const home = structures.find((each) => integer(each.entity_id) === integer(army.owner));
  if (!home) throw new Error(`Deep guard ${explorer} has no home`);
  return {
    slot: number(guard.slot),
    explorer_id: explorer.toString(),
    structure_id: integer(army.owner).toString(),
    address: address(home.owner),
    troops: Number(integer(record(army.troops).count)) / RESOURCE_PRECISION,
    last_tick: number(tick.last_tick),
  };
}

/** The one Aspect every guard's home joined; none while no guard is posted (the day's beast holds the site). */
function siteHolder(site: Row, guards: HeraldRaceSite["guards"], homes: Row[]): AspectId | null {
  const held = new Set(guards.map((guard) => homeAspect(homes, guard.structure_id)));
  if (held.size > 1) throw new Error(`Deep site ${integer(site.entity_id)} has guards of more than one Aspect`);
  return held.values().next().value ?? null;
}

function homeAspect(homes: Row[], home: string): AspectId {
  const row = homes.find((each) => integer(each.home) === integer(home));
  if (!row) throw new Error(`Deep guard's home ${home} joined no Aspect`);
  return aspectId(number(row.aspect));
}

/** The Aspect whose hyperstructure finished; none while the race runs, or when the mist won. */
function winnerOf(result: Row | undefined): AspectId | null {
  if (!result || result.winner === null || result.winner === undefined) return null;
  return aspectId(number(result.winner));
}

function aspectId(value: number): AspectId {
  const aspect = aspects.find(({ id }) => id === value);
  if (!aspect) throw new Error(`Race names unknown Aspect ${value}`);
  return aspect.id;
}

/** Every Aspect has its hyperstructure from the game's creation (race::initialize_race); a missing one is a fault. */
function heightOf(hyperstructures: Row[], aspect: AspectId): number {
  const row = hyperstructures.find((each) => number(each.aspect) === aspect);
  if (!row) throw new Error(`Race has no hyperstructure for Aspect ${aspect}`);
  return number(row.height);
}

/** The day a stage's Triumph falls on; null while the stage is not built. */
function triumphDay(days: Row[], aspect: AspectId, stage: number): number | null {
  const row = days.find((each) => number(each.aspect) === aspect && number(each.stage) === stage);
  return row ? number(row.day) : null;
}

function finishedFirst(a: { aspect: AspectId }, b: { aspect: AspectId }, winner: AspectId | null): number {
  return Number(b.aspect === winner) - Number(a.aspect === winner);
}

/**
 * Each Aspect's members, the homes that joined it, by Glory (most first, ties by address): each named by its owner,
 * with its Glory in whole units. A home with no RaceMember row has held no site yet: its Glory is zero.
 */
function aspectMembers(homes: Row[], members: Row[], structures: Row[]) {
  return (aspect: AspectId): HeraldRaceAspect["members"] =>
    homes
      .filter((home) => number(home.aspect) === aspect)
      .map((home) => {
        const structure = structures.find((each) => integer(each.entity_id) === integer(home.home));
        if (!structure) throw new Error(`Aspect member ${String(home.home)} has no Structure`);
        const member = members.find((each) => integer(each.entity_id) === integer(home.home));
        return {
          address: address(structure.owner),
          structure_id: integer(home.home).toString(),
          glory: Number(integer(member?.glory ?? 0)) / RESOURCE_PRECISION,
        };
      })
      .sort((a, b) => b.glory - a.glory || a.address.localeCompare(b.address));
}
