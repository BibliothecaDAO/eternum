import { ID } from "@bibliothecadao/types";
import { Component, Metadata, Schema, getComponentValue, removeComponent } from "@dojoengine/recs";
import { setEntities } from "@dojoengine/state";
import { PatternMatching, ToriiClient } from "@dojoengine/torii-client";
import { LogicalOperator } from "@dojoengine/torii-wasm";
import { getEntityIdFromKeys } from "@dojoengine/utils";

/**
 * Loop A of the ghost-army fix: the level-triggered "local RECS == Torii"
 * invariant enforcer.
 *
 * Deletions only ever reach the client as push events (a Torii deletion payload
 * -> world.deleteEntity -> onDeadArmy). A silent stream drop, a reconnect gap,
 * or a stale snapshot write can swallow that single event, after which the dead
 * army emits no further updates and the stale ExplorerTroops component persists
 * in RECS forever. This sweep re-queries Torii by entity id for every tracked
 * army and surgically removes the ExplorerTroops component for armies Torii no
 * longer knows — firing the exact same component-removal edge the real deletion
 * path produces, so the existing onDeadArmy -> deleteArmy pipeline runs.
 *
 * removeComponent (not world.deleteEntity) on purpose: the by-id query only
 * proves the ExplorerTroops model is gone; sibling models under the same keys
 * may legitimately still exist, and deleting the whole entity would wipe them.
 *
 * Armies that ARE returned get re-applied through setEntities, healing any
 * coord/count drift via the normal onExplorerTroopsUpdate flow.
 */

export const ARMY_AUTHORITATIVE_SWEEP_INTERVAL_MS = 30_000;
// Skip armies tracked less than this: a freshly created army can be visible
// optimistically before Torii has indexed its create transaction.
export const ARMY_AUTHORITATIVE_MIN_TRACKED_AGE_MS = 30_000;
// Per-page Torii query deadline. A timed-out page rejects the await, which the
// existing catch treats exactly like a failed query: state unchanged, never a
// mass-death. This bounds how long a slow/degraded Torii can hold the loop —
// the LOCAL-freeze failure mode Phase 3 instruments.
const ARMY_SWEEP_QUERY_TIMEOUT_MS = 15_000;

const EXPLORER_TROOPS_MODEL = "s1_eternum-ExplorerTroops";
const SWEEP_QUERY_BATCH_SIZE = 100;
// Tripwire against a degraded Torii answering with bogus empty pages: if a
// single sweep would confirm-kill this many armies AND more than half the
// candidate set, distrust the result and change nothing.
const SUSPICIOUS_DEAD_MIN_COUNT = 10;
const SUSPICIOUS_DEAD_MAX_RATIO = 0.5;

interface ToriiEntityPageItem {
  hashed_keys: string;
  models?: Record<string, object | undefined>;
}

type ToriiEntityPageItems = ToriiEntityPageItem[] | Record<string, ToriiEntityPageItem>;

export interface ArmyAuthoritativeSweepClassification {
  /** Missing from Torii for the second consecutive sweep — confirmed dead. */
  confirmedDead: ID[];
  /** Two-strike state to feed back into the next sweep. */
  nextMissing: Set<ID>;
}

/**
 * Pure two-strike classifier. An id must be absent from Torii in two
 * consecutive sweeps before it is confirmed dead; ids that reappear drop out
 * of the missing set automatically.
 */
export function classifyAuthoritativeSweep(input: {
  candidateIds: readonly ID[];
  presentIds: ReadonlySet<ID>;
  previousMissing: ReadonlySet<ID>;
}): ArmyAuthoritativeSweepClassification {
  const confirmedDead: ID[] = [];
  const nextMissing = new Set<ID>();

  for (const id of input.candidateIds) {
    if (input.presentIds.has(id)) {
      continue;
    }
    if (input.previousMissing.has(id)) {
      confirmedDead.push(id);
    } else {
      nextMissing.add(id);
    }
  }

  return { confirmedDead, nextMissing };
}

