import clsx from "clsx";
import { ReactNode } from "react";

interface RelationBadge {
  label: string;
  tone?: "ally" | "enemy" | "bandits" | "neutral";
}

export interface HyperstructureCardProps {
  title: ReactNode;
  relationBadge?: RelationBadge;
  titlePrefix?: ReactNode;
  titleSuffix?: ReactNode;
  ownerName?: string;
  ownerTitle?: string;
  guildName?: string;
  actions?: ReactNode;
  children?: ReactNode;
  metadata?: ReactNode;
  className?: string;
  onClick?: () => void;
}

const relationToneClasses: Record<NonNullable<RelationBadge["tone"]>, string> = {
  ally: "bg-green/30 border-green/50 border text-green-200",
  enemy: "bg-yellow/30 border-yellow/50 border text-yellow-200",
  bandits: "bg-enemy border-enemy border text-red-200",
  neutral: "bg-gold/20 border-gold/40 border text-gold",
};

export const HyperstructureCard = ({
  title,
  relationBadge,
  titlePrefix,
  titleSuffix,
  ownerName,
  ownerTitle,
  guildName,
  actions,
  children,
  metadata,
  className,
  onClick,
}: HyperstructureCardProps) => {
  const titleText = typeof title === "string" ? title : undefined;
  const relationTone = relationBadge?.tone ?? "neutral";

  return (
    <div
      className={clsx(
        "bg-gray-800/40 rounded-lg p-4 border border-gold/20 hover:border-gold/40 transition-colors",
        onClick && "cursor-pointer",
        className,
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3 gap-3">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            {titlePrefix}
            <h4 className="text-lg font-semibold text-gold truncate" title={titleText}>
              {title}
            </h4>
            {titleSuffix}
            {relationBadge && (
              <span
                className={clsx(
                  "px-2 py-1 rounded text-xs whitespace-nowrap flex-shrink-0",
                  relationToneClasses[relationTone],
                )}
              >
                {relationBadge.label}
              </span>
            )}
          </div>
          {ownerName && (
            <div className="text-sm text-gold/80 truncate" title={ownerTitle ?? ownerName}>
              Owner: {ownerName}
            </div>
          )}
          {guildName && (
            <div className="text-xs text-gold/60 truncate" title={`< ${guildName} >`}>
              {`< ${guildName} >`}
            </div>
          )}
          {metadata}
        </div>
        {actions && <div className="flex flex-col gap-2 flex-shrink-0">{actions}</div>}
      </div>
      {children}
    </div>
  );
};
