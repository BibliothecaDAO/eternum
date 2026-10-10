import { ec, Signer } from "starknet";
/** Signs as the account's device; with an approval, the signature also carries the guardian's `[r, s]` to join. */
export class DeviceSigner extends Signer {
  constructor(
    private readonly device: { privateKey: string; publicKey: string },
    private readonly approval: string[] = [],
  ) {
    super(device.privateKey);
  }
  override async signRaw(digest: string): Promise<string[]> {
    const { r, s } = ec.starkCurve.sign(digest, this.device.privateKey);
    return [
      ec.starkCurve.getStarkKey(this.device.privateKey),
      `0x${r.toString(16)}`,
      `0x${s.toString(16)}`,
      ...this.approval,
    ];
  }
}
