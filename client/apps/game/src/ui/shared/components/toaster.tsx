import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

// Toast surface matches the Etched Bronze HUD pills: the same border,
// gradient, inner highlight, and shadow as OVERLAY_SURFACE_BASE — so a toast
// reads as one of the bronze chips floating over the world, not a separate
// design language.
const TOAST_SURFACE =
  "group toast text-gold border border-gold/30 bg-gradient-to-b from-[#1a1410]/95 to-[#231a10]/95 shadow-[0_8px_24px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(223,170,84,0.18)] backdrop-blur-sm";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      // Bottom-center sits between the left structure list and right tile
      // inspector, above the minimap.
      position="bottom-center"
      offset="24px"
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: TOAST_SURFACE,
          description: "text-gold/70",
          actionButton: "bg-gold/20 text-gold border border-gold/40 hover:bg-gold/30",
          cancelButton: "bg-black/40 text-gold/70 border border-gold/20 hover:text-gold",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
