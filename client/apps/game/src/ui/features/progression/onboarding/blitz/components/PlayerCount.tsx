import { Users } from "lucide-react";

interface PlayerCountProps {
  count: number;
  className?: string;
  showIcon?: boolean;
  label?: string;
}

export const PlayerCount = ({
  count,
  className = "",
  showIcon = true,
  label = "players registered",
}: PlayerCountProps) => {
  return (
    <div className={`flex items-center justify-center gap-2 text-gold ${className}`}>
      {showIcon && <Users className="w-5 h-5" />}
      <span className="text-lg font-semibold">
        {count} {label}
      </span>
    </div>
  );
};
