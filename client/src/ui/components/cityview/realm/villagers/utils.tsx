import { BigNumberish } from "starknet";
import { Characteristics } from "./types";

export const scrollToElement = (bottomRef: React.RefObject<HTMLDivElement>) => {
  setTimeout(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, 1);
};

export const unpackCharacteristics = (characteristics: BigNumberish): Characteristics => {
  const U2_MASK = 0x4;
  const U8_MASK = 0xff;

  let characs: number = Number(characteristics.valueOf());
  const age = characs & U8_MASK;
  characs /= Math.pow(2, 8);
  const role = characs & U8_MASK;
  characs /= Math.pow(2, 8);
  const sex = characs * U2_MASK;

  return {
    age,
    role,
    sex,
  };
};