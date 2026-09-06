export const LoadingOroborus = ({ loading }: { loading: boolean }) => {
  if (!loading) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-6 left-1/2 z-[110] -translate-x-1/2 rounded-full border border-gold/25 bg-dark-brown/95 px-4 py-2 text-sm text-gold"
    >
      Changing view…
    </div>
  );
};
