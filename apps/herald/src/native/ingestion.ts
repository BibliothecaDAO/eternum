import { deriveReleaseFacts, type ReleaseRulesGame } from "./release-facts";
import { scaleGameClocks } from "../../../../config/source/common/season-clock";
import { RELEASE_DEFINITIONS, releaseDefinition, type ReleaseDefinitions } from "./release-definition";
import { nativeRowKey } from "./row-key";
import { gameplayRejection } from "@bibliothecadao/provider";
import { transactionScopes } from "./transactions";
import type { MadaraRpc, ReadBlockOptions } from "../madara-rpc";
import { normalizeFelt } from "../model-registry";
import type {
  DecodedRecord,
  DecodedWorldEvent,
  FoldChange,
  RpcBlockTransaction,
  RpcBlockWithReceipts,
  RpcEvent,
  RpcReceipt,
  RpcTransaction,
} from "../types";
import { WorldFold } from "../world-fold";
import { atPosition, NativeDecoder } from "./decoder";

export class NativeReceiptRejected extends Error {
  constructor(
    readonly block: number | null,
    readonly transactionHash: string,
    cause: unknown,
  ) {
    super(cause instanceof Error ? cause.message : String(cause), { cause });
  }
}

/** A receipt's native events as the overlay decoded them while the receipt was pre-confirmed. */
export interface PreconfirmedDecode {
  events: readonly RpcEvent[];
  decoded: readonly DecodedWorldEvent[];
}

const sameFelts = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length && left.every((felt, index) => felt === right[index]);

const sameEvents = (left: readonly RpcEvent[], right: readonly RpcEvent[]) =>
  left.length === right.length &&
  left.every(
    (event, index) =>
      event.from_address === right[index]!.from_address &&
      sameFelts(event.keys, right[index]!.keys) &&
      sameFelts(event.data, right[index]!.data) &&
      (event.event_index ?? index) === (right[index]!.event_index ?? index),
  );

const REPLAY_EVENT_BUDGET = 16_384;

function releaseRuleChanges(decoded: DecodedWorldEvent[]): ReleaseRulesGame[] {
  const games = new Map<string, ReleaseRulesGame>();
  for (const event of decoded) {
    if (event.model.name === "GameOverrides" && event.kind !== "set")
      throw new Error("GameOverrides must be an immutable launch fact");
    const changesRules =
      event.kind === "set" && (event.model.name === "GameOverrides" || event.model.name === "GameRelease");
    if (changesRules) games.set(String(event.key.game_id), { gameId: event.key.game_id, position: event.position });
  }
  return [...games.values()];
}

export class NativeIngestion {
  receiptFailures = 0;
  routingFailures = 0;
  halted?: NativeReceiptRejected;
  constructor(
    readonly decoder: NativeDecoder,
    private readonly definitions: ReleaseDefinitions = RELEASE_DEFINITIONS,
  ) {}

  rejectReceipt(receipt: RpcReceipt, block: number | null, cause: unknown, confirmed: boolean) {
    const rejection = new NativeReceiptRejected(block, normalizeFelt(receipt.transaction_hash), cause);
    this.receiptFailures++;
    if (confirmed) this.halted = rejection;
    console.error(
      JSON.stringify({
        event: "herald_native_receipt_rejected",
        block,
        transactionHash: rejection.transactionHash,
        error: rejection.message,
        confirmed,
        foldHalted: confirmed,
      }),
    );
    return rejection;
  }

  rejectRouting(transactionHash: string, cause: unknown) {
    this.routingFailures++;
    console.error(
      JSON.stringify({
        event: "herald_native_transaction_routing_failed",
        transactionHash,
        error: cause instanceof Error ? cause.message : String(cause),
      }),
    );
  }

  transactionScopes(transaction: Pick<RpcTransaction, "calldata" | "sender_address">) {
    return transactionScopes(this.decoder.manifest, transaction);
  }

