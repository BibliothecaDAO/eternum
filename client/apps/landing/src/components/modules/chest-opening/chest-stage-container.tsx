import X from "lucide-react/dist/esm/icons/x";
import { useCallback } from "react";

interface ChestStageContainerProps {
  children: React.ReactNode;
  onClose?: () => void;
  showCloseButton?: boolean;
  className?: string;
}

/**
 * Container component for chest opening stages.
 * Provides a contained, modal-like experience instead of full-window takeover.
 */
export function ChestStageContainer({
  children,
  onClose,
  showCloseButton = false,
  className = "",
}: ChestStageContainerProps) {
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Only close if clicking the backdrop itself, not children
      if (e.target === e.currentTarget && onClose) {
        onClose();
      }
    },
    [onClose],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      {/* Contained stage - fixed height for consistency across all stages */}
      <div
        className={`
          relative w-full max-w-5xl h-[700px] max-h-[90vh] mx-4
          bg-gradient-to-b from-slate-900 to-slate-950
          rounded-2xl border border-gold/20
          shadow-2xl shadow-black/50
          overflow-hidden
          ${className}
        `}
      >
        {/* Close button */}
        {showCloseButton && onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-white/70" />
          </button>
        )}

        {/* Content */}
        {children}
      </div>
    </div>
  );
}

/**
 * Inner content wrapper for consistent padding and layout
 */
export function ChestStageContent({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex flex-col items-center justify-center h-full p-6 ${className}`}>{children}</div>;
}
