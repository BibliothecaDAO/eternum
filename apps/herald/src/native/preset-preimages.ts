import { hash, shortString } from "starknet";
import type { DecodedRecord, DecodedWorldEvent } from "../types";
import { decodeMembers } from "./serde";
import type { NativeManifest, NativeSchema } from "./schema";
import { accountCalls } from "./transactions";

const DIRECT_REGISTRATION_RULE = "preset registration must be a direct authority account call";

const PRESET_DOMAIN = shortString.encodeShortString("NATIVE_PRESET");

export interface VerifiedPreset {
  commitment: string;
  felts: readonly string[];
}

export class NativePresetCalldataUnavailable extends Error {
  constructor() {
    super("Preset registration requires its successful transaction calldata");
    this.name = "NativePresetCalldataUnavailable";
  }
}

export class NativePresetPreimageUnavailable extends Error {
  constructor(commitment: string) {
    super(`No verified preimage for preset commitment ${commitment}`);
    this.name = "NativePresetPreimageUnavailable";
  }
}

export class NativePresetRegistrationInvalid extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "NativePresetRegistrationInvalid";
  }
}

export function presetPreimageCommitment(felts: readonly string[]): string {
  return BigInt(hash.computePoseidonHashOnElements([PRESET_DOMAIN, "1", ...felts])).toString();
}

export function decodePresetPreimage(schema: NativeSchema, felts: readonly string[]): DecodedRecord {
  const registration = schema.games.entrypoints.find(({ name }) => name === "register_preset");
  if (!registration) throw new NativePresetRegistrationInvalid("Schema has no preset registration");
  return decodeMembers(schema, registration.inputs.slice(1), [...felts]).definition as DecodedRecord;
}

/** A chain commitment is accepted only with its exact preimage from a recognized successful call. */
export function verifyPresetRegistrations(
  manifest: NativeManifest,
  events: readonly DecodedWorldEvent[],
  calldata: string[] | undefined,
): VerifiedPreset[] {
  const registrations = events.filter((event) => event.model.name === "Preset");
  if (!registrations.length) return [];
  if (!calldata) throw new NativePresetCalldataUnavailable();
  const schema = manifest.native.schemas[manifest.native.activeSchema]!;
  const selector = BigInt(hash.getSelectorFromName("register_preset"));
  try {
    const calls = directAccountCalls(calldata).filter(
      (call) => BigInt(call.address) === BigInt(manifest.world.address) && BigInt(call.selector) === selector,
    );
    if (calls.length !== registrations.length)
      throw new Error(`${DIRECT_REGISTRATION_RULE}: unknown call path or unmatched registration events`);
    return registrations.map((event, index) => {
      if (event.kind !== "set") throw new Error("Preset registration must write an immutable commitment");
      const call = calls[index]!;
      const felts = call.calldata.slice(1);
      decodePresetPreimage(schema, felts);
      if (BigInt(call.calldata[0]!) !== BigInt(event.key.preset_id as bigint))
        throw new Error("Preset registration id differs from its chain fact");
      const commitment = presetPreimageCommitment(felts);
      if (BigInt(event.value.commitment as bigint) !== BigInt(commitment))
        throw new Error("NATIVE_PRESET v1 commitment mismatch");
      return { commitment, felts: felts.map((felt) => BigInt(felt).toString()) };
    });
  } catch (cause) {
    throw new NativePresetRegistrationInvalid(cause instanceof Error ? cause.message : String(cause));
  }
}

function directAccountCalls(calldata: string[]) {
  try {
    return accountCalls(calldata);
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new NativePresetRegistrationInvalid(`${DIRECT_REGISTRATION_RULE}: ${reason}`);
  }
}
