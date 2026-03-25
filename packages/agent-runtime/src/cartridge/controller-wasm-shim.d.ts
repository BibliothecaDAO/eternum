declare module "@cartridge/controller-wasm" {
  export function signerToGuid(input: { starknet: { privateKey: string } }): string;
}
