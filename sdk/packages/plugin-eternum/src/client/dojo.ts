import { IAgentRuntime } from "@ai16z/eliza";

// The goal of this is to build a generic client that interfaces with the game world

interface Player {
  address: string;
}

export class DojoClient {
  private readonly runtime: IAgentRuntime;
  private readonly dojoConfig: DojoConfig;
  private readonly player: Player;

  public tick: number = 0; // Agent Tick

  constructor(runtime: IAgentRuntime, dojoConfig: DojoConfig, player: Player) {
    this.runtime = runtime;
    this.dojoConfig = dojoConfig;
    this.player = player;
  }

  async getWorldState(): Promise<string> {
    return ""; // TODO: implement
  }

  async getQueriesAvailable(): Promise<string> {
    return ""; // TODO: implement
  }

  async getAvailableActions(): Promise<string> {
    return ""; // TODO: implement
  }

  async invokeAction(action: string, data: string): Promise<string> {
    return ""; // TODO: implement
  }

  async queryAction(action: string, data: string): Promise<string> {
    return ""; // TODO: implement
  }
}

export class EternumClient extends DojoClient {
  constructor(runtime: IAgentRuntime, dojoConfig: DojoConfig, player: Player) {
    super(runtime, dojoConfig, player);
  }
}
