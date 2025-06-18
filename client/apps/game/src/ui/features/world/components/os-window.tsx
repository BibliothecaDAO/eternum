import { SecondaryPopup } from "@/ui/elements/secondary-popup";
import { motion } from "framer-motion";
import { ExpandableOSInterface, OSInterface } from "./config";

export const OSWindow = ({
  onClick,
  show,
  title,
  children,
  height = "h-72",
  width = "400px",
  hintSection,
  className,
}: OSInterface) => {
  return (
    <>
      {show && (
        <div className="fixed inset-0 z-[100] ">
          <SecondaryPopup className={`pointer-events-auto  ${className || ""}`} name={title}>
            <SecondaryPopup.Head onClose={() => onClick()} hintSection={hintSection}>
              {title}
            </SecondaryPopup.Head>
            <SecondaryPopup.Body height={height} width={width}>
              {children}
            </SecondaryPopup.Body>
          </SecondaryPopup>
        </div>
      )}
    </>
  );
};

export const ExpandableOSWindow = ({
  onClick,
  show,
  title,
  children,
  childrenExpanded,
  height = "h-72",
  width = "400px",
  widthExpanded = "400px",
  hintSection,
  isExpanded = false,
}: ExpandableOSInterface) => {
  return (
    <>
      {show && (
        <SecondaryPopup name={title}>
          <SecondaryPopup.Head onClose={() => onClick()} hintSection={hintSection}>
            {title}
          </SecondaryPopup.Head>
          <SecondaryPopup.Body height={height} width={isExpanded ? "" : width}>
            <div className="relative flex overflow-hidden">
              <div className="flex-shrink-0" style={{ width }}>
                {children}
              </div>

              <motion.div
                className="border-l"
                initial={{ width: 0, opacity: 0 }}
                animate={{
                  width: isExpanded ? parseInt(widthExpanded) : 0,
                  opacity: isExpanded ? 1 : 0,
                }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 30,
                  opacity: { duration: 0.2 },
                }}
              >
                <div className="w-full h-full" style={{ width: parseInt(widthExpanded) }}>
                  {childrenExpanded}
                </div>
              </motion.div>
            </div>
          </SecondaryPopup.Body>
        </SecondaryPopup>
      )}
    </>
  );
};
