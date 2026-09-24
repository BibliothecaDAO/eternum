import { byteArray, CallData, hash } from "starknet";

/**
 * A Realms account's id on chain: the Poseidon hash of the better-auth user id, serialized as a Cairo `ByteArray`
 * (`[data_len, ...data, pending_word, pending_word_len]`, UTF-8 bytes). It is every gameplay account's deploy salt and
 * constructor argument, so it fixes the account's address on every shard. It never changes.
 */
export const realmsIdOf = (userId: string): string =>
  hash.computePoseidonHashOnElements(CallData.compile(byteArray.byteArrayFromString(userId)));
