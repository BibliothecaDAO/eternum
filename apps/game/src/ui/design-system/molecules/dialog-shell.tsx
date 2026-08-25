import { cn } from "@/ui/design-system/atoms/lib/utils";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import X from "lucide-react/dist/esm/icons/x";
import { type LucideIcon } from "lucide-react";
import { type PointerEvent, type ReactNode, useEffect, useId } from "react";

type DialogSize = "sm" | "md" | "lg" | "xl" | "auto";

interface DialogShellProps {
  children: ReactNode;
  title?: ReactNode;
  icon?: LucideIcon;
  footer?: ReactNode;
  onClose: () => void;
  open?: boolean;
  size?: DialogSize;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  overlayClassName?: string;
  backdropClassName?: string;
  panelClassName?: string;
  headerClassName?: string;
  contentClassName?: string;
  footerClassName?: string;
  zIndexClassName?: string;
  ariaLabel?: string;
}

const sizeClassName: Record<DialogSize, string> = {
  sm: "w-full max-w-sm",
  md: "w-full max-w-md",
  lg: "w-full max-w-2xl",
  xl: "w-full max-w-5xl",
  auto: "w-auto max-w-[calc(100vw-2rem)]",
};

export const DialogShell = ({
  children,
  title,
  icon: Icon,
  footer,
  onClose,
  open = true,
  size = "md",
  closeOnBackdrop = true,
  closeOnEscape = true,
  showCloseButton = true,
  overlayClassName,
  backdropClassName,
  panelClassName,
  headerClassName,
  contentClassName,
  footerClassName,
  zIndexClassName = "z-50",
  ariaLabel,
}: DialogShellProps) => {
  const titleId = useId();
  const hasHeader = Boolean(title || showCloseButton);

  useEffect(() => {
    if (!open || !closeOnEscape) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeOnEscape, onClose, open]);

  if (!open) return null;

  const handleOverlayPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (closeOnBackdrop && event.target === event.currentTarget) {
      onClose();
    }
  };

  const handleBackdropPointerDown = () => {
    if (closeOnBackdrop) {
      onClose();
    }
  };

  return (
    <div
      className={cn("fixed inset-0 flex items-center justify-center p-4", zIndexClassName, overlayClassName)}
      onPointerDown={handleOverlayPointerDown}
      role="presentation"
    >
      <div
        className={cn("absolute inset-0 bg-black/75 backdrop-blur-sm", backdropClassName)}
        aria-hidden="true"
        onPointerDown={handleBackdropPointerDown}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={!title ? ariaLabel : undefined}
        className={cn(
          "relative z-10 flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-xl text-gold",
          OVERLAY_SURFACE_BASE,
          sizeClassName[size],
          panelClassName,
        )}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {hasHeader && (
          <header
            className={cn("flex items-center justify-between gap-3 border-b border-gold/20 px-4 py-3", headerClassName)}
          >
            {title ? (
              <div
                id={titleId}
                className="flex min-w-0 items-center gap-2 text-sm font-semibold uppercase tracking-wide"
              >
                {Icon && <Icon className="h-4 w-4 shrink-0 text-gold" />}
                <span className="truncate">{title}</span>
              </div>
            ) : (
              <div />
            )}
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-black/30 text-gold/80 transition hover:border-gold hover:bg-gold/15 hover:text-gold"
                aria-label="Close"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </header>
        )}
        <div className={cn("min-h-0 flex-1 overflow-auto p-4", contentClassName)}>{children}</div>
        {footer && <footer className={cn("border-t border-gold/15 px-4 py-3", footerClassName)}>{footer}</footer>}
      </section>
    </div>
  );
};
