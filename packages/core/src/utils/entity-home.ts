/** Entity IDs carry the home namespace in their upper32bits; old setup homes use their low ID. */
export function entityHomeNamespace(entityId: number | bigint | string): number {
  if (typeof entityId === "number" && !Number.isSafeInteger(entityId)) throw new Error("Unsafe home entity id");
  const value = BigInt(entityId);
  if (value <= 0n || value > 0xffffffffffffffffn) throw new Error("Invalid home entity id");
  return Number(value < 0x100000000n ? value : value >> 32n);
}
