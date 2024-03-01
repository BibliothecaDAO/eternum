import { BigNumberish } from "starknet";
import { Characteristics } from "./types";
import { SEX, ROLES } from "./constants";

const U2_MASK: bigint = BigInt(0x3);
const U8_MASK: bigint = BigInt(0xff);

const TWO_POW_8 = 0x100;
const TWO_POW_16 = 0x10000;

export const scrollToElement = (bottomRef: React.RefObject<HTMLDivElement>) => {
  setTimeout(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, 1);
};

export const unpackCharacteristics = (characteristics: bigint): Characteristics => {
  const age = characteristics & U8_MASK;
  characteristics = characteristics >> BigInt(8);
  const role = characteristics & U8_MASK;
  characteristics = characteristics >> BigInt(8);
  const sex = characteristics & U2_MASK;

  return {
    age: Number(age),
    role: ROLES[Number(role)],
    sex: SEX[Number(sex)],
  };
};

export const packCharacteristics = ({ age, role, sex }: any): BigNumberish => {
  const packed = age + role * TWO_POW_8 + sex * TWO_POW_16;
  return packed;
};
