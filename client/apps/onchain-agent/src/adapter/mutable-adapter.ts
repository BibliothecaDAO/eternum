import type { ActionResult, GameAction, GameAdapter, SimulationResult, WorldState } from "@mariozechner/pi-onchain-agent";

export class MutableGameAdapter<TState extends WorldState = WorldState> implements GameAdapter<TState> {
  constructor(private current: GameAdapter<TState>) {}

  setAdapter(next: GameAdapter<TState>) {
    this.current = next;
  }

  getAdapter(): GameAdapter<TState> {
    return this.current;
  }

  async getWorldState(): Promise<TState> {
    return this.current.getWorldState();
  }

  async executeAction(action: GameAction): Promise<ActionResult> {
    return this.current.executeAction(action);
  }

  async simulateAction(action: GameAction): Promise<SimulationResult> {
    return this.current.simulateAction(action);
  }

  subscribe?(callback: (state: TState) => void): () => void {
    if (!this.current.subscribe) {
      return () => {};
    }
    return this.current.subscribe(callback);
  }
}
