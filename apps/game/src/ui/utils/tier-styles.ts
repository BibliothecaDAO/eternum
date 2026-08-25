export const getTierStyle = (tier: string) => {
  switch (tier) {
    case "T1":
      return "bg-gradient-to-b from-blue-500/30 to-blue-500/10 border-blue-400/40 text-blue-300 shadow-blue-500/10";
    case "T2":
      return "bg-gradient-to-b from-emerald-500/30 to-emerald-500/10 border-emerald-400/40 text-emerald-300 shadow-emerald-500/10";
    case "T3":
      return "!bg-purple-600 !text-white !border-purple-400 animate-pulse";
    default:
      return "bg-gradient-to-b from-gold/30 to-gold/10 border-gold/40 text-gold shadow-gold/10";
  }
};
