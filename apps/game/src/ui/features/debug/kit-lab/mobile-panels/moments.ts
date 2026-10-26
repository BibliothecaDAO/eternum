/** The moments the audit found the panels in the way: at rest, then each panel a Frontier player opens most. */
export const MOMENTS = ["rest", "build", "deploy", "site", "research", "chat"] as const;
export type Moment = (typeof MOMENTS)[number];

export const MOMENT_WORDS: Record<Moment, string> = {
  rest: "At rest",
  build: "Build on a plot",
  deploy: "Deploy",
  site: "Attack a camp",
  research: "Research",
  chat: "Chat",
};

export type Option = "today" | "a" | "b" | "c";

export type PhoneSize = { width: number; height: number };

/** The two phones the audit walked (reports/mobile-ux-pass-1.md): a common tall phone and a small one. */
export const PHONES = {
  tall: { width: 390, height: 844 },
  small: { width: 360, height: 740 },
} as const satisfies Record<string, PhoneSize>;
