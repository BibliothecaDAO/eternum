export const ChestContent = ({ showContent }: { showContent: boolean }) => {
  return (
    <div className="relative z-10 flex flex-col items-center justify-center gap-8">
      <h1
        style={{
          fontSize: "2.25rem",
          fontWeight: 700,
          color: "#FFD700",
          animation: "float 3s ease-in-out infinite",
          transition: "opacity 5000ms",
          opacity: showContent ? 1 : 0,
        }}
      >
        You opened the chest!
      </h1>
    </div>
  );
};
