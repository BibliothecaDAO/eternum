import { loadOpening, openingCacheKey } from "@/ui/features/frontier/opening/opening-store";

export const accountAnswers = () => {
  const account = {
    seen: new Set<string>(),
    down: false,
    add: async (additions: { seen?: readonly string[] }) => {
      if (account.down) throw new Error("the account's service is down");
      for (const line of additions.seen ?? []) account.seen.add(line);
      return { reached: [], seen: [...account.seen] };
    },
  };
  return account;
};

export const leaveThePage = async (device: "same" | "another" = "same") => {
  await loadOpening(null);
  if (device === "same") return;
  window.localStorage.clear();
};

export const deviceLastPlayedBeforeTheAnswer = (owner: string) =>
  window.localStorage.setItem(
    openingCacheKey(owner),
    JSON.stringify({ reached: [], seen: [], unsent: { reached: [], seen: [] }, complete: true }),
  );
