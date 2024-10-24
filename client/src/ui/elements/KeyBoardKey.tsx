export const KeyBoardKey = ({
  keyName,
  invertColors,
  size = "sm",
  bounce = true,
  className,
}: {
  keyName: string;
  invertColors?: boolean;
  size?: "sm" | "md" | "lg";
  bounce?: boolean;
  className?: string;
}) => {
  const sizeClasses = {
    sm: "w-4 h-4 text-xxs",
    md: "w-5 h-5 text-xs",
    lg: "w-6 h-6 text-sm",
  };

  return (
    <span
      className={`
        font-bold rounded 
        flex items-center justify-center
        border-2 shadow-lg
        ${sizeClasses[size]}
        ${invertColors ? "text-black border-black" : "text-gold border-gold"}
        ${bounce ? "animate-bounce" : ""}
        transition-all duration-200 hover:scale-110
        ${className || ""}
      `}
    >
      {keyName.toUpperCase()}
    </span>
  );
};
