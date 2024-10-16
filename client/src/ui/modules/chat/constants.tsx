import { shortString } from "starknet";

export const PASTEL_PINK = "#FFB3BA";
export const PASTEL_BLUE = "#BAE1FF";
export const PASTEL_GREEN = "#B5EAD7";
export const CHAT_COLORS = {
  GLOBAL: PASTEL_PINK,
  GUILD: PASTEL_GREEN,
  PRIVATE: PASTEL_BLUE,
};
export const GLOBAL_CHANNEL = shortString.encodeShortString("global");
export const CHAT_STORAGE_KEY = "chat_tabs";
export const GLOBAL_CHANNEL_KEY = "global";
