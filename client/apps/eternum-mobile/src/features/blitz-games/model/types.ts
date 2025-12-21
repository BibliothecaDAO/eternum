export interface FactoryGame {
  name: string;
  status: "checking" | "ok" | "fail";
  toriiBaseUrl: string;
  startMainAt: number | null;
  endAt: number | null;
}

export type FactoryGameCategory = "ongoing" | "upcoming" | "ended" | "offline";
