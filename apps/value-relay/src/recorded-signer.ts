import { Signer } from "starknet";
/** The SDK owns hashing/signature formats; identity records the exact hash before submission. */
export class RecordedSigner extends Signer {
  constructor(
    key: string,
    private readonly record: (hash: string) => Promise<void>,
  ) {
    super(key);
  }
  override async signRaw(digest: string) {
    const signature = await super.signRaw(digest);
    await this.record(digest);
    return signature;
  }
}
