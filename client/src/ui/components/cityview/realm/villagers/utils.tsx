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

function snakeToCamel(s: string): string {
  return s.replace(/(_\w)/g, (m) => m[1].toUpperCase());
}

export function keysSnakeToCamel(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map((item) => (typeof item === "object" && item !== null ? keysSnakeToCamel(item) : item));
  } else if (typeof obj === "object" && obj !== null) {
    const newObj: Record<string, any> = {};
    Object.keys(obj).forEach((key) => {
      const camelCaseKey = snakeToCamel(key);
      newObj[camelCaseKey] = keysSnakeToCamel(obj[key]); // Apply conversion recursively
    });
    return newObj;
  }
  // Return the value directly if it's neither an object nor an array
  return obj;
}
