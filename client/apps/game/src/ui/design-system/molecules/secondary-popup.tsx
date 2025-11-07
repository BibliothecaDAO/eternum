import Button from "@/ui/design-system/atoms/button";
import { HintModalButton } from "@/ui/design-system/molecules/hint-modal-button";
import clsx from "clsx";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Draggable from "react-draggable";

type FilterPopupProps = {
  children: React.ReactNode;
  className?: string;
  name?: string;
  width?: string;
};

export const SecondaryPopup = ({ children, className, name, width = "400px" }: FilterPopupProps) => {
  const nodeRef = useRef<any>(null);

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [loaded, setLoaded] = useState(false);

  const handleStop = (_: any, data: any) => {
    if (data.y < -200 || data.y > window.innerHeight - 220 || data.x < -450 || data.x > window.innerWidth - 520) {
      return false as false;
    }
    if (name) {
      localStorage.setItem(name, JSON.stringify({ x: data.x, y: data.y }));
    }
  };

  const handleDrag = (_: any, data: any) => {
    if (data.y < -200 || data.y > window.innerHeight - 220 || data.x < -450 || data.x > window.innerWidth - 520) {
      return false as false;
    }
  };

  const moveToTopZIndex = () => {
    let maxZIndex = 50;
    document.querySelectorAll(".popup").forEach((popup) => {
      const zIndex = parseInt(window.getComputedStyle(popup).zIndex);
      if (zIndex > maxZIndex) {
        maxZIndex = zIndex;
      }
    });
    if (nodeRef && nodeRef.current) {
      nodeRef.current.setAttribute("data-old-z-index", nodeRef.current.style.zIndex);

      nodeRef.current.style.zIndex = `${maxZIndex + 1}`;
      document.querySelectorAll("[data-old-z-index]").forEach((popup: any) => {
        popup.style.zIndex = popup.getAttribute("data-old-z-index");
        popup.removeAttribute("data-old-z-index");
      });
      nodeRef.current.style.zIndex = `${maxZIndex + 1}`;
    }
  };

  const handleClick = () => {
    moveToTopZIndex();
  };

  useEffect(() => {
    if (name) {
      const pos = localStorage.getItem(name);
      if (pos) {
        setPosition(JSON.parse(pos));
      }
    }
    setLoaded(true);
  }, [name]);

  useEffect(() => {
    moveToTopZIndex();
  }, [loaded]);

  return (
    <motion.div
      className="flex justify-center  "
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, width }}
      exit={{ opacity: 0 }}
      transition={{ type: "ease-in-out", stiffness: 3, duration: 0.2 }}
    >
      {loaded && (
        <Draggable
          grid={[1, 1]}
          handle=".handle"
          defaultPosition={position}
          nodeRef={nodeRef}
          onStart={handleClick}
          onDrag={handleDrag}
          onStop={handleStop}
        >
          <div
            onClick={handleClick}
            ref={nodeRef}
            className={clsx(
              "fixed popup z-50 flex flex-col translate-x-6 top-[200px] left-[450px] panel-wood panel-wood-corners bg-dark-wood",
              className,
            )}
            style={{ width: `${width}px` }}
          >
            {/* Ornate corner elements for panel-wood-corners */}
            <div className="corner-bl z-100"></div>
            <div className="corner-br z-100"></div>
            {children}
          </div>
        </Draggable>
      )}
    </motion.div>
  );
};

SecondaryPopup.Head = ({
  children,
  className,
  onClose,
  hintSection,
}: {
  children: React.ReactNode;
  className?: string;
  onClose?: () => void;
  hintSection?: string;
}) => (
  <div
    className={clsx(
      "items-center relative cursor-move z-30 px-4 py-3 bg-dark-brown/70 w-full whitespace-nowrap handle flex justify-between border-b border-gold/25",
      className,
    )}
    onKeyDown={(e) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    }}
    tabIndex={0}
  >
    <h4 className="font-semibold text-sm uppercase tracking-wider text-gold/90">{children}</h4>
    <div className="flex flex-row gap-2">
      {hintSection && <HintModalButton section={hintSection} />}

      {onClose && (
        <Button variant="default" onClick={onClose} size="xs">
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  </div>
);

SecondaryPopup.Body = ({
  width = null,
  height = null,
  withWrapper = false,
  children,
}: {
  width?: string | null;
  height?: string | null;
  withWrapper?: boolean;
  children: React.ReactNode;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState<number | null>(null);

  const calculateMaxHeight = () => {
    if (ref && ref.current) {
      // get top position of the popup
      const popupTop = ref.current.getBoundingClientRect().top;
      // get the height of the window
      const windowHeight = window.innerHeight;
      // calculate the max height of the popup
      const maxHeight = windowHeight - popupTop - 24;
      // set the max height of the popup
      setMaxHeight(maxHeight);
    }
  };
  // handle resize
  useEffect(() => {
    calculateMaxHeight();
    window.addEventListener("resize", calculateMaxHeight);
    return () => {
      window.removeEventListener("resize", calculateMaxHeight);
    };
  }, [ref]);

  return (
    <div
      ref={ref}
      className={clsx(
        width ? "" : "min-w-[438px]",
        height ? "" : "min-h-[438px]",
        withWrapper ? "p-3" : "",
        `relative z-10 flex flex-col bg-dark-brown/50 overflow-auto bg-hex-bg bg-repeat`,
      )}
      style={{
        width: width ? width : "",
        height: height ? height : "",
        maxHeight: maxHeight ? `${maxHeight}px` : "",
      }}
    >
      {withWrapper ? (
        <div className="relative z-10 border flex flex-col border-gold/20 rounded-md overflow-auto shadow-sm">
          {children}
        </div>
      ) : (
        children
      )}
    </div>
  );
};
