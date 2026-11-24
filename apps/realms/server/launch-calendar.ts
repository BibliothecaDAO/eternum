import type { IdentityEnv } from "./env";

export const readSeasonStart = async (launch: IdentityEnv["LAUNCH"]): Promise<number | null> => {
  const response = await launch.fetch("https://launch/api/factory/calendar", {
    signal: AbortSignal.timeout(5_000),
    redirect: "manual",
  });
  if (!response.ok) throw new Error(`Launch calendar answered ${response.status}`);
  const { phases } = (await response.json()) as { phases?: { phase: string; startsAt: string }[] };
  if (!Array.isArray(phases)) throw new Error("The launch calendar lists no phases");
  const frontier = phases.find(({ phase }) => phase === "frontier");
  return frontier ? Date.parse(frontier.startsAt) : null;
};
