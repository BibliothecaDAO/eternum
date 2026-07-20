export function assertLegacyLaunchEnvironmentIsMutable(environmentId: string): void {
  assertHistoricalEnvironmentIsReadOnly(environmentId);
  if (environmentId === "mainnet.eternum") {
    throw new Error("Mainnet Eternum creation is retired; operator workflows may provision its Torii only");
  }
  if (environmentId === "mainnet.blitz") {
    throw new Error("Public mainnet Blitz creation is available only through the game-stack API");
  }
}

export function assertHistoricalEnvironmentIsReadOnly(environmentId: string): void {
  if (environmentId.startsWith("slot.") || environmentId.startsWith("slottest.")) {
    throw new Error(`Historical Slot environment "${environmentId}" is read-only`);
  }
}
