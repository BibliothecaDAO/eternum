// Settlement location interface
export interface SettlementLocation {
  side: number;
  layer: number;
  point: number;
  x: number;
  y: number;
  isMine?: boolean;
}
