import { shortString } from "starknet";

const PASTEL_PINK = "#F6C297";
const PASTEL_BLUE = "#BAE1FF";
const PASTEL_GREEN = "#B5EAD7";
export const CHAT_COLORS = {
  GLOBAL: PASTEL_PINK,
  GUILD: PASTEL_GREEN,
  PRIVATE: PASTEL_BLUE,
};
export const GLOBAL_CHANNEL = shortString.encodeShortString("global");
export const CHAT_STORAGE_KEY = "chat_tabs";
export const GLOBAL_CHANNEL_KEY = "global";
