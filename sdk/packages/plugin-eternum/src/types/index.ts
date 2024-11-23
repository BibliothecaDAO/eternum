import { State } from "@ai16z/eliza";

export interface EternumState extends State {
  worldState: string;
  queriesAvailable: string;
  availableActions: string;
}
