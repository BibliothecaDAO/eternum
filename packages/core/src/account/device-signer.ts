import { Signer } from "starknet";
import { signGameplayIntent } from "@bibliothecadao/provider";
/** Signs as the account's device; with an approval, the signature also carries the guardian's `[r, s]` to join. */
export class DeviceSigner extends Signer {
  constructor(
    private readonly device: { privateKey: string; publicKey: string },
    private readonly approval: string[] = [],
  ) {
    super(device.privateKey);
  }
  override async signRaw(digest: string): Promise<string[]> {
    return [...signGameplayIntent(digest, this.device.privateKey), ...this.approval];
  }
}
