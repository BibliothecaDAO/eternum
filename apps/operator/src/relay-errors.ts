export class PoisonedRelayMessageError extends Error {
  public constructor(
    public readonly direction: "registration" | "results",
    public readonly gameId: number,
    detail: string,
  ) {
    super(`Permanent ${direction} rejection for game ${gameId}: ${detail}`);
    this.name = "PoisonedRelayMessageError";
  }
}