export function isSuspiciousAuthoritativeDeadSet(confirmedDeadCount: number, candidateCount: number): boolean {
  return (
    confirmedDeadCount >= SUSPICIOUS_DEAD_MIN_COUNT &&
    candidateCount > 0 &&
    confirmedDeadCount / candidateCount > SUSPICIOUS_DEAD_MAX_RATIO
  );
}

/**
 * Wall-clock timing for one sweep, so the caller can detect a sweep that blocks
 * the event loop (a perceived "freeze"/disconnect that is actually LOCAL).
 */
export interface ArmyAuthoritativeSweepTiming {
  totalMs: number;
  /** Longest single awaited Torii getEntities() call. */
  maxQueryMs: number;
  /** Longest single awaited setEntities() RECS write. */
  maxApplyMs: number;
  pageCount: number;
}

export interface ArmyAuthoritativeSweepResult {
  outcome: "completed" | "failed" | "aborted_suspicious" | "skipped_empty";
  confirmedDead: ID[];
  /** Two-strike state for the next sweep; unchanged when the sweep fails. */
  nextMissing: ReadonlySet<ID>;
  reappliedCount: number;
  timing: ArmyAuthoritativeSweepTiming;
}

export interface ArmyAuthoritativeSweepInput<S extends Schema> {
  toriiClient: ToriiClient;
  /** All contract components, for setEntities re-application. */
  components: Component<S, Metadata, undefined>[];
  /** The ExplorerTroops component, for surgical removal. */
  explorerTroopsComponent: Component<S, Metadata, undefined>;
  candidateIds: readonly ID[];
  previousMissing: ReadonlySet<ID>;
  /** Per-page Torii query deadline (ms). Defaults to ARMY_SWEEP_QUERY_TIMEOUT_MS. */
  queryTimeoutMs?: number;
}