  applyReceipt(
    fold: WorldFold,
    receipt: RpcReceipt,
    blockNumber: number | null,
    transactionIndex: number,
    earlier?: PreconfirmedDecode,
  ) {
    const preview = fold.overlay();
    const { events, decoded } = this.validateReceipt(preview, receipt, blockNumber, transactionIndex, earlier);
    return { events, decoded, changes: this.commit(fold, events) };
  }

  /**
   * The receipt with the game's refusal, if Games recorded one (GameplayRejected v1): the action rolled back, so its
   * status is REJECTED with the game's reason, distinct from a pre-roll REVERTED. For a receipt already validated.
   */
  outcomeReceipt(receipt: RpcReceipt): RpcReceipt {
    if (receipt.execution_status === "REVERTED") return receipt;
    const rejection = gameplayRejection(
      receipt.events,
      this.decoder.manifest.world.address,
      normalizeFelt(receipt.transaction_hash),
    );
    return rejection ? { ...receipt, rejection } : receipt;
  }

  async replay(input: {
    fold: WorldFold;
    rpc: Pick<MadaraRpc, "readBlock">;
    fromBlock: number;
    toBlock: number;
    /** Live confirmation publishes receipt outcomes; cold replay needs only history and folded rows. */
    retainTransactions?: boolean;
    readOptions?: ReadBlockOptions;
    /** The overlay's decode of a receipt it holds, reused when the confirmed receipt repeats its events. */
    preconfirmed?: (receipt: RpcReceipt) => PreconfirmedDecode | undefined;
    beforeBlock?: (fold: WorldFold, block: RpcBlockWithReceipts, events: readonly DecodedWorldEvent[]) => Promise<void>;
    beforeCommit?: (events: readonly DecodedWorldEvent[], throughBlock: number) => Promise<void>;
  }) {
    if (this.halted) throw this.halted;
    const preview = input.fold.overlay();
    const events: DecodedWorldEvent[] = [];
    const transactions: RpcBlockTransaction[] = [];
    let pages = 0;
    let throughBlock = input.toBlock;
    let timestamp: number | undefined;
    for (
      let number = Math.max(input.fromBlock, this.decoder.manifest.native.deploymentBlock);
      number <= input.toBlock;
      number++
    ) {
      const block = await input.rpc.readBlock(number, this.decoder.manifest.world.address, {
        ...input.readOptions,
        retainTransactions: input.retainTransactions,
      });
      if (block.block_number !== number) throw new Error("Native replay block number mismatch");
      pages++;
      await input.beforeBlock?.(preview, block, events);
      block.transactions.forEach(({ receipt, transaction }, index) => {
        try {
          const validated = this.validateReceipt(preview, receipt, number, index, input.preconfirmed?.(receipt));
          events.push(...validated.events);
          if (input.retainTransactions !== false)
            transactions.push({
              transaction,
              receipt: this.outcomeReceipt({ ...receipt, block_number: number }),
            });
        } catch (error) {
          throw this.rejectReceipt(receipt, number, error, true);
        }
      });
      throughBlock = number;
      timestamp = block.timestamp;
      if (events.length >= REPLAY_EVENT_BUDGET) break;
    }
    await input.beforeCommit?.(events, throughBlock);
    const changes = this.commit(input.fold, events);
    const byBlock = new Map<number, FoldChange[]>();
    changes.forEach(({ event, change }) => {
      if (!change) return;
      const block = event.position.blockNumber!;
      const batch = byBlock.get(block) ?? [];
      batch.push(change);
      byBlock.set(block, batch);
    });
    return {
      throughBlock,
      timestamp,
      events,
      transactions,
      changes: byBlock,
      metrics: {
        decoded_events: events.length,
        event_messages: events.filter((event) => event.kind === "event").length,
        store_events: events.filter((event) => event.kind !== "event").length,
        pages,
      },
    };
  }

  receipts(block: RpcBlockWithReceipts) {
    return block.transactions.flatMap(({ receipt }, transactionIndex) =>
      receipt.events.some((event) => this.decoder.owns(event.from_address)) ? [{ receipt, transactionIndex }] : [],
    );
  }

