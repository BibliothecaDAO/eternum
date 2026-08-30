export interface ChainEvent {
  block_number: number;
  transaction_hash: string;
  transaction_index: number;
  event_index: number;
  from_address: string;
  keys: string[];
  data: string[];
}

export interface LedgerRegistrationMessage {
  gameId: number;
  owner: string;
  realmId: bigint;
  metadata: readonly [string, string, string];
}

export interface LedgerResultRow {
  owner: string;
  rank: number;
  chests: number;
}

export interface LedgerResultsMessage {
  gameId: number;
  trialId: bigint;
  rows: LedgerResultRow[];
}

export interface CursorStore {
  close(): Promise<void>;
  read(stream: string, initialNextBlock: number): Promise<number>;
  advance(stream: string, nextBlock: number): Promise<void>;
}

export interface EventSource {
  blockNumber(): Promise<number>;
  getEvents(input: {
    address: string;
    fromBlock: number;
    keys: string[][];
    toBlock: number;
  }): Promise<ChainEvent[]>;
}

export interface RegistrationWriter {
  write(message: LedgerRegistrationMessage): Promise<string>;
}

export interface ResultsWriter {
  isFinalized(gameId: number): Promise<boolean>;
  write(message: LedgerResultsMessage): Promise<string>;
}