function withOperationTimeout<T>(operation: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  if (!timeoutMs || timeoutMs <= 0) {
    return operation;
  }
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    operation.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

const isValidId = (id: unknown): id is ID => typeof id === "number" && Number.isFinite(id) && (id as number) > 0;

const buildByIdClause = (ids: readonly ID[]) => {
  const keysFor = (id: ID) => ({
    Keys: {
      keys: [id.toString()],
      pattern_matching: "VariableLen" as PatternMatching,
      models: [],
    },
  });

  return ids.length === 1
    ? keysFor(ids[0])
    : {
        Composite: {
          operator: "Or" as LogicalOperator,
          clauses: ids.map(keysFor),
        },
      };
};

const hasExplorerTroopsModelData = (models: Record<string, object | undefined> | undefined): boolean => {
  const model = models?.[EXPLORER_TROOPS_MODEL];
  return model !== undefined && model !== null && Object.keys(model).length > 0;
};

const normalizeToriiPageItems = (items: ToriiEntityPageItems | undefined): ToriiEntityPageItem[] => {
  if (!items) {
    return [];
  }
  return Array.isArray(items) ? items : Object.values(items);
};

/**
 * Queries Torii authoritatively for the given army ids and reconciles local
 * RECS: present armies are re-applied (awaited, so RECS writes land before the
 * promise resolves), armies missing twice in a row get their ExplorerTroops
 * component removed so the existing dead-army pipeline fires.
 *
 * Never throws; a failed query returns outcome "failed" with zero state
 * changes so a flaky network cannot masquerade as mass death.
 */
export async function sweepArmiesAgainstTorii<S extends Schema>(
  input: ArmyAuthoritativeSweepInput<S>,
): Promise<ArmyAuthoritativeSweepResult> {
  const startedAtMs = performance.now();
  let maxQueryMs = 0;
  let maxApplyMs = 0;
  let pageCount = 0;
  const buildTiming = (): ArmyAuthoritativeSweepTiming => ({
    totalMs: performance.now() - startedAtMs,
    maxQueryMs,
    maxApplyMs,
    pageCount,
  });

  const candidateIds = input.candidateIds.filter(isValidId);
  if (candidateIds.length === 0) {
    return {
      outcome: "skipped_empty",
      confirmedDead: [],
      nextMissing: new Set(),
      reappliedCount: 0,
      timing: buildTiming(),
    };
  }

  const queryTimeoutMs = input.queryTimeoutMs ?? ARMY_SWEEP_QUERY_TIMEOUT_MS;
  const presentIds = new Set<ID>();
  const entityKeyToId = new Map<string, ID>();
  candidateIds.forEach((id) => entityKeyToId.set(getEntityIdFromKeys([BigInt(id)]), id));

  let reappliedCount = 0;

  try {
    for (let offset = 0; offset < candidateIds.length; offset += SWEEP_QUERY_BATCH_SIZE) {
      const batch = candidateIds.slice(offset, offset + SWEEP_QUERY_BATCH_SIZE);
      const clause = buildByIdClause(batch);

      let cursor: string | undefined;
      for (;;) {
        const queryStartedAtMs = performance.now();
        const page = await withOperationTimeout(
          input.toriiClient.getEntities({
            pagination: { limit: SWEEP_QUERY_BATCH_SIZE, cursor, direction: "Forward", order_by: [] },
            clause,
            no_hashed_keys: false,
            models: [EXPLORER_TROOPS_MODEL],
            historical: false,
          }),
          queryTimeoutMs,
          "army authoritative sweep query",
        );
        maxQueryMs = Math.max(maxQueryMs, performance.now() - queryStartedAtMs);
        pageCount += 1;

        const items = normalizeToriiPageItems(page.items as ToriiEntityPageItems | undefined);
        const presentItems = items.filter((item) => hasExplorerTroopsModelData(item.models));

        for (const item of presentItems) {
          const id = entityKeyToId.get(item.hashed_keys);
          if (id !== undefined) {
            presentIds.add(id);
          }
        }

        if (presentItems.length > 0) {
          // Awaited per page so RECS state is settled before classification
          // (the same reason the config fetch awaits its writes).
          const applyStartedAtMs = performance.now();
          await setEntities(presentItems, input.components, false);
          maxApplyMs = Math.max(maxApplyMs, performance.now() - applyStartedAtMs);
          reappliedCount += presentItems.length;
        }

        if (items.length < SWEEP_QUERY_BATCH_SIZE || !page.next_cursor) break;
        cursor = page.next_cursor;
      }
    }
  } catch (error) {
    console.warn("[army-reconciler] authoritative sweep query failed; keeping state unchanged", error);
    return {
      outcome: "failed",
      confirmedDead: [],
      nextMissing: input.previousMissing,
      reappliedCount,
      timing: buildTiming(),
    };
  }

  const { confirmedDead, nextMissing } = classifyAuthoritativeSweep({
    candidateIds,
    presentIds,
    previousMissing: input.previousMissing,
  });

  if (isSuspiciousAuthoritativeDeadSet(confirmedDead.length, candidateIds.length)) {
    console.warn(
      `[army-reconciler] sweep would confirm ${confirmedDead.length}/${candidateIds.length} armies dead — distrusting result`,
    );
    return {
      outcome: "aborted_suspicious",
      confirmedDead: [],
      nextMissing: input.previousMissing,
      reappliedCount,
      timing: buildTiming(),
    };
  }

  for (const id of confirmedDead) {
    const entity = getEntityIdFromKeys([BigInt(id)]);
    // Only fire the removal edge if RECS still holds the stale component:
    // onDeadArmy needs a prevState, and an already-clean RECS means the scene
    // side (Loop B) owns whatever visual remains.
    if (getComponentValue(input.explorerTroopsComponent, entity) !== undefined) {
      if (import.meta.env.DEV) {
        console.warn(`[army-reconciler] army ${id} missing on Torii twice — removing stale ExplorerTroops`);
      }
      removeComponent(input.explorerTroopsComponent, entity);
    }
  }

  return { outcome: "completed", confirmedDead, nextMissing, reappliedCount, timing: buildTiming() };
}
