export const OrientationOverlay = () => {
  return (
    <div
      className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 text-center
        landscape:hidden lg:hidden"
    >
      <div className="text-white space-y-4">
        <div className="animate-pulse">⟳</div>
        <h2 className="text-xl font-bold">Please Rotate Your Device</h2>
        <p>This game is best played in landscape orientation</p>
      </div>
    </div>
  );
};
