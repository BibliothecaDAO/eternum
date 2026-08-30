import {
  EVENT_EMITTED_SELECTOR,
  REGISTERED_SELECTOR,
  parseLedgerRegistration,
  parseLedgerResults,
  resultCommitment,
} from "./events";
import type { CursorStore, EventSource, RegistrationWriter, ResultsWriter } from "./types";

const MAX_BLOCKS_PER_PASS = 2_000;
const REGISTRATION_STREAM = "mainnet-registrations";
const RESULTS_STREAM = "s2-results";

export interface RelayPassResult {
  fromBlock: number;
  messages: number;
  skipped: number;
  toBlock: number;
}

export class OperatorRelay {
  public constructor(
    private readonly input: {
      cursorStore: CursorStore;
      initialLedgerBlock: number;
      initialS2Block: number;
      ledgerAddress: string;
      ledgerSource: EventSource;
      registrationWriter: RegistrationWriter;
      resultReadySelector: string;
      resultRowSelector: string;
      resultsWriter: ResultsWriter;
      s2Source: EventSource;
      worldAddress: string;
    },
  ) {}

  public async relayRegistrationsOnce(): Promise<RelayPassResult | null> {
    return this.relayRange({
      address: this.input.ledgerAddress,
      initialBlock: this.input.initialLedgerBlock,
      keys: [[REGISTERED_SELECTOR]],
      source: this.input.ledgerSource,
      stream: REGISTRATION_STREAM,
      visit: async (events) => {
        for (const event of events) {
          const message = parseLedgerRegistration(event);
          const transactionHash = await this.input.registrationWriter.write(message);
          log("operator_registration_relayed", { gameId: message.gameId, owner: message.owner, transactionHash });
        }
        return { messages: events.length, skipped: 0 };
      },
    });
  }

  public async relayResultsOnce(): Promise<RelayPassResult | null> {
    return this.relayRange({
      address: this.input.worldAddress,
      initialBlock: this.input.initialS2Block,
      keys: [[EVENT_EMITTED_SELECTOR], [this.input.resultRowSelector, this.input.resultReadySelector]],
      source: this.input.s2Source,
      stream: RESULTS_STREAM,
      visit: async (events) => {
        const messages = parseLedgerResults(events, this.input);
        let skipped = 0;
        for (const message of messages) {
          if (await this.input.resultsWriter.isFinalized(message.gameId)) {
            skipped += 1;
            continue;
          }
          const transactionHash = await this.input.resultsWriter.write(message);
          log("operator_results_relayed", {
            gameId: message.gameId,
            playerCount: message.rows.length,
            resultCommitment: resultCommitment(message),
            transactionHash,
            trialId: message.trialId.toString(),
          });
        }
        return { messages: messages.length, skipped };
      },
    });
  }

  private async relayRange(input: {
    address: string;
    initialBlock: number;
    keys: string[][];
    source: EventSource;
    stream: string;
    visit: (events: Awaited<ReturnType<EventSource["getEvents"]>>) => Promise<{ messages: number; skipped: number }>;
  }): Promise<RelayPassResult | null> {
    const fromBlock = await this.input.cursorStore.read(input.stream, input.initialBlock);
    const head = await input.source.blockNumber();
    if (fromBlock > head) return null;

    const toBlock = Math.min(head, fromBlock + MAX_BLOCKS_PER_PASS - 1);
    const events = await input.source.getEvents({
      address: input.address,
      fromBlock,
      keys: input.keys,
      toBlock,
    });
    const counts = await input.visit(events);
    await this.input.cursorStore.advance(input.stream, toBlock + 1);
    return { fromBlock, toBlock, ...counts };
  }
}

export async function runRelayLoop(input: {
  abort: AbortSignal;
  label: string;
  pollMs: number;
  run: () => Promise<RelayPassResult | null>;
}): Promise<void> {
  while (!input.abort.aborted) {
    try {
      const result = await input.run();
      if (result) log("operator_cursor_advanced", { stream: input.label, ...result });
    } catch (error) {
      console.error(
        JSON.stringify({ event: "operator_relay_failed", stream: input.label, error: errorMessage(error) }),
      );
    }
    await abortableDelay(input.pollMs, input.abort);
  }
}

function abortableDelay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, milliseconds);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function log(event: string, fields: Record<string, unknown>): void {
  console.info(JSON.stringify({ event, ...fields }));
}
