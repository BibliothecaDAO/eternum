import { shortString } from "starknet";
import { Tab } from "./types";

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

export const DEFAULT_TAB: Tab = {
  name: GLOBAL_CHANNEL_KEY,
  address: "0x0",
  key: GLOBAL_CHANNEL,
  displayed: true,
  lastSeen: new Date(),
  lastMessage: undefined,
  mandatory: true,
};

export const EVENT_STREAM_TAB: Tab = {
  name: "Events",
  address: "0x1",
  key: "events",
  displayed: true,
  lastSeen: new Date(),
  lastMessage: undefined,
  mandatory: true,
};
