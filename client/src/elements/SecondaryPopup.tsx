import clsx from "clsx";
import React, { useEffect, useState } from "react";
import Draggable from "react-draggable";

type FilterPopupProps = {
  children: React.ReactNode;
  className?: string;
  name?: string;
};

export const SecondaryPopup = ({ children, className, name }: FilterPopupProps) => {
  const nodeRef = React.useRef(null);

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [loaded, setLoaded] = useState(false);

  const handleStop = (e: any, data: any) => {
    if (name) {
      localStorage.setItem(name, JSON.stringify({ x: data.x, y: data.y }));
    }
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

  return (
    <>
      {loaded && (
        <Draggable handle=".handle" defaultPosition={position} nodeRef={nodeRef} onStop={handleStop}>
          <div
            ref={nodeRef}
            className={clsx("fixed z-50 flex flex-col translate-x-6 top-[200px] left-[450px]", className)}
          >
            {children}
          </div>
        </Draggable>
      )}
    </>
  );
};

SecondaryPopup.Head = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div
    className={clsx(
      "text-xxs relative cursor-move -mb-[1px] z-30 bg-brown px-1 py-0.5 rounded-t-[4px] border-t border-x border-white text-white w-min whitespace-nowrap handle",
      className,
    )}
  >
    {children}
  </div>
);

SecondaryPopup.Body = ({ width = null, children }: { width?: string | null; children: React.ReactNode }) => (
  <div
    className={`${
      width ? "" : "min-w-[438px]"
    } relative z-10 bg-gray border flex flex-col border-white rounded-tr-[4px] rounded-b-[4px]`}
    style={{ width: width ? width : "" }}
  >
    {children}
  </div>
);
