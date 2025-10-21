import { CallData } from "starknet";
import type { Abi } from "starknet";
import { PlanValidationError } from "../errors";
import type { ClassMetadata, ConstructorSpecification } from "../types";

export const buildConstructorCalldata = (
  metadata: ClassMetadata,
  spec?: ConstructorSpecification,
) => {
  if (!spec) {
    return undefined;
  }

  if (spec.raw) {
    return spec.raw;
  }

  if (!metadata.abi) {
    throw new PlanValidationError(`ABI is required to compile constructor calldata for ${metadata.id}.`, {
      classId: metadata.id,
    });
  }

  const callData = new CallData(metadata.abi as Abi);
  return callData.compile(spec.entrypoint ?? "constructor", (spec.args ?? {}) as never);
};
