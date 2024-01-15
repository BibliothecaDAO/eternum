import clsx from "clsx";
import { useEffect, useState, useRef } from "react";
import Draggable from "react-draggable";
import { ReactComponent as CloseIcon } from "../assets/icons/common/cross-circle.svg";

type FilterPopupProps = {
  children: React.ReactNode;
  className?: string;
  name?: string;
};

export const SecondaryPopup = ({ children, className, name }: FilterPopupProps) => {
  const nodeRef = useRef<any>(null);

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [loaded, setLoaded] = useState(false);

  const handleStop = (e: any, data: any) => {
    if (name) {
      localStorage.setItem(name, JSON.stringify({ x: data.x, y: data.y }));
    }
  };

  const handleDrag = (e: any, data: any) => {
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
      nodeRef.current.style.zIndex = `${maxZIndex + 1}`;
      document.querySelectorAll("[data-old-z-index]").forEach((popup: any) => {
        popup.style.zIndex = popup.getAttribute("data-old-z-index");
        popup.removeAttribute("data-old-z-index");
      });
      let parent = nodeRef.current.parentElement;
      while (parent && getComputedStyle(parent).position !== "absolute") {
        parent = parent.parentElement;
      }
      if (parent) {
        parent.setAttribute("data-old-z-index", parent.style.zIndex);
        parent.style.zIndex = `${maxZIndex + 1}`;
      }
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
  }, []);

  useEffect(() => {
    moveToTopZIndex();
  }, [loaded]);

  return (
    <>
      {loaded && (
        <Draggable
          handle=".handle"
          defaultPosition={position}
          nodeRef={nodeRef}
          onDrag={handleDrag}
          onStop={handleStop}
        >
          <div
            onClick={handleClick}
            ref={nodeRef}
            className={clsx("popup fixed z-50 flex flex-col translate-x-6 top-[200px] left-[450px]", className)}
          >
            {children}
          </div>
        </Draggable>
      )}
    </>
  );
};

SecondaryPopup.Head = ({
  children,
  className,
  onClose,
}: {
  children: React.ReactNode;
  className?: string;
  onClose?: () => void;
}) => (
  <div
    className={clsx(
      "text-xxs flex items-center relative cursor-move -mb-[1px] z-30 bg-gray px-1 py-0.5 rounded-t-[4px] border-t border-x border-white text-white w-min whitespace-nowrap handle",
      className,
    )}
  >
    {children}
    {onClose && <CloseIcon className="w-3 h-3 ml-1 cursor-pointer fill-white" onClick={onClose} />}
  </div>
);

SecondaryPopup.Body = ({
  width = null,
  withWrapper = false,
  children,
}: {
  width?: string | null;
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
        withWrapper ? "p-3" : "",
        `relative z-10 bg-gray border flex flex-col border-white rounded-tr-[4px] rounded-b-[4px] overflow-hidden`,
      )}
      style={{ width: width ? width : "", maxHeight: maxHeight ? `${maxHeight}px` : "" }}
    >
      {withWrapper ? (
        <div className="relative z-10 border flex flex-col border-gray-gold rounded-md overflow-auto">{children}</div>
      ) : (
        children
      )}
    </div>
  );
};
