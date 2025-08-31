export const getTierStyle = (tier: string) => {
  switch (tier) {
    case "T1":
      return "bg-blue-500/20 border-blue-400/40 text-blue-300";
    case "T2":
      return "bg-emerald-500/20 border-emerald-400/40 text-emerald-300";
    case "T3":
      return "bg-purple-600/20 border-purple-400/40 text-purple-300";
    default:
      return "bg-gold/20 border-gold/40 text-gold";
  }
};
