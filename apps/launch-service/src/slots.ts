export interface PlaytestSlot {
  chainId: string;
  slotId: number;
  name: string;
  closesAt: string;
  closed: boolean;
}

export interface SlotStore {
  get(name: string): Promise<PlaytestSlot>;
  list(): Promise<PlaytestSlot[]>;
  refund(name: string): Promise<number | null>;
}

export class SlotNotFound extends Error {}