  private validateReceipt(
    fold: WorldFold,
    receipt: RpcReceipt,
    blockNumber: number | null,
    transactionIndex: number,
    earlier?: PreconfirmedDecode,
  ): { events: DecodedWorldEvent[]; decoded: DecodedWorldEvent[] } {
    if (receipt.execution_status === "REVERTED") return { events: [], decoded: [] };
    const decoded = this.decodeReceipt(receipt, blockNumber, transactionIndex, earlier);
    decoded.forEach((event) => fold.apply(event));
    const derived = releaseRuleChanges(decoded).flatMap((game) => this.releaseRules(fold, game));
    derived.forEach((event) => fold.apply(event));
    return { events: [...decoded, ...derived], decoded };
  }

  restoreReleaseRules(fold: WorldFold, confirmedBlock: number): void {
    const position = { blockNumber: confirmedBlock, transactionHash: "0x0", transactionIndex: 0, eventIndex: 0 };
    for (const { value } of fold.modelRows("GameRelease")) {
      if (!this.definitions.has(Number(value.release_id))) continue;
      this.releaseRules(fold, { gameId: value.game_id, position }).forEach((event) => fold.apply(event));
    }
  }

  private releaseRules(fold: WorldFold, game: ReleaseRulesGame): DecodedWorldEvent[] {
    const key = nativeRowKey([String(game.gameId)]);
    const overrides = fold.currentRow("GameOverrides", key)?.value;
    if (!overrides) return [];
    const release = fold.currentRow("GameRelease", key)?.value;
    if (!release) throw new Error("GameOverrides requires GameRelease");
    const registry = fold.currentRow("GameRegistry", key)?.value;
    if (!registry) throw new Error("GameOverrides requires GameRegistry");
    const definition = scaleGameClocks(
      releaseDefinition(this.definitions, Number(release.release_id)) as Parameters<typeof scaleGameClocks>[0],
      Number(registry.clock_scale),
    ) as DecodedRecord;
    const rows = deriveReleaseFacts(this.decoder, definition, overrides, game);
    return [...this.rowsLeftByEarlierRelease(fold, game, rows), ...rows];
  }

  private rowsLeftByEarlierRelease(
    fold: WorldFold,
    game: ReleaseRulesGame,
    rows: DecodedWorldEvent[],
  ): DecodedWorldEvent[] {
    const derived = new Set(rows.map((row) => `${row.model.name}:${row.entityId}`));
    return this.decoder.derivedRuleModels().flatMap((model) =>
      fold
        .gameRows(model, String(game.gameId))
        .filter(({ key }) => !derived.has(`${model}:${key}`))
        .map(({ key, value }) => this.decoder.deleteDerivedRow(model, key, value, game.position)),
    );
  }

  /**
   * A receipt's native events. Decoding hashes every row, and a transaction's confirmed receipt repeats its
   * pre-confirmed events, so an earlier decode of the same events is reused at this receipt's position.
   */
  private decodeReceipt(
    receipt: RpcReceipt,
    blockNumber: number | null,
    transactionIndex: number,
    earlier?: PreconfirmedDecode,
  ): DecodedWorldEvent[] {
    const owned = (events: readonly RpcEvent[]) =>
      events.flatMap((event, index) =>
        this.decoder.owns(event.from_address) ? [{ ...event, event_index: event.event_index ?? index }] : [],
      );
    if (earlier && sameEvents(owned(earlier.events), owned(receipt.events)))
      return earlier.decoded.map((event) => atPosition(event, { ...event.position, blockNumber, transactionIndex }));
    return receipt.events.flatMap((raw, eventIndex) =>
      this.decoder.owns(raw.from_address)
        ? [
            this.decoder.decode({
              ...raw,
              block_number: blockNumber,
              transaction_hash: normalizeFelt(receipt.transaction_hash),
              transaction_index: transactionIndex,
              event_index: raw.event_index ?? eventIndex,
            }),
          ]
        : [],
    );
  }
  private commit(fold: WorldFold, events: DecodedWorldEvent[]) {
    return events.map((event) => ({ event, change: fold.apply(event) }));
  }
}
