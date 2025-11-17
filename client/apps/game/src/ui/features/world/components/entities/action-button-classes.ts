export const actionButtonBase =
  "inline-flex min-w-[104px] items-center justify-center gap-2 rounded-md px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-colors focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:opacity-60";

export const standardActionClasses = `${actionButtonBase} border border-gold/60 bg-gold/10 text-gold hover:bg-gold/20 focus:ring-gold/30`;

export const dangerActionClasses = `${actionButtonBase} border border-danger/60 bg-danger/20 text-danger hover:bg-danger/40 focus:ring-danger/40`;
