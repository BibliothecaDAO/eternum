import type { GameAdapter, GameAction, ActionResult, SimulationResult } from "@bibliothecadao/game-agent";
import type { EternumClient } from "@bibliothecadao/client";
import type { Account } from "starknet";
import type { EternumWorldState } from "./world-state";
import { buildWorldState } from "./world-state";
import { executeAction } from "./action-registry";
import { simulateAction } from "./simulation";

/**
 * Adapter connecting the Eternum headless client to the pi-onchain-agent framework.
 *
 * Implements `GameAdapter<EternumWorldState>`:
 * - `getWorldState()` — queries all views in parallel via the client
 * - `executeAction()` — dispatches to the action registry → client transactions
 * - `simulateAction()` — uses pure compute functions for dry-run estimates
 */
export class EternumGameAdapter implements GameAdapter<EternumWorldState> {
  constructor(
    private client: EternumClient,
    private signer: Account,
    private accountAddress: string,
  ) {}

  async getWorldState(): Promise<EternumWorldState> {
    return buildWorldState(this.client, this.accountAddress);
  }

  async executeAction(action: GameAction): Promise<ActionResult> {
    return executeAction(this.client, this.signer, action);
  }

  async simulateAction(action: GameAction): Promise<SimulationResult> {
    return simulateAction(action);
  }
}
