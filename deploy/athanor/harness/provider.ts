import { BlockTag, RpcProvider, WebSocketChannel } from "starknet";

/** One socket per run; the SDK restores subscriptions and the node sends their current canonical status. */
export class HarnessProvider extends RpcProvider {
  private observations?: { channel: WebSocketChannel; ready: Promise<unknown> };

  constructor(private readonly rpcUrl: string) {
    super({ blockIdentifier: BlockTag.PRE_CONFIRMED, nodeUrl: rpcUrl });
  }

  async subscribeTransactionStatus(transactionHash: string) {
    if (!this.observations) {
      const channel = new WebSocketChannel({ nodeUrl: this.rpcUrl.replace(/^http/, "ws"), autoReconnect: true });
      this.observations = { channel, ready: channel.waitForConnection() };
    }
    await this.observations.ready;
    return this.observations.channel.subscribeTransactionStatus({ transactionHash });
  }

  dispose(): void {
    this.observations?.channel.disconnect();
  }
}
