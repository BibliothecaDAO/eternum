import { ContractAddress, Position } from "@bibliothecadao/eternum";

export enum EventType {
  BurnDonkey = "BurnDonkey",
  SettleRealm = "SettleRealmData",
  Swap = "SwapEvent",
  HyperstructureFinished = "HyperstructureFinished",
  HyperstructureContribution = "HyperstructureContribution",
  AcceptOrder = "AcceptOrder",
}

export interface EventData {
  to: ContractAddress | undefined;
  name: string | undefined;
  action: string;
  eventType: EventType;
  timestamp: number;
  position: Position | undefined;
  address: ContractAddress | undefined;
}
