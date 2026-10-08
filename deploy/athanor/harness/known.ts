/** A fact the harness player's own realm must hold; a miss means the realm is not synchronized, never a zero. */
export const known = <T>(value: T | null | undefined, realmId: number, what: string): T => {
  if (value === undefined || value === null) throw new Error(`Realm ${realmId} has no synchronized ${what}`);
  return value;
};
