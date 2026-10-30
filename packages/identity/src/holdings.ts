/**
 * A Realm the account's linked wallet holds, as the Realm index lists it: its number, and the index's map of it (an
 * absolute address) when the index has one. Identity reads it, the value relay passes it on, a game's Realm step draws it.
 */
export interface HeldRealm {
  realmId: number;
  map: string | null;
}

/**
 * The value relay's held-Realms answer. `realms` (the numbers) is what clients before the maps (10-29) read, and stays
 * for them; `held` is each Realm with its map, absent from a relay before the maps.
 */
export interface HeldRealmsAnswer {
  realms: number[];
  held?: HeldRealm[];
}
